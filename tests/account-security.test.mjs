import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const idle = { status: 'idle', message: '' };
const password = '  Fictional éducation 🔐 phrase  ';
function form(values) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  const context = { headers: new Headers({ origin: 'https://accounts.test', host: 'accounts.test' }),
    jar: new Map(), writes: [], fail: null, before: null };
  const binding = {
    prepare(sql) {
      let parameters = [];
      function execute(mode) {
        context.before?.(sql);
        if (context.fail?.(sql)) throw new Error('private database fixture failure');
        return sqlite.prepare(sql)[mode](...parameters);
      }
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return execute('get') ?? null; },
        async all() { return { results: execute('all') }; },
        async run() { return execute('run'); },
        batchRun() { return { results: execute('all') }; },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.batchRun());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const testModule = { exports: {} };
    cache.set(path, testModule.exports);
    const localRequire = name => {
      if (name === 'cloudflare:workers') return { env: { DB: binding } };
      if (name === 'next/headers') return {
        headers: async () => context.headers,
        cookies: async () => ({
          get: name => context.jar.has(name) ? { value: context.jar.get(name) } : undefined,
          set(name, value, options) { context.jar.set(name, value); context.writes.push({ name, value, options }); },
        }),
      };
      if (name === 'next/navigation') return { redirect(location) { throw new Error(`REDIRECT:${location}`); } };
      if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
      return require(name);
    };
    compileFunction(outputText, ['require', 'module', 'exports'])(localRequire, testModule, testModule.exports);
    cache.set(path, testModule.exports);
    return testModule.exports;
  }
  const session = load('lib/account-session.ts');
  const actions = load('app/account-actions.ts');
  const credentials = load('lib/password.ts');
  async function seed(username = 'alice') {
    const salt = session.randomSecret();
    const hash = await credentials.hashPassword(password, salt);
    const row = sqlite.prepare('INSERT INTO users (username,password_hash,password_salt) VALUES (?,?,?) RETURNING id').get(username, hash, salt);
    await session.startSession(row.id, hash);
    return row.id;
  }
  async function enroll() {
    const current = await session.getCurrentSession();
    return actions.createRecoveryKey(idle, form({ currentPassword: password, csrfToken: current.csrfToken }));
  }
  function reset(key, next = 'Replacement fictional password', username = 'alice') {
    return actions.recoverPassword(idle, form({ username, recoveryKey: key, newPassword: next, confirmPassword: next }));
  }
  return { sqlite, binding, context, session, actions, credentials, seed, enroll, reset, load };
}

await test('sessions use secure cookies and hashed random tokens, rotate, expire, and cannot select another identity', async t => {
  const f = fixture(t);
  const alice = await f.seed();
  const first = f.context.jar.get(f.session.SESSION_COOKIE);
  assert.match(first, /^[a-f0-9]{64}$/);
  const stored = f.sqlite.prepare('SELECT * FROM account_sessions').get();
  assert.equal(stored.token_hash, await f.session.digestSecret(first));
  assert.notEqual(stored.token_hash, first);
  const { options } = f.context.writes.at(-1);
  assert.equal(options.secure, true); assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'strict'); assert.equal(options.path, '/');
  assert.equal(options.domain, undefined); assert.equal(options.maxAge, 8 * 60 * 60);
  assert.equal((await f.session.getCurrentSession()).userId, alice);
  const hash = f.sqlite.prepare('SELECT password_hash FROM users WHERE id=?').get(alice).password_hash;
  await f.session.startSession(alice, hash);
  assert.notEqual(f.context.jar.get(f.session.SESSION_COOKIE), first);
  const second = f.context.jar.get(f.session.SESSION_COOKIE);
  f.context.jar.set(f.session.SESSION_COOKIE, first);
  assert.equal(await f.session.getCurrentSession(), null);
  for (const forged of ['alice', JSON.stringify({ userId: alice }), 'a'.repeat(64), `${second}x`]) {
    f.context.jar.set(f.session.SESSION_COOKIE, forged);
    assert.equal(await f.session.getCurrentSession(), null);
  }
  f.context.jar.set(f.session.SESSION_COOKIE, second);
  f.sqlite.exec('UPDATE account_sessions SET expires_at=0');
  assert.equal(await f.session.getCurrentSession(), null);
  await assert.rejects(f.session.startSession(alice, 'stale-password-hash'), /Credentials changed/);
});

