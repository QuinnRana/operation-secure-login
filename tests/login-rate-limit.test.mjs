import { requestContext } from './request-context.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-04T12:00:00Z');
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
  } };
  const modules = new Map();
  const request = requestContext();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    const localRequire = name => name === 'cloudflare:workers' ? { env: { DB: db } }
      : name === 'next/headers' ? request
      : name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name);
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console'])(
      localRequire, testModule, testModule.exports, Clock, { info: value => logs.push(JSON.parse(value)) });
    modules.set(path, testModule.exports);
    return testModule.exports;
  }
  const { login } = load('app/actions.ts');
  return { sqlite, logs, queries, advance(ms) { now += ms; }, fail() { unavailable = true; },
    async submit(username, password) {
      const form = new FormData(); form.set('username', username); form.set('password', password);
      return login({ status: 'idle', message: '' }, form);
    } };
}

await test('account budget throttles before hashing, stays fixed, and recovers at cooldown', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.submit(' student ', 'wrong-secret')).message, 'The username or password is incorrect.');
  const before = f.queries.length;
  const throttled = await f.submit('student', 'Training123!');
  assert.equal(throttled.message, 'Too many login attempts. Try again in a minute.');
  assert.ok(f.queries.slice(before).every(sql => !/\busers\b/.test(sql)), 'blocked request must not initialize or query credentials');
  f.advance(59_999);
  assert.deepEqual(await f.submit(' student ', 'Training123!'), throttled);
  f.advance(1);
  assert.equal((await f.submit('student', 'Training123!')).status, 'success');
  assert.deepEqual(f.logs.map(x => x.outcome), [...Array(5).fill('denied'), 'throttled', 'throttled', 'success']);
  for (const event of f.logs) {
    assert.deepEqual(Object.keys(event).sort(), ['event', 'outcome', 'timestamp']);
    assert.equal(event.event, 'secure_login');
    assert.ok(Number.isFinite(Date.parse(event.timestamp)));
  }
  assert.equal(f.logs.at(-1).timestamp, '2026-11-04T12:01:00.000Z');
  assert.doesNotMatch(JSON.stringify(f.logs), /student|wrong-secret|Training123|password|salt|token/);
  const rows = f.sqlite.prepare('SELECT * FROM login_attempt_limits').all();
  assert.equal(rows.length, 1);
  assert.match(rows[0].account_key, /^[a-f0-9]{64}$/);
  assert.equal(rows[0].attempts, 1);
  console.info('Deterministic cooldown evidence:', JSON.stringify(f.logs));
});

await test('cleanup is bounded and preserves unrelated tables and active budgets', async t => {
  const f = fixture(t);
  await f.submit('student', 'wrong');
  f.sqlite.exec('CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES (\'keep\')');
  for (let i = 0; i < 150; i++) f.sqlite.prepare('INSERT INTO login_attempt_limits VALUES (?, 6, 0)').run(`expired-${i}`);
  await f.submit('student', 'wrong');
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM login_attempt_limits WHERE expires_at=0').get().n, 50);
  assert.equal(f.sqlite.prepare('SELECT attempts FROM login_attempt_limits WHERE expires_at>0').get().attempts, 2);
  assert.equal(f.sqlite.prepare('SELECT value FROM unrelated').get().value, 'keep');
});

await test('unknown accounts have the same budget; success cannot reset it; invalid inputs and outage are safe', async t => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.submit('student', 'Training123!')).status, 'success');
  assert.match((await f.submit('student', 'Training123!')).message, /Too many/);
  for (let i = 0; i < 5; i++) assert.equal((await f.submit('unknown', 'wrong')).message, 'The username or password is incorrect.');
  assert.match((await f.submit('unknown', 'wrong')).message, /Too many/);
  assert.equal((await f.submit('', '')).status, 'error');
  assert.equal(f.logs.at(-1).outcome, 'invalid_input');
  f.fail();
  const outage = await f.submit('another', 'private-password');
  assert.equal(outage.message, 'Login is temporarily unavailable. Try again later.');
  assert.equal(f.logs.at(-1).outcome, 'unavailable');
  assert.doesNotMatch(JSON.stringify(f.logs), /sensitive-database-error|private-password|another/);
});
