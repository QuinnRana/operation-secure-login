import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const require = createRequire(import.meta.url);
const throttled = { status: 'error', message: 'Too many defended lab resets. Try again in a minute.' };
const unavailable = { status: 'error', message: 'The defended lab reset failed. Restart the local server and try again.' };

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-11T12:00:00Z');
  let hashCalls = 0;
  let fault = null;
  const logs = [];
  const queries = [];
  const db = { prepare(sql) {
    queries.push(sql);
    if (fault === 'store') throw new Error('private-database-error');
    let values = [];
    return { bind(...v) { values = v; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() {
        if (sql.includes('RETURNING attempts')) {
          if (fault === 'empty') return null;
          if (fault === 'invalid') return { attempts: 0 };
        }
        return sqlite.prepare(sql).get(...values) ?? null;
      },
    };
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      if (fault === 'reset') throw new Error('private-reset-error');
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    const localRequire = name => name === 'cloudflare:workers'
      ? { env: { DB: { prepare() { assert.fail('must not access secure DB'); } }, LAB_DB: db } }
      : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name);
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console'])(
      localRequire, testModule, testModule.exports, Clock, { info: value => logs.push(JSON.parse(value)) });
    if (path === 'lib/password.ts') {
      const realHash = testModule.exports.hashPassword;
      testModule.exports.hashPassword = (...args) => { hashCalls++; return realHash(...args); };
    }
    modules.set(path, testModule.exports);
    return testModule.exports;
  }
  const { resetDefendedLab } = load('app/defended-lab/actions.ts');
  return { sqlite, logs, queries, reset: resetDefendedLab,
    hashes: () => hashCalls, advance(ms) { now += ms; }, fail(value) { fault = value; },
    rows: () => sqlite.prepare('SELECT * FROM defended_lab_accounts ORDER BY id').all(),
    budget: () => sqlite.prepare('SELECT * FROM defended_reset_limit').get(),
  };
}

await test('reset budget admits three attempts, skips hash/schema work when denied and recovers at exact expiry', async t => {
  const f = fixture(t);
  for (let i = 0; i < 3; i++) assert.equal((await f.reset()).status, 'success');
  assert.equal(f.hashes(), 9, 'exactly three password derivations per admitted reset');
  const rows = f.rows();
  const expiry = f.budget().expires_at;
  const before = f.queries.length;
  for (let i = 0; i < 10; i++) assert.deepEqual(await f.reset(), throttled);
  assert.equal(f.hashes(), 9, 'blocked resets must not hash seed passwords');
  assert.deepEqual(f.rows(), rows, 'blocked resets must preserve rows, hashes and salts');
  assert.ok(f.queries.slice(before).every(sql => !sql.includes('defended_lab_accounts')));
  assert.equal(f.budget().attempts, 4, 'the counter saturates instead of growing indefinitely');
  assert.equal(f.budget().expires_at, expiry, 'blocked requests must not extend cooldown');
  f.advance(59_999);
  assert.deepEqual(await f.reset(), throttled);
  f.advance(1);
  assert.equal((await f.reset()).status, 'success');
  assert.equal(f.hashes(), 12);
  assert.notDeepEqual(f.rows().map(row => row.password_salt), rows.map(row => row.password_salt));
  assert.equal(f.budget().attempts, 1);
  assert.equal(f.budget().expires_at, expiry + 60_000);
  for (const event of f.logs) {
    assert.deepEqual(Object.keys(event).sort(), ['event', 'outcome', 'timestamp']);
    assert.equal(event.event, 'defended_reset');
    assert.ok(Number.isFinite(Date.parse(event.timestamp)));
  }
  assert.deepEqual(f.logs.map(event => event.outcome), [
    'success', 'success', 'success', ...Array(11).fill('throttled'), 'success',
  ]);
  assert.doesNotMatch(JSON.stringify(f.logs), /alex|falcon7|password|salt|private-/);
});

await test('reset storage errors and invalid reservation results fail closed before hashing or reset work', async t => {
  for (const fault of ['store', 'empty', 'invalid']) {
    const f = fixture(t);
    f.fail(fault);
    assert.deepEqual(await f.reset(), unavailable, fault);
    assert.equal(f.hashes(), 0, fault);
    assert.ok(f.queries.every(sql => !sql.includes('defended_lab_accounts')), fault);
    assert.equal(f.logs.at(-1).outcome, 'unavailable');
    assert.doesNotMatch(JSON.stringify(f.logs), /private-/);
  }
});

