import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Runs the real session actions against in-memory SQLite, a fixed clock, and
// stand-ins for the framework's cookies(), headers() and redirect().
function fixture(t, origin = 'http://localhost:5179') {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-10T12:00:00Z');
  const db = { prepare(sql) {
    let values = [];
    return { bind(...v) { values = v; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    };
  } };
  const jar = new Map();
  const cookieStore = {
    get(name) { return jar.has(name) ? { name, value: jar.get(name).value } : undefined; },
    set(name, value, options) { jar.set(name, { value, options }); },
    delete(name) { jar.delete(name); },
  };
  const framework = {
    'next/headers': {
      cookies: async () => cookieStore,
      headers: async () => new Headers(origin ? { origin } : {}),
    },
    'next/navigation': { redirect(url) { throw Object.assign(new Error('redirect'), { redirectTo: url }); } },
  };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    const localRequire = (name) => name === 'cloudflare:workers' ? { env: { DB: db } }
      : framework[name] ?? (name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name));
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console'])(
      localRequire, testModule, testModule.exports, Clock, { info() {} });
    modules.set(path, testModule.exports);
    return testModule.exports;
  }
  const actions = load('app/session-actions.ts');
  const session = load('lib/session.ts');
  async function redirectOf(promise) {
    try { await promise; } catch (error) { if (error.redirectTo) return error.redirectTo; throw error; }
    return null;
  }
  return {
    sqlite, jar, session, db, redirectOf,
    advance(ms) { now += ms; },
    now: () => now,
    signIn(username, password) {
      const form = new FormData(); form.set('username', username); form.set('password', password);
      return actions.signIn({ status: 'idle', message: '' }, form);
    },
    signOut: () => actions.signOut(),
    sessionRows: () => {
      const exists = sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'sessions'").get().n;
      return exists ? sqlite.prepare('SELECT * FROM sessions').all() : [];
    },
  };
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

await test('valid login starts a server-side session, stores only a digest, and redirects to /account', async (t) => {
  const f = fixture(t);
  assert.equal(await f.redirectOf(f.signIn(' student ', 'Training123!')), '/account');

  const cookie = f.jar.get('osl_session');
  assert.match(cookie.value, /^[0-9a-f]{64}$/);
  assert.deepEqual(cookie.options, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 1800 });

  const rows = f.sessionRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha256(cookie.value));
  assert.equal(rows[0].username, 'student');
  assert.equal(rows[0].expires_at - rows[0].created_at, 30 * 60 * 1000);
  assert.ok(!JSON.stringify(rows).includes(cookie.value), 'the raw token must not be stored');

  assert.deepEqual(await f.session.readSession(f.db, cookie.value, f.now()), { username: 'student', expiresAt: f.now() + 1_800_000 });
});

await test('the session cookie is Secure for https and for an unknown origin', async (t) => {
  for (const origin of ['https://example.test', null, 'http://evil.localhost.example']) {
    const f = fixture(t, origin);
    assert.equal(await f.redirectOf(f.signIn('student', 'Training123!')), '/account');
    assert.equal(f.jar.get('osl_session').options.secure, true, `origin ${origin}`);
  }
});

await test('failed, malformed and throttled logins start no session', async (t) => {
  const f = fixture(t);
  assert.deepEqual(await f.signIn('student', 'wrong'), { status: 'error', message: 'The username or password is incorrect.' });
  assert.deepEqual(await f.signIn('nobody', 'Training123!'), { status: 'error', message: 'The username or password is incorrect.' });
  // Blank input is rejected before the rate limiter and does not count as an attempt.
  assert.equal((await f.signIn('   ', 'x')).message, 'Enter both a username and password.');
  for (let i = 0; i < 4; i++) await f.signIn('student', 'wrong');
  // Sixth attempt for `student` inside the window: throttled even with the right password.
  assert.deepEqual(await f.signIn('student', 'Training123!'), { status: 'error', message: 'Too many login attempts. Try again in a minute.' });
  assert.equal(f.jar.size, 0);
  assert.equal(f.sessionRows().length, 0);
});

await test('missing, malformed, unknown and expired tokens are rejected; expired rows are removed', async (t) => {
  const f = fixture(t);
  const { readSession } = f.session;
  assert.equal(await readSession(f.db, undefined), null);
  assert.equal(await readSession(f.db, 'not-a-token'), null);
  assert.equal(await readSession(f.db, "' OR 1=1 --"), null);
  assert.equal(await readSession(f.db, 'a'.repeat(64)), null, 'a well-formed but unknown token');

  await f.redirectOf(f.signIn('student', 'Training123!'));
  const token = f.jar.get('osl_session').value;
  const tampered = (token[0] === 'a' ? 'b' : 'a') + token.slice(1);
  assert.equal(await readSession(f.db, tampered, f.now()), null);

  assert.notEqual(await readSession(f.db, token, f.now() + 1_799_999), null, 'still valid just before expiry');
  assert.equal(await readSession(f.db, token, f.now() + 1_800_000), null, 'expired exactly at 30 minutes');
  assert.equal(f.sessionRows().length, 0, 'the expired row is deleted');
});

await test('logout deletes the server-side session and the cookie, so the old token stops working', async (t) => {
  const f = fixture(t);
  await f.redirectOf(f.signIn('student', 'Training123!'));
  const token = f.jar.get('osl_session').value;

  assert.equal(await f.redirectOf(f.signOut()), '/');
  assert.equal(f.jar.has('osl_session'), false);
  assert.equal(f.sessionRows().length, 0);
  assert.equal(await f.session.readSession(f.db, token, f.now()), null, 'a copied cookie is useless after logout');

  // Logging out again without a cookie is harmless.
  assert.equal(await f.redirectOf(f.signOut()), '/');
});

await test('each login gets its own token, and logging out one leaves the other valid', async (t) => {
  const f = fixture(t);
  await f.redirectOf(f.signIn('student', 'Training123!'));
  const first = f.jar.get('osl_session').value;
  await f.redirectOf(f.signIn('student', 'Training123!'));
  const second = f.jar.get('osl_session').value;
  assert.notEqual(first, second);
  assert.equal(f.sessionRows().length, 2);

  await f.redirectOf(f.signOut());
  assert.equal(await f.session.readSession(f.db, second, f.now()), null);
  assert.equal((await f.session.readSession(f.db, first, f.now())).username, 'student');
});

await test('creating a session removes expired rows in bounded batches', async (t) => {
  const f = fixture(t);
  await f.redirectOf(f.signIn('student', 'Training123!'));
  f.sqlite.exec(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 150)
    INSERT INTO sessions (token_hash, username, created_at, expires_at) SELECT printf('old%03d', i), 'student', 0, 1 FROM n`);
  await f.session.createSession(f.db, 'student', f.now());
  const remaining = f.sqlite.prepare("SELECT count(*) AS n FROM sessions WHERE token_hash LIKE 'old%'").get().n;
  assert.equal(remaining, 50, 'at most 100 expired rows are removed per new session');
});
