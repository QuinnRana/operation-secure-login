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
const throttle = 'Too many login attempts. Try again in a minute.';

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-10T12:00:00Z');
  let failGlobal = false;
  let failAccount = false;
  let globalResult;
  const digests = [];
  const queries = [];
  const logs = [];
  const hashCalls = [];
  const db = { prepare(sql) {
    queries.push(sql);
    if (failGlobal && sql.includes('login_global_limit')) throw new Error('private-storage-detail');
    if (failAccount && sql.includes('login_attempt_limits')) throw new Error('private-account-storage-detail');
    let values = [];
    return { bind(...v) { values = v; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() {
        if (globalResult !== undefined && sql.includes('INSERT INTO login_global_limit')) return globalResult;
        return sqlite.prepare(sql).get(...values) ?? null;
      },
    };
  } };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    const localRequire = name => {
      if (name === 'cloudflare:workers') return { env: { DB: db } };
      if (!name.startsWith('@/')) return require(name);
      const loaded = load(`${name.slice(2)}.ts`);
      return name === '@/lib/password' ? { ...loaded, async hashPassword(password, salt) {
        hashCalls.push({ password, salt });
        return loaded.hashPassword(password, salt);
      } } : loaded;
    };
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console', 'crypto'])(
      localRequire, testModule, testModule.exports, Clock, { info: value => logs.push(JSON.parse(value)) },
      { subtle: { digest(...args) { digests.push(args); return crypto.subtle.digest(...args); } } });
    modules.set(path, testModule.exports);
    return testModule.exports;
  }
  const { reserveLoginAttempt } = load('lib/login-security.ts');
  const { login } = load('app/actions.ts');
  return { sqlite, queries, logs, hashCalls, digests,
    reserve: username => reserveLoginAttempt(db, username),
    advance(ms) { now += ms; }, fail() { failGlobal = true; },
    failAccount(value) { failAccount = value; },
    malformed(value) { globalResult = value; },
    async submit(username, password) {
      const form = new FormData(); form.set('username', username); form.set('password', password);
      return login({ status: 'idle', message: '' }, form);
    },
  };
}

await test('rotating usernames share a fixed budget before creating account rows', async t => {
  const f = fixture(t);
  f.sqlite.exec("CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES ('keep')");
  for (let i = 0; i < 60; i++) assert.equal(await f.reserve(`fictional-${i}`), true);
  const before = f.queries.length;
  assert.equal(await f.reserve('over-budget'), false);
  assert.equal(f.digests.length, 60, 'global rejection must skip identity hashing');
  assert.ok(f.queries.slice(before).every(sql => !sql.includes('login_attempt_limits')));
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM login_attempt_limits').get().n, 60);
  const original = f.sqlite.prepare('SELECT * FROM login_global_limit').get();
  assert.equal(original.attempts, 61);
  f.advance(59_999);
  assert.equal(await f.reserve('another-name'), false);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM login_global_limit').get(), original);
  f.advance(1);
  assert.equal(await f.reserve('after-cooldown'), true);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM login_attempt_limits').get().n, 1);
  assert.equal(f.sqlite.prepare('SELECT attempts FROM login_global_limit').get().attempts, 1);
  assert.equal(f.sqlite.prepare('SELECT value FROM unrelated').get().value, 'keep');
});

await test('account throttles consume the global budget but blocked global requests do not touch account counters', async t => {
  const f = fixture(t);
  for (let i = 0; i < 60; i++) assert.equal(await f.reserve('same-account'), i < 5);
  assert.equal(f.sqlite.prepare('SELECT attempts FROM login_global_limit').get().attempts, 60);
  assert.equal(f.sqlite.prepare('SELECT attempts FROM login_attempt_limits').get().attempts, 6);
  const before = f.sqlite.prepare('SELECT * FROM login_attempt_limits').all();
  assert.equal(await f.reserve('fresh-account'), false);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM login_attempt_limits').get().n, 1);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM login_attempt_limits').all(), before);
});

await test('missing and malformed global reservations fail closed before account or password work', async t => {
  for (const row of [null, {}, { attempts: 0 }, { attempts: -1 }, { attempts: 1.5 }, { attempts: '1' }, { attempts: NaN }, { attempts: Infinity }]) {
    const f = fixture(t);
    f.malformed(row);
    assert.equal((await f.submit('student', 'Training123!')).message, 'Login is temporarily unavailable. Try again later.');
    assert.equal(f.hashCalls.length, 0);
    assert.equal(f.digests.length, 0);
    assert.ok(f.queries.every(sql => !/\busers\b|login_attempt_limits/.test(sql)));
    assert.equal(f.logs.at(-1).outcome, 'unavailable');
  }
});

