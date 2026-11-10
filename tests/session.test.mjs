import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const COOKIE = '__Host-osl-session';
const LIFETIME = 8 * 60 * 60 * 1000;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const data = values => { const result = new FormData(); for (const [k, v] of Object.entries(values)) result.set(k, v); return result; };

// Real action/session modules, SQLite and a fixed clock; only framework bindings
// are substituted. Both logout entrypoints must revoke the same backend.
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let now = Date.parse('2026-11-10T12:00:00Z');
  let storeDown = false;
  let revokeDown = false;
  let origin = 'http://localhost:5179';
  const db = { prepare(sql) {
    if (revokeDown && /^DELETE FROM account_sessions WHERE token_hash = \?$/.test(sql.trim())) throw new Error('revocation unavailable');
    if (storeDown && /\baccount_sessions\b/.test(sql)) throw new Error('sensitive-session-store-error');
    let values = [];
    return { bind(...v) { values = v; return this; },
      async run() { return sqlite.prepare(sql).run(...values); },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    };
  } };
  const jar = new Map();
  const framework = {
    'next/headers': {
      cookies: async () => ({ get: name => jar.get(name), set: (name, value, options) => jar.set(name, { value, options }), delete: name => jar.delete(name) }),
      headers: async () => new Headers({ host: 'localhost:5179', ...(origin === null ? {} : { origin }) }),
    },
    'next/link': () => null,
    'next/navigation': { redirect(url) { throw Object.assign(new Error('redirect'), { redirectTo: url }); } },
  };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
    const mod = { exports: {} };
    const localRequire = name => name === 'cloudflare:workers' ? { env: { DB: db } }
      : name.startsWith('@/components/') ? new Proxy({}, { get: () => () => null })
      : framework[name] ?? (name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name));
    const Clock = class extends Date { static now() { return now; } };
    compileFunction(outputText, ['require', 'module', 'exports', 'Date', 'console'])(localRequire, mod, mod.exports, Clock, { info() {} });
    modules.set(path, mod.exports);
    return mod.exports;
  }
  const actions = load('app/session-actions.ts');
  const account = load('app/account-actions.ts');
  const session = load('lib/account-session.ts');
  async function redirectOf(promise) {
    try { await promise; } catch (error) { if (error.redirectTo) return error.redirectTo; throw error; }
    return null;
  }
  return {
    sqlite, jar, session, redirectOf,
    page: name => load(`app/${name}/page.tsx`).default(),
    advance(ms) { now += ms; }, now: () => now,
    sessionStore(up) { storeDown = !up; }, revokeStore(up) { revokeDown = !up; }, origin(value) { origin = value; },
    signIn(username = 'student', password = 'Training123!') { return actions.signIn({ status: 'idle', message: '' }, data({ username, password })); },
    signOut(entry = 'account', form = data({ csrfToken: sha256(`csrf:${jar.get(COOKIE)?.value ?? ''}`) })) { return entry === 'account' ? actions.signOut(form) : account.logout(form); },
    async read(token) { const previous = jar.get(COOKIE); if (token === undefined) jar.delete(COOKIE); else jar.set(COOKIE, { value: token }); try { return await session.getCurrentSession(); } finally { if (previous) jar.set(COOKIE, previous); else jar.delete(COOKIE); } },
    sessionRows: () => sqlite.prepare('SELECT * FROM account_sessions').all(),
  };
}

await test('login creates exactly one canonical credential-versioned session and a Secure Strict eight-hour cookie', async t => {
  const f = fixture(t);
  f.jar.set('osl_session', { value: 'a'.repeat(64) });
  assert.equal(await f.redirectOf(f.signIn(' student ')), '/account');
  const cookie = f.jar.get(COOKIE);
  assert.match(cookie.value, /^[a-f0-9]{64}$/);
  for (const [key, value] of Object.entries({ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 28800 })) assert.equal(cookie.options[key], value);
  assert.equal(cookie.options.expires.getTime(), f.now() + LIFETIME);
  const rows = f.sessionRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token_hash, sha256(cookie.value));
  assert.equal(rows[0].expires_at, f.now() + LIFETIME);
  assert.ok(rows[0].credential_version);
  assert.ok(!JSON.stringify(rows).includes(cookie.value));
  assert.equal((await f.read(cookie.value)).username, 'student');
  assert.ok(!f.jar.get('osl_session')?.value, 'legacy cookie is cleared, never issued');
  assert.equal(f.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='sessions'").get(), undefined, 'there is no second session store');
});

await test('failed, malformed and throttled logins issue no cookies', async t => {
  const f = fixture(t);
  assert.equal((await f.signIn('student', 'wrong')).message, 'The username or password is incorrect.');
  assert.equal((await f.signIn('nobody')).status, 'error');
  assert.equal((await f.signIn('   ', 'x')).message, 'Enter both a username and password.');
  for (let i = 0; i < 4; i++) await f.signIn('student', 'wrong');
  assert.equal((await f.signIn()).message, 'Too many login attempts. Try again in a minute.');
  assert.equal(f.jar.size, 0);
});

await test('missing, malformed, unknown, tampered and expired tokens fail closed', async t => {
  const f = fixture(t);
  for (const token of [undefined, 'not-a-token', "' OR 1=1 --", 'a'.repeat(64)]) assert.equal(await f.read(token), null);
  await f.redirectOf(f.signIn());
  const token = f.jar.get(COOKIE).value;
  assert.equal(await f.read((token[0] === 'a' ? 'b' : 'a') + token.slice(1)), null);
  f.advance(LIFETIME - 1);
  assert.ok(await f.read(token));
  f.advance(1);
  assert.equal(await f.read(token), null, 'expiry is exclusive at exactly eight hours');
});