await test('failed reset transactions retain rows and consume quota; neither reset changes login quotas', async t => {
  const f = fixture(t);
  assert.equal((await f.reset()).status, 'success');
  f.sqlite.exec("CREATE TABLE login_attempt_limits (marker TEXT); INSERT INTO login_attempt_limits VALUES ('retain-login-quota'); CREATE TABLE lab_accounts (marker TEXT); INSERT INTO lab_accounts VALUES ('retain-vulnerable-baseline')");
  const rows = f.rows();
  f.fail('reset');
  assert.deepEqual(await f.reset(), unavailable);
  assert.deepEqual(f.rows(), rows);
  assert.equal(f.budget().attempts, 2, 'rollback cannot refund the separately reserved work');
  f.fail(null);
  assert.equal((await f.reset()).status, 'success');
  assert.deepEqual(await f.reset(), throttled);
  assert.equal(f.hashes(), 9);
  assert.equal(f.sqlite.prepare('SELECT marker FROM login_attempt_limits').get().marker, 'retain-login-quota');
  assert.equal(f.sqlite.prepare('SELECT marker FROM lab_accounts').get().marker, 'retain-vulnerable-baseline');
});

await test('concurrent Workers share one reset budget without changing baseline reset or secure data', async t => {
  const bundle = await build({
    stdin: { contents: `
      import { resetDefendedLab, defendedLogin } from './app/defended-lab/actions';
      import { resetLab, vulnerableLogin } from './app/attack-lab/actions';
      let now = 1794398400000;
      Date.now = () => now;
      export default { async fetch(request) {
        now = Number(request.headers.get('x-fixture-now') ?? 1794398400000);
        const path = new URL(request.url).pathname;
        if (path === '/reset') return Response.json(await resetDefendedLab());
        if (path === '/baseline-reset') return Response.json(await resetLab());
        return Response.json(await (path === '/baseline' ? vulnerableLogin : defendedLogin)({}, await request.formData()));
      }};
    `, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'browser', write: false, external: ['cloudflare:workers'],
  });
  const runtime = new Miniflare({ workers: ['reset-a', 'reset-b'].map(name => ({
    name, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'secure-reset-fixture', LAB_DB: 'shared-reset-fixture' },
  })) });
  t.after(() => runtime.dispose());
  const workers = await Promise.all(['reset-a', 'reset-b'].map(name => runtime.getWorker(name)));
  const secure = await runtime.getD1Database('DB', 'reset-a');
  const lab = await runtime.getD1Database('LAB_DB', 'reset-a');
  await secure.prepare('CREATE TABLE users (marker TEXT)').run();
  await secure.prepare("INSERT INTO users VALUES ('retain-secure-data')").run();
  const call = async (i, path, username = 'alex', password = 'falcon7', now = 1794398400000) => {
    const response = await workers[i % 2].fetch(`http://localhost${path}`, {
      method: 'POST', headers: { 'x-fixture-now': String(now) }, body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => call(i, '/reset')));
  assert.equal(results.filter(result => result.status === 'success').length, 3);
  assert.equal(results.filter(result => result.message === throttled.message).length, 17);
  const budget = await lab.prepare('SELECT * FROM defended_reset_limit').all();
  assert.equal(budget.results.length, 1);
  assert.equal(budget.results[0].attempts, 4);
  assert.equal((await lab.prepare('SELECT COUNT(*) AS n FROM defended_lab_accounts').first()).n, 3);
  for (let i = 0; i < 4; i++) assert.equal((await call(i, '/baseline-reset')).status, 'success');
  assert.deepEqual(await call(1, '/reset'), throttled, 'baseline reset must not replenish defended reset quota');
  assert.equal((await call(0, '/baseline', "' OR 1=1 --", 'x')).records.length, 3);
  assert.equal((await call(1, '/login')).status, 'success', 'reset quota must not consume login quota');
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'retain-secure-data');
  assert.deepEqual((await secure.prepare("SELECT name FROM sqlite_master WHERE name IN ('defended_reset_limit', 'defended_lab_accounts')").all()).results, []);

  const expiry = budget.results[0].expires_at;
  assert.deepEqual(await call(0, '/reset', 'alex', 'falcon7', expiry - 1), throttled);
  const rollover = await Promise.all(Array.from({ length: 20 }, (_, i) => call(i, '/reset', 'alex', 'falcon7', expiry)));
  assert.equal(rollover.filter(result => result.status === 'success').length, 3, 'concurrent expiry admits only a new window of three');
  assert.equal(rollover.filter(result => result.message === throttled.message).length, 17);
  const renewed = await lab.prepare('SELECT * FROM defended_reset_limit').first();
  assert.equal(renewed.attempts, 4);
  assert.equal(renewed.expires_at, expiry + 60_000);
});