await test('an account-stage failure cannot refund a successful global reservation', async t => {
  const f = fixture(t);
  f.failAccount(true);
  assert.equal((await f.submit('student', 'Training123!')).message, 'Login is temporarily unavailable. Try again later.');
  assert.equal(f.sqlite.prepare('SELECT attempts FROM login_global_limit').get().attempts, 1);
  assert.equal(f.hashCalls.length, 0);
  f.failAccount(false);
  for (let i = 0; i < 59; i++) assert.equal(await f.reserve(`fictional-${i}`), true);
  assert.equal((await f.submit('student', 'Training123!')).message, throttle);
  assert.equal(f.hashCalls.length, 0);
  assert.doesNotMatch(JSON.stringify(f.logs), /private-account-storage-detail|student|Training123/);
});

await test('secure action skips credential work at global exhaustion and fails closed on global storage errors', async t => {
  const f = fixture(t);
  for (let i = 0; i < 59; i++) await f.reserve(`fictional-${i}`);
  // Invalid input must not consume the last shared slot or do any database work.
  const invalidBefore = f.queries.length;
  assert.equal((await f.submit('', 'private-password')).status, 'error');
  assert.equal(f.queries.length, invalidBefore);
  assert.equal((await f.submit('student', 'Training123!')).status, 'success');
  assert.ok(f.hashCalls.length > 0);
  f.hashCalls.length = 0;
  const before = f.queries.length;
  assert.equal((await f.submit('new-user', 'private-password')).message, throttle);
  assert.equal(f.hashCalls.length, 0);
  assert.ok(f.queries.slice(before).every(sql => !/\busers\b|login_attempt_limits/.test(sql)));
  assert.equal(f.logs.at(-1).outcome, 'throttled');
  f.fail();
  assert.equal((await f.submit('new-user', 'private-password')).message, 'Login is temporarily unavailable. Try again later.');
  assert.equal(f.hashCalls.length, 0);
  assert.equal(f.logs.at(-1).outcome, 'unavailable');
  assert.doesNotMatch(JSON.stringify(f.logs), /private-password|private-storage-detail|student|new-user/);
  for (const event of f.logs) assert.deepEqual(Object.keys(event).sort(), ['event', 'outcome', 'timestamp']);
});

await test('concurrent Workers share the global budget while lab resets and baseline preserve database boundaries', async t => {
  const bundle = await build({
    stdin: { contents: `
      import { env } from 'cloudflare:workers';
      import { reserveLoginAttempt } from './lib/login-security';
      import { login } from './app/actions';
      import { defendedLogin, resetDefendedLab } from './app/defended-lab/actions';
      import { vulnerableLogin, resetLab } from './app/attack-lab/actions';
      export default { async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/reset') return Response.json(await resetDefendedLab());
        if (path === '/reset-vulnerable') return Response.json(await resetLab());
        const data = await request.formData();
        if (path === '/reserve') return Response.json(await reserveLoginAttempt(env.LAB_DB, data.get('username')));
        return Response.json(await (path === '/secure' ? login : path === '/vulnerable' ? vulnerableLogin : defendedLogin)({}, data));
      }};
    `, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'browser', write: false, external: ['cloudflare:workers'],
  });
  const runtime = new Miniflare({ workers: ['global-a', 'global-b'].map(name => ({
    name, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'secure-global-fixture', LAB_DB: 'lab-global-fixture' },
  })) });
  t.after(() => runtime.dispose());
  const workers = await Promise.all(['global-a', 'global-b'].map(name => runtime.getWorker(name)));
  const call = async (i, path, username = 'alex', password = 'falcon7') => {
    const response = await workers[i % 2].fetch(`http://localhost${path}`, {
      method: 'POST', body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const results = await Promise.all(Array.from({ length: 120 }, (_, i) => call(i, '/reserve', `fictional-${i}`)));
  assert.equal(results.filter(Boolean).length, 60);
  const lab = await runtime.getD1Database('LAB_DB', 'global-a');
  assert.equal((await lab.prepare('SELECT count(*) AS n FROM login_attempt_limits').first()).n, 60);
  const budget = await lab.prepare('SELECT * FROM login_global_limit').first();
  assert.equal(budget.attempts, 61);
  assert.equal((await call(0, '/defended')).message, throttle);
  assert.equal(await lab.prepare("SELECT name FROM sqlite_master WHERE name='defended_lab_accounts'").first(), null);
  assert.equal((await call(1, '/secure', 'student', 'Training123!')).status, 'success');
  assert.equal((await call(0, '/reset')).status, 'success');
  assert.equal((await call(1, '/reset-vulnerable')).status, 'success');
  assert.equal((await call(0, '/defended')).message, throttle);
  assert.equal((await call(1, '/vulnerable', "' OR 1=1 --", 'test')).records.length, 3);
  assert.deepEqual(await lab.prepare('SELECT * FROM login_global_limit').first(), budget);
});