await test('origin checks fail closed for missing, malformed, foreign, forwarded, insecure and noncanonical origins', async t => {
  const f = fixture(t);
  for (const origin of [null, '', 'null', 'garbage', 'https://evil.test', 'https://accounts.test.evil.test',
    'https://accounts.test/', 'https://accounts.test/path', 'https://user@accounts.test', 'http://accounts.test',
    'https://accounts.test https://evil.test']) {
    f.context.headers = new Headers({ host: 'accounts.test', 'x-forwarded-host': 'evil.test' });
    if (origin !== null) f.context.headers.set('origin', origin);
    assert.equal(await f.session.isSameOriginRequest(), false, String(origin));
  }
  f.context.headers = new Headers({ origin: 'https://accounts.test' });
  assert.equal(await f.session.isSameOriginRequest(), false);
  f.context.headers = new Headers({ origin: 'https://accounts.test', host: 'accounts.test' });
  assert.equal(await f.session.isSameOriginRequest(), true);
});

await test('enrollment requires live session, same origin, exact current password and session CSRF; demo is excluded', async t => {
  const f = fixture(t);
  assert.equal((await f.actions.createRecoveryKey(idle, form({ currentPassword: password, csrfToken: 'a'.repeat(64) }))).status, 'error');
  await f.seed();
  const current = await f.session.getCurrentSession();
  for (const csrfToken of [undefined, '', 'a'.repeat(64)]) {
    const data = form({ currentPassword: password });
    if (csrfToken !== undefined) data.set('csrfToken', csrfToken);
    assert.equal((await f.actions.createRecoveryKey(idle, data)).status, 'error');
  }
  for (const wrong of [password.trim(), password.normalize('NFD')]) {
    assert.equal((await f.actions.createRecoveryKey(idle, form({ currentPassword: wrong, csrfToken: current.csrfToken }))).status, 'error');
  }
  f.context.headers.set('origin', 'https://evil.test');
  assert.equal((await f.enroll()).status, 'error');
  f.context.headers.set('origin', 'https://accounts.test');
  assert.equal((await f.enroll()).status, 'success');
  await f.seed('student');
  assert.match((await f.enroll()).message, /demo account cannot/);
});

await test('recovery key rotation stores only a hash; reset consumes it, preserves exact passwords and invalidates every session', async t => {
  const f = fixture(t);
  const id = await f.seed();
  const old = await f.enroll();
  const replacement = await f.enroll();
  assert.equal(old.status, 'success'); assert.equal(replacement.status, 'success');
  assert.notEqual(old.recoveryKey, replacement.recoveryKey);
  assert.equal(f.sqlite.prepare('SELECT recovery_hash FROM account_security').get().recovery_hash,
    await f.session.digestSecret(replacement.recoveryKey));
  assert.equal((await f.reset(old.recoveryKey)).status, 'error');
  const token1 = f.context.jar.get(f.session.SESSION_COOKIE);
  f.context.jar.clear();
  const before = f.sqlite.prepare('SELECT * FROM users WHERE id=?').get(id);
  await f.session.startSession(id, before.password_hash);
  const token2 = f.context.jar.get(f.session.SESSION_COOKIE);
  const exact = '  Replacement éducation 🔐  ';
  assert.equal((await f.reset(replacement.recoveryKey, exact)).status, 'success');
  for (const token of [token1, token2]) {
    f.context.jar.set(f.session.SESSION_COOKIE, token);
    assert.equal(await f.session.getCurrentSession(), null);
  }
  const after = f.sqlite.prepare('SELECT * FROM users WHERE id=?').get(id);
  assert.notEqual(after.password_salt, before.password_salt);
  assert.equal(after.password_hash, await f.credentials.hashPassword(exact, after.password_salt));
  assert.notEqual(after.password_hash, await f.credentials.hashPassword(exact.trim(), after.password_salt));
  assert.notEqual(after.password_hash, await f.credentials.hashPassword(exact.normalize('NFD'), after.password_salt));
  assert.equal(f.sqlite.prepare('SELECT recovery_hash FROM account_security').get().recovery_hash, null);
  assert.equal((await f.reset(replacement.recoveryKey)).status, 'error');
  await assert.rejects(f.session.startSession(id, before.password_hash), /Credentials changed/);
});

