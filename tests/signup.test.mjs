import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function database(path = ':memory:') {
  const sqlite = new DatabaseSync(path);
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

function form(username, password, confirmation = password) {
  const data = new FormData();
  data.set('username', username);
  data.set('password', password);
  data.set('confirmPassword', confirmation);
  return data;
}


const idle = { status: 'idle', message: '' };
const password = 'Fictional training phrase 🔐';

await test('signup rejects malformed, duplicate, uploaded, weak, and oversized fields before database access', async () => {
  let touched = 0;
  const { register } = loadSource('app/actions.ts', { DB: { prepare() { touched++; throw new Error('invalid input reached DB'); } } });
  const invalid = [new FormData(), form('', password), form('ab', password),
    form('u'.repeat(65), password), form(' '.repeat(257) + 'alice', password),
    form("' OR 1=1 --", password), form('user name', password),
    form('alice', 'too short'), form('alice', 'p'.repeat(1025)),
    form('alice', password, 'mismatch'), form('alice', password, 'p'.repeat(1025))];
  for (const field of ['username', 'password', 'confirmPassword']) {
    const upload = form('alice', password);
    upload.set(field, new Blob(['fixture']), 'credential.txt');
    invalid.push(upload);
    const duplicate = form('alice', password);
    duplicate.append(field, 'extra');
    invalid.push(duplicate);
  }
  for (const data of invalid) assert.equal((await register(idle, data)).status, 'error');
  assert.equal(touched, 0);
});

await test('signup persists unique salted hashes and returning login survives closing and reopening the database', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'signup-fixture-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'accounts.sqlite');
  let db = database(file);
  t.after(() => db.sqlite.close());
  let actions = loadSource('app/actions.ts', { DB: db.binding });
  const data = form(' alice.one ', password);
  data.set('$ACTION_ID_fixture', 'metadata');
  assert.equal((await actions.register(idle, data)).username, 'alice.one');
  assert.equal((await actions.register(idle, form('bob_two', password))).status, 'success');
  const rows = db.sqlite.prepare("SELECT username,password_hash,password_salt FROM users WHERE username != 'student' ORDER BY username").all();
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].password_salt, rows[1].password_salt);
  assert.notEqual(rows[0].password_hash, rows[1].password_hash);
  for (const row of rows) {
    assert.match(row.password_salt, /^[0-9a-f]{64}$/);
    assert.match(row.password_hash, /^[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(row), /Fictional training/);
  }
  db.sqlite.close();
  db = database(file);
  actions = loadSource('app/actions.ts', { DB: db.binding });
  assert.equal((await actions.login(idle, form('alice.one', password))).status, 'success');
  assert.equal((await actions.login(idle, form('bob_two', password))).status, 'success');
  assert.deepEqual(await actions.login(idle, form('alice.one', 'wrong')), await actions.login(idle, form('unknown', 'wrong')));
  assert.equal((await actions.login(idle, form('ALICE.ONE', password))).status, 'error');
});

await test('duplicate, simultaneous, and reserved demo signups never overwrite existing passwords', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const { register, login } = loadSource('app/actions.ts', { DB: db.binding });
  const results = await Promise.all([
    register(idle, form('same-user', password)), register(idle, form('same-user', 'A different training password')),
  ]);
  assert.equal(results.filter(result => result.status === 'success').length, 1);
  const before = db.sqlite.prepare("SELECT * FROM users WHERE username='same-user'").get();
  assert.equal((await register(idle, form(' same-user ', 'Replacement password'))).status, 'error');
  assert.deepEqual(db.sqlite.prepare("SELECT * FROM users WHERE username='same-user'").get(), before);
  assert.equal((await register(idle, form('student', password))).status, 'error');
  assert.equal((await login(idle, form('student', 'Training123!'))).status, 'success');
  assert.equal((await login(idle, form('same-user', password))).status, 'success');
});

await test('signup preserves exact password bytes including whitespace and Unicode', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const { register, login } = loadSource('app/actions.ts', { DB: db.binding });
  const exact = '  éducation 🔒 phrase  ';
  assert.equal((await register(idle, form('exact', exact))).status, 'success');
  assert.equal((await login(idle, form('exact', exact))).status, 'success');
  assert.equal((await login(idle, form('exact', exact.trim()))).status, 'error');
  assert.equal((await login(idle, form('exact', exact.normalize('NFD')))).status, 'error');
});

await test('shared signup quota blocks rotating usernames before hashing and does not block sign-in', async t => {
  const db = database(); t.after(() => db.sqlite.close());
  const hashCalls = [];
  const { register, login } = loadSource('app/actions.ts', { DB: db.binding }, hashCalls);
  for (let i = 0; i < 10; i++) assert.equal((await register(idle, form(`user-${i}`, password))).status, 'success');
  hashCalls.length = 0;
  const result = await register(idle, form('blocked-user', password));
  assert.match(result.message, /Too many account creation/);
  assert.equal(hashCalls.length, 0);
  const limit = db.sqlite.prepare('SELECT * FROM signup_attempt_limits').get();
  assert.equal(limit.attempts, 11);
  await register(idle, form('another-user', password));
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM signup_attempt_limits').get(), limit);
  assert.equal((await login(idle, form('user-0', password))).status, 'success');
  db.sqlite.prepare('UPDATE signup_attempt_limits SET expires_at = 0').run();
  assert.equal((await register(idle, form('after-cooldown', password))).status, 'success');
  assert.equal(db.sqlite.prepare('SELECT attempts FROM signup_attempt_limits').get().attempts, 1);
});

await test('signup database failures do not expose internal details or credentials', async () => {
  const { register } = loadSource('app/actions.ts', { DB: { prepare() { throw new Error('private database details'); } } });
  assert.deepEqual(await register(idle, form('alice', password)), {
    status: 'error', message: 'Account creation is temporarily unavailable. Try again later.',
  });
});