for (const entry of ['account', 'dashboard']) {
  await test(`${entry} logout revokes canonical token and clears both cookies`, async t => {
    const f = fixture(t);
    await f.redirectOf(f.signIn());
    const token = f.jar.get(COOKIE).value;
    f.jar.set('osl_session', { value: 'b'.repeat(64) });
    assert.equal(await f.redirectOf(f.signOut(entry)), '/');
    assert.ok(!f.jar.get(COOKIE)?.value);
    assert.ok(!f.jar.get('osl_session')?.value);
    assert.equal(await f.read(token), null, 'copied token must not authenticate either page');
    assert.equal(f.sessionRows().length, 0);
  });
  await test(`${entry} logout clears browser state even when the canonical store is unavailable`, async t => {
    const f = fixture(t);
    await f.redirectOf(f.signIn());
    const token = f.jar.get(COOKIE).value;
    f.sessionStore(false);
    assert.equal(await f.redirectOf(f.signOut(entry)), '/');
    assert.ok(!f.jar.get(COOKIE)?.value);
    f.sessionStore(true);
    f.advance(LIFETIME);
    assert.equal(await f.read(token), null);
  });
  await test(`${entry} logout rejects absent, wrong, duplicate CSRF and cross-origin requests`, async t => {
    const f = fixture(t);
    await f.redirectOf(f.signIn());
    const token = f.jar.get(COOKIE).value;
    const duplicate = data({ csrfToken: sha256(`csrf:${token}`) }); duplicate.append('csrfToken', duplicate.get('csrfToken'));
    for (const form of [new FormData(), data({ csrfToken: 'f'.repeat(64) }), duplicate]) assert.equal(await f.redirectOf(f.signOut(entry, form)), null);
    for (const origin of [null, 'null', 'https://attacker.test']) { f.origin(origin); assert.equal(await f.redirectOf(f.signOut(entry)), null); }
    assert.ok(await f.read(token));
  });
}

await test('re-login revokes the replaced token but leaves another browser signed in', async t => {
  const f = fixture(t);
  await f.redirectOf(f.signIn()); const first = f.jar.get(COOKIE).value;
  await f.redirectOf(f.signIn()); const second = f.jar.get(COOKIE).value;
  assert.notEqual(first, second); assert.equal(await f.read(first), null); assert.equal(f.sessionRows().length, 1);
  f.jar.clear(); await f.redirectOf(f.signIn()); const other = f.jar.get(COOKIE).value;
  assert.equal(f.sessionRows().length, 2); assert.ok(await f.read(second));
  await f.redirectOf(f.signOut()); assert.equal(await f.read(other), null); assert.ok(await f.read(second));
});

await test('credential version change invalidates every canonical browser session and legacy cookies never authenticate', async t => {
  const f = fixture(t);
  await f.redirectOf(f.signIn()); const first = f.jar.get(COOKIE).value;
  f.jar.clear(); await f.redirectOf(f.signIn()); const second = f.jar.get(COOKIE).value;
  f.sqlite.exec("UPDATE account_security SET credential_version='reset-version'");
  assert.equal(await f.read(first), null); assert.equal(await f.read(second), null);
  f.jar.clear(); f.jar.set('osl_session', { value: first }); assert.equal(await f.session.getCurrentSession(), null);
});

await test('login fails cleanly without issuing a cookie when the canonical store is down', async t => {
  const f = fixture(t); f.sessionStore(false);
  assert.deepEqual(await f.signIn(), { status: 'error', message: 'Login is temporarily unavailable. Try again later.' });
  assert.equal(f.jar.size, 0);
});

await test('creating a session removes expired rows in bounded batches', async t => {
  const f = fixture(t); await f.redirectOf(f.signIn());
  const row = f.sessionRows()[0];
  f.sqlite.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<150)
    INSERT INTO account_sessions(token_hash,user_id,credential_version,expires_at) SELECT printf('old%03d',i),?,?,1 FROM n`).run(row.user_id, row.credential_version);
  await f.redirectOf(f.signIn());
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM account_sessions WHERE token_hash LIKE 'old%'").get().n, 50);
});

await test('both private page entrypoints reject sessions after credential recovery changes the version', async t => {
  const f = fixture(t);
  await f.redirectOf(f.signIn());
  for (const page of ['account', 'dashboard']) assert.equal(await f.redirectOf(f.page(page)), null, `${page} initially authenticated`);
  f.sqlite.exec("UPDATE account_security SET credential_version='recovered-version'");
  for (const page of ['account', 'dashboard']) assert.equal(await f.redirectOf(f.page(page)), '/', `${page} must reject pre-reset credentials`);
});

await test('failed revocation of the previous token prevents issuing a replacement session', async t => {
  const f = fixture(t);
  await f.redirectOf(f.signIn());
  const cookie = f.jar.get(COOKIE);
  const rows = f.sessionRows();
  f.revokeStore(false);
  assert.deepEqual(await f.signIn(), { status: 'error', message: 'Login is temporarily unavailable. Try again later.' });
  assert.deepEqual(f.sessionRows(), rows, 'No replacement row may be inserted before successful revocation');
  assert.deepEqual(f.jar.get(COOKIE), cookie, 'A failed replacement must not change the browser cookie');
  assert.ok(await f.read(cookie.value), 'The original session remains intact');
});