await test('concurrent recovery admits only one winner for a single key', async t => {
  const f = fixture(t); await f.seed();
  const key = (await f.enroll()).recoveryKey;
  const passwords = ['First fictional replacement', 'Second fictional replacement'];
  const results = await Promise.all(passwords.map(next => f.reset(key, next)));
  assert.equal(results.filter(result => result.status === 'success').length, 1);
  const winner = passwords[results.findIndex(result => result.status === 'success')];
  const user = f.sqlite.prepare('SELECT * FROM users').get();
  assert.equal(user.password_hash, await f.credentials.hashPassword(winner, user.password_salt));
});

await test('recovery database batch failure rolls back password and key; responses hide database details', async t => {
  const f = fixture(t); await f.seed();
  const key = (await f.enroll()).recoveryKey;
  const before = f.sqlite.prepare('SELECT * FROM users').get();
  const security = f.sqlite.prepare('SELECT * FROM account_security').get();
  f.context.fail = sql => sql.startsWith('UPDATE account_security SET recovery_hash = NULL');
  const result = await f.reset(key);
  assert.equal(result.status, 'error'); assert.match(result.message, /temporarily unavailable/);
  assert.doesNotMatch(JSON.stringify(result), /private database|Fictional/);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM users').get(), before);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM account_security').get(), security);
  f.context.fail = null;
  assert.ok(await f.session.getCurrentSession());
  assert.equal((await f.reset(key)).status, 'success');
});

