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
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-06T12:00:00Z');
  let unavailable = false;
  const logs = [];
  const queries = [];
  const db = { prepare(sql) {
    queries.push(sql);
    if (unavailable) throw new Error('sensitive-database-error');
    let values = [];
    return { bind(...v) { values = v; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    };
  }, async batch(statements) { return Promise.all(statements.map(s => s.run())); } };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    const localRequire = name => name === 'cloudflare:workers' ? { env: { DB: { prepare() { assert.fail('must not access secure DB'); } }, LAB_DB: db } }
      : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name);
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console'])(
      localRequire, testModule, testModule.exports, Clock, { info: value => logs.push(JSON.parse(value)) });
    modules.set(path, testModule.exports);
    return testModule.exports;
  }
  const { defendedLogin: login, resetDefendedLab } = load('app/defended-lab/actions.ts');
  return { sqlite, logs, queries, resetDefendedLab, advance(ms) { now += ms; }, fail() { unavailable = true; },
    async submit(username, password) {
      const form = new FormData(); form.set('username', username); form.set('password', password);
      return login({ status: 'idle', message: '' }, form);
    } };
}

await test('defended budget rejects attempt six before credential work, survives reset and recovers at exact expiry', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.submit('alex', 'wrong-secret')).message, 'The username or password is incorrect.');
  const before = f.queries.length;
  const throttled = await f.submit('alex', 'falcon7');
  assert.equal(throttled.message, 'Too many login attempts. Try again in a minute.');
  assert.ok(f.queries.slice(before).every(sql => !sql.includes('defended_lab_accounts')));
  assert.equal((await f.resetDefendedLab()).status, 'success');
  assert.deepEqual(await f.submit('alex', 'falcon7'), throttled, 'reset must not replenish quota');
  f.advance(59_999);
  assert.deepEqual(await f.submit('alex', 'falcon7'), throttled);
  f.advance(1);
  assert.equal((await f.submit('alex', 'falcon7')).status, 'success');
  assert.deepEqual(f.logs.map(x => x.outcome), [...Array(5).fill('denied'), 'throttled', 'throttled', 'throttled', 'success']);
  for (const event of f.logs) {
    assert.deepEqual(Object.keys(event).sort(), ['event', 'outcome', 'timestamp']);
    assert.equal(event.event, 'defended_login');
    assert.ok(Number.isFinite(Date.parse(event.timestamp)));
  }
  assert.equal(f.logs.at(-1).timestamp, '2026-11-06T12:01:00.000Z');
  assert.doesNotMatch(JSON.stringify(f.logs), /alex|wrong-secret|falcon7|password|salt|token/);
  console.info('Defended cooldown evidence:', JSON.stringify(f.logs));
});

await test('defended success consumes quota, identities match exact lookup, and failures reveal no input', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.submit('alex', 'falcon7')).status, 'success');
  assert.match((await f.submit('alex', 'falcon7')).message, /Too many/);
  for (const username of [' alex ', 'Alex', 'nobody']) {
    for (let i = 0; i < 5; i++) assert.equal((await f.submit(username, 'falcon7')).message, 'The username or password is incorrect.');
    assert.match((await f.submit(username, 'falcon7')).message, /Too many/);
  }
  const before = f.queries.length;
  await f.submit('', '');
  await f.submit('a'.repeat(257), 'private-password');
  assert.equal(f.queries.length, before, 'invalid inputs must not reserve or query');
  assert.equal(f.logs.at(-1).outcome, 'invalid_input');
  f.fail();
  assert.equal((await f.submit('casey', 'private-password')).message, 'The defended lab could not check that login. Try again.');
  assert.equal(f.logs.at(-1).outcome, 'unavailable');
  assert.doesNotMatch(JSON.stringify(f.logs), /sensitive-database-error|private-password|alex|casey|falcon7/);
});

await test('two Workers share defended quota and preserve vulnerable baseline and secure quota', async t => {
  const bundle = await build({
    stdin: { contents: `
      import { defendedLogin, resetDefendedLab } from './app/defended-lab/actions';
      import { vulnerableLogin, resetLab } from './app/attack-lab/actions';
      import { login } from './app/actions';
      import { withRequest } from './tests/worker-request-context.mjs';
    export default { async fetch(request) { return withRequest(request, async () => {
        const path = new URL(request.url).pathname;
        if (path === '/reset') return Response.json(await resetDefendedLab());
        if (path === '/reset-vulnerable') return Response.json(await resetLab());
        return Response.json(await (path === '/secure' ? login : path === '/vulnerable' ? vulnerableLogin : defendedLogin)({}, await request.formData()));
      }); }};
    `, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'browser', write: false, external: ['cloudflare:workers', 'node:async_hooks'],
    alias: { 'next/headers': './tests/worker-request-context.mjs' },
  });
  const runtime = new Miniflare({ workers: ['defended-a', 'defended-b'].map(name => ({
    name, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'secure-fixture', LAB_DB: 'shared-defended-fixture' },
  })) });
  t.after(() => runtime.dispose());
  const workers = await Promise.all(['defended-a', 'defended-b'].map(name => runtime.getWorker(name)));
  const call = async (i, path, username = 'alex', password = 'wrong') => {
    const response = await workers[i % 2].fetch(`http://localhost${path}`, {
      method: 'POST', headers: { origin: 'http://localhost' }, body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => call(i, '/login')));
  assert.equal(results.filter(r => r.message === 'The username or password is incorrect.').length, 5);
  assert.equal(results.filter(r => r.message === 'Too many login attempts. Try again in a minute.').length, 15);
  assert.equal((await call(0, '/reset')).status, 'success');
  assert.equal((await call(0, '/reset-vulnerable')).status, 'success');
  assert.match((await call(1, '/login', 'alex', 'falcon7')).message, /Too many/);
  assert.equal((await call(0, '/vulnerable', "' OR 1=1 --", 'x')).records.length, 3);
  // Exhaust an identical username only in LAB_DB; the secure DB budget is independent.
  for (let i = 0; i < 6; i++) await call(i, '/login', 'student', 'Training123!');
  assert.equal((await call(1, '/secure', 'student', 'Training123!')).status, 'success');
  assert.equal((await call(1, '/login', 'jamie', 'spring22')).status, 'success');
});
