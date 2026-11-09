import { requestContext } from './request-context.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Execute the actual server actions with local SQLite-backed D1 adapters.
function loadSource(path, env, hashCalls = []) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const testModule = { exports: {} };
  const localRequire = (name) => {
    if (name === 'cloudflare:workers') return { env };
    if (name === 'next/headers') return env.testRequest ??= requestContext();
    if (name.startsWith('@/')) {
      const loaded = loadSource(`${name.slice(2)}.ts`, env, hashCalls);
      if (name === '@/lib/password') {
        return { ...loaded, async hashPassword(password, salt) {
          hashCalls.push({ password, salt });
          return loaded.hashPassword(password, salt);
        } };
      }
      return loaded;
    }
    return require(name);
  };
  compileFunction(outputText, ['require', 'module', 'exports'])(localRequire, testModule, testModule.exports);
  return testModule.exports;
}

function database() {
  const sqlite = new DatabaseSync(':memory:');
  const binding = {
    prepare(sql) {
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async run() { return sqlite.prepare(sql).run(...parameters); },
        async first() { return sqlite.prepare(sql).get(...parameters) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...parameters) }; },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
  return { sqlite, binding };
}

function form(username, password) {
  const data = new FormData();
  data.set('username', username);
  data.set('password', password);
  return data;
}

const idle = { status: 'idle', message: '', records: [] };

await test('malformed and oversized credentials are rejected before DB access', async () => {
  const env = { DB: { prepare() { assert.fail('invalid input reached database work'); } } };
  const { login } = loadSource('app/actions.ts', env);
  const malformed = [new FormData(), form('', ''), form('   ', 'password'),
    form('u'.repeat(257), 'password'), form('student', 'p'.repeat(1025)),
    form(' '.repeat(257) + 'student', 'password')];
  for (const field of ['username', 'password']) {
    const upload = form('student', 'Training123!');
    upload.set(field, new Blob(['fictional']), 'credential.txt');
    malformed.push(upload);
    for (const duplicate of [field === 'username' ? 'student' : 'Training123!', 'extra', new Blob(['fictional'])]) {
      const data = form('student', 'Training123!');
      data.append(field, duplicate);
      malformed.push(data);
    }
  }
  for (const data of malformed) {
    const result = await login(idle, data);
    assert.equal(result.status, 'error');
  }
});

await test('valid credentials, trimming, exact password bytes, and parameterized queries remain intact', async (t) => {
  const secure = database();
  t.after(() => secure.sqlite.close());
  const env = { DB: secure.binding };
  const { login } = loadSource('app/actions.ts', env);
  const { hashPassword } = loadSource('lib/password.ts', env);
  const normal = form(' student ', 'Training123!');
  normal.set('$ACTION_ID_fixture', 'metadata');
  assert.equal((await login(idle, normal)).status, 'success');
  const wrong = await login(idle, form('student', 'wrong'));
  assert.equal(wrong.status, 'error');
  for (const data of [form('unknown', 'wrong'), form("' OR 1=1 --", 'wrong'),
    form('student', "' OR 1=1 --"), form('student', 'Training123! ')]) {
    assert.deepEqual(await login(idle, data), wrong);
  }
  const username = 'u'.repeat(256);
  const password = 'p'.repeat(1024);
  secure.sqlite.prepare('INSERT INTO users(username,password_hash,password_salt) VALUES(?,?,?)')
    .run(username, await hashPassword(password, 'fixture-salt'), 'fixture-salt');
  assert.equal((await login(idle, form(username, password))).status, 'success');
  const unicodePassword = ' päss🔒word ';
  secure.sqlite.prepare('INSERT INTO users(username,password_hash,password_salt) VALUES(?,?,?)')
    .run('équipe', await hashPassword(unicodePassword, 'unicode-fixture'), 'unicode-fixture');
  assert.equal((await login(idle, form(' équipe ', unicodePassword))).status, 'success');
  assert.equal((await login(idle, form('équipe', unicodePassword.trim()))).status, 'error');
});

await test('known and unknown failures perform equal credential hash work after admission', async (t) => {
  const secure = database();
  t.after(() => secure.sqlite.close());
  const hashCalls = [];
  const { login } = loadSource('app/actions.ts', { DB: secure.binding }, hashCalls);
  // Warm the database first; only fictional fixture credentials are observed.
  assert.equal((await login(idle, form('student', 'Training123!'))).status, 'success');
  hashCalls.length = 0;
  const known = await login(idle, form('student', 'wrong'));
  const knownWork = hashCalls.length;
  assert.equal(knownWork, 2); // Existing seed derivation plus submitted credential.
  assert.equal(hashCalls.at(-1).password, 'wrong');
  hashCalls.length = 0;
  assert.deepEqual(await login(idle, form('unknown', 'wrong')), known);
  assert.equal(hashCalls.length, knownWork);
  assert.equal(hashCalls.at(-1).password, 'wrong');
  assert.equal(secure.sqlite.prepare("SELECT count(*) AS count FROM users WHERE username='unknown'").get().count, 0);
  // Invalid requests and requests beyond the account budget still skip hashing.
  hashCalls.length = 0;
  assert.equal((await login(idle, form('', 'wrong'))).status, 'error');
  assert.equal(hashCalls.length, 0);
  for (let attempt = 0; attempt < 4; attempt++) await login(idle, form('unknown', 'wrong'));
  hashCalls.length = 0;
  assert.match((await login(idle, form('unknown', 'wrong'))).message, /Too many/);
  assert.equal(hashCalls.length, 0);
});