await test('logout requires same-origin session CSRF, revokes server-side and clears secure cookie', async t => {
  const f = fixture(t); await f.seed();
  const current = await f.session.getCurrentSession();
  await f.actions.logout(form({ csrfToken: 'a'.repeat(64) }));
  assert.ok(await f.session.getCurrentSession());
  f.context.headers.delete('origin');
  await f.actions.logout(form({ csrfToken: current.csrfToken }));
  assert.ok(await f.session.getCurrentSession());
  f.context.headers.set('origin', 'https://accounts.test');
  await assert.rejects(f.actions.logout(form({ csrfToken: current.csrfToken })), /REDIRECT:\//);
  assert.equal(await f.session.getCurrentSession(), null);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM account_sessions').get().n, 0);
  assert.equal(f.context.writes.at(-1).options.maxAge, 0);
  assert.equal(f.context.writes.at(-1).options.secure, true);
});

await test('recovery quotas are atomic, bounded, independent of login and stop account rotation', async t => {
  const f = fixture(t);
  const { reserveRecoveryAttempt } = f.load('lib/recovery-security.ts');
  const results = await Promise.all(Array.from({ length: 8 }, () => reserveRecoveryAttempt(f.binding, 'alice')));
  assert.equal(results.filter(Boolean).length, 5);
  assert.equal(f.sqlite.prepare("SELECT attempts FROM recovery_attempt_limits WHERE scope != 'global'").get().attempts, 6);
  assert.equal(await reserveRecoveryAttempt(f.binding, 'bob'), true);
  assert.equal(await reserveRecoveryAttempt(f.binding, 'charlie'), true);
  assert.equal(await reserveRecoveryAttempt(f.binding, 'dave'), false);
  const before = f.sqlite.prepare("SELECT * FROM recovery_attempt_limits WHERE scope='global'").get();
  assert.equal(await reserveRecoveryAttempt(f.binding, 'eve'), false);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM recovery_attempt_limits WHERE scope='global'").get(), before);
  assert.equal(await f.load('lib/login-security.ts').reserveLoginAttempt(f.binding, 'alice'), true);
  f.sqlite.exec('UPDATE recovery_attempt_limits SET expires_at=0');
  assert.equal(await reserveRecoveryAttempt(f.binding, 'alice'), true);
});

await test('malformed recovery fields reject before database work, including duplicate or uploaded credentials', async t => {
  const f = fixture(t);
  const valid = { username: 'alice', recoveryKey: 'a'.repeat(64), newPassword: password, confirmPassword: password };
  let accesses = 0;
  f.context.before = () => { accesses++; };
  const invalid = [new FormData(), form({ ...valid, username: ' '.repeat(257) }),
    form({ ...valid, recoveryKey: 'A'.repeat(64) }), form({ ...valid, recoveryKey: 'a'.repeat(63) }),
    form({ ...valid, newPassword: 'short', confirmPassword: 'short' }),
    form({ ...valid, newPassword: 'p'.repeat(1025), confirmPassword: 'p'.repeat(1025) }),
    form({ ...valid, confirmPassword: 'different phrase' })];
  for (const field of Object.keys(valid)) {
    const duplicate = form(valid); duplicate.append(field, valid[field]); invalid.push(duplicate);
    const upload = form(valid); upload.set(field, new Blob(['fictional']), 'fixture.txt'); invalid.push(upload);
  }
  for (const data of invalid) assert.equal((await f.actions.recoverPassword(idle, data)).status, 'error');
  assert.equal(accesses, 0);
  f.context.headers.delete('origin');
  assert.equal((await f.actions.recoverPassword(idle, form(valid))).status, 'error');
  f.context.headers.set('origin', 'https://evil.test');
  assert.equal((await f.actions.recoverPassword(idle, form(valid))).status, 'error');
  assert.equal(accesses, 0);
});

await test('enrollment write rechecks session revocation, expiry and password change races', async t => {
  for (const mutation of [
    'DELETE FROM account_sessions',
    'UPDATE account_sessions SET expires_at=0',
    "UPDATE users SET password_hash='changed-by-concurrent-reset'",
    "UPDATE account_security SET credential_version='changed-by-concurrent-reset'",
  ]) {
    const f = fixture(t); await f.seed();
    f.context.before = sql => {
      if (sql.startsWith('UPDATE account_security SET recovery_hash = ?')) {
        f.context.before = null;
        f.sqlite.exec(mutation);
      }
    };
    assert.equal((await f.enroll()).status, 'error');
    assert.equal(f.sqlite.prepare('SELECT recovery_hash FROM account_security').get().recovery_hash, null);
  }
});

await test('demo recovery cannot change shared credentials even if a recovery hash exists', async t => {
  const f = fixture(t); await f.seed('student');
  const key = f.session.randomSecret();
  f.sqlite.prepare('UPDATE account_security SET recovery_hash=?').run(await f.session.digestSecret(key));
  const before = f.sqlite.prepare('SELECT * FROM users').get();
  const result = await f.reset(key, 'Fictional replacement password', 'student');
  assert.equal(result.status, 'error');
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM users').get(), before);
});

await test('unknown users and incorrect recovery keys have the same denial; password checks throttle before enrollment', async t => {
  const f = fixture(t); await f.seed();
  assert.deepEqual(await f.reset('a'.repeat(64)), await f.reset('a'.repeat(64), password, 'unknown'));
  const current = await f.session.getCurrentSession();
  for (let i = 0; i < 5; i++) {
    assert.match((await f.actions.createRecoveryKey(idle, form({ currentPassword: 'wrong', csrfToken: current.csrfToken }))).message, /incorrect/);
  }
  assert.match((await f.enroll()).message, /Too many password checks/);
  assert.equal(f.sqlite.prepare('SELECT recovery_hash FROM account_security').get().recovery_hash, null);
});

await test('database unavailability never authenticates or reports successful enrollment or recovery', async t => {
  const f = fixture(t); await f.seed();
  const current = await f.session.getCurrentSession();
  f.context.fail = () => true;
  await assert.rejects(f.session.getCurrentSession());
  const result = await f.actions.createRecoveryKey(idle, form({ currentPassword: password, csrfToken: current.csrfToken }));
  assert.equal(result.status, 'error'); assert.match(result.message, /temporarily unavailable/);
  const reset = await f.reset('a'.repeat(64));
  assert.equal(reset.status, 'error'); assert.match(reset.message, /temporarily unavailable/);
});
