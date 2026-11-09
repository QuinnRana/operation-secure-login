import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const bundle = await build({
  stdin: { contents: `
    import { login, register } from './app/actions';
    import { vulnerableLogin } from './app/attack-lab/actions';
    import { createRecoveryKey, recoverPassword, logout } from './app/account-actions';
    import { getCurrentSession } from './lib/account-session';
    import { hashPassword } from './lib/password';
    // Match production's Web Crypto limit even when local workerd permits more.
    Object.defineProperty(crypto.subtle, 'deriveBits', { value: () => {
      throw new DOMException('PBKDF2 iteration counts above 100000 are not supported', 'NotSupportedError');
    }});
    import { withRequest } from './tests/worker-request-context.mjs';
    export default { async fetch(request) { return withRequest(request, async () => {
      const path = new URL(request.url).pathname;
      if (path === '/hash') return Response.json(await hashPassword('päss🔒word', 'fixture-salt'));
      if (path === '/session') return Response.json(await getCurrentSession());
      const data = await request.formData();
      if (path === '/recovery-key') return Response.json(await createRecoveryKey({}, data));
      if (path === '/recover') return Response.json(await recoverPassword({}, data));
      if (path === '/logout') {
        try { await logout(data); } catch (response) { if (response instanceof Response) return response; throw response; }
        return new Response(null, { status: 204 });
      }
      return Response.json(await (path === '/lab' ? vulnerableLogin : path === '/signup' ? register : login)({}, data));
    }); }};
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  external: ['cloudflare:workers', 'node:async_hooks'],
    alias: { 'next/headers': './tests/worker-request-context.mjs', 'next/navigation': './tests/worker-navigation.mjs' },
});

async function submit(runtime, path, username, password) {
  const body = new URLSearchParams({ username, password, confirmPassword: password });
  const response = await runtime.dispatchFetch(`http://localhost${path}`, { method: 'POST', body, headers: { origin: 'http://localhost' } });
  assert.equal(response.status, 200);
  return response.json();
}

await test('Workers runtime preserves hashes, secure login and isolated classroom baseline', async (t) => {
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'secure-fixture', LAB_DB: 'lab-fixture' } });
  t.after(() => runtime.dispose());
  const hashResponse = await runtime.dispatchFetch('http://localhost/hash');
  assert.equal(hashResponse.status, 200);
  assert.equal(await hashResponse.json(), pbkdf2Sync('päss🔒word', 'fixture-salt', 120_000, 32, 'sha256').toString('hex'));
  assert.equal((await submit(runtime, '/', 'student', 'Training123!')).status, 'success');
  assert.equal((await submit(runtime, '/', 'student', 'wrong')).status, 'error');
  assert.equal((await submit(runtime, '/', 'u'.repeat(257), 'wrong')).status, 'error');
  assert.equal((await submit(runtime, '/lab', 'alex', 'falcon7')).records.length, 1);
  assert.equal((await submit(runtime, '/lab', 'alex', 'wrong')).status, 'error');
  assert.equal((await submit(runtime, '/lab', "' OR 1=1 --", 'test')).records.length, 3);
  assert.equal((await submit(runtime, '/lab', "' UNION SELECT username,password_hash,password_salt FROM users --", 'test')).status, 'error');
  const secure = await runtime.getD1Database('DB');
  assert.equal(await secure.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
});

await test('Workers runtime with production bindings disables the lab', async (t) => {
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'secure-only-fixture' } });
  t.after(() => runtime.dispose());
  const result = await submit(runtime, '/lab', "' OR 1=1 --", 'test');
  assert.equal(result.status, 'error');
  assert.deepEqual(result.records, []);
  assert.equal(result.query, undefined);
});

await test('concurrent requests across Workers share an atomic account budget', async (t) => {
  const runtime = new Miniflare({ workers: ['limiter-a', 'limiter-b'].map(name => ({
    name, modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'shared-rate-limit-fixture' },
  })) });
  t.after(() => runtime.dispose());
  const workers = await Promise.all(['limiter-a', 'limiter-b'].map(name => runtime.getWorker(name)));
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    submit({ dispatchFetch: (...args) => workers[i % 2].fetch(...args) }, '/', i % 2 ? ' student ' : 'student', 'wrong')));
  assert.equal(results.filter(result => result.message === 'The username or password is incorrect.').length, 5);
  assert.equal(results.filter(result => result.message === 'Too many login attempts. Try again in a minute.').length, 15);
  const result = await submit({ dispatchFetch: (...args) => workers[1].fetch(...args) }, '/', 'student', 'Training123!');
  assert.match(result.message, /Too many/);
});


await test('Workers signup persists across runtime restart and never reaches the isolated lab', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'worker-signup-'));
  const options = { modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: { DB: 'signup-secure', LAB_DB: 'signup-lab' }, d1Persist: directory };
  let runtime = new Miniflare(options);
  t.after(async () => { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); });
  const password = 'Workers training phrase 🔒';
  const created = await submit(runtime, '/signup', 'returning-student', password);
  assert.equal(created.status, 'success');
  assert.equal(created.username, 'returning-student');
  assert.equal((await submit(runtime, '/signup', 'returning-student', 'New competing phrase')).status, 'error');
  const secure = await runtime.getD1Database('DB');
  const account = await secure.prepare("SELECT * FROM users WHERE username='returning-student'").first();
  assert.match(account.password_salt, /^[0-9a-f]{64}$/);
  assert.equal(account.password_hash, pbkdf2Sync(password, account.password_salt, 120_000, 32, 'sha256').toString('hex'));
  await runtime.dispose();
  runtime = new Miniflare(options);
  assert.equal((await submit(runtime, '/', 'returning-student', password)).status, 'success');
  assert.equal((await submit(runtime, '/', 'returning-student', 'wrong')).status, 'error');
  const probe = await submit(runtime, '/lab', "' UNION SELECT username,password_hash,password_salt FROM users --", 'test');
  assert.equal(probe.status, 'error');
  assert.deepEqual(probe.records, []);
  assert.equal((await submit(runtime, '/', 'returning-student', password)).status, 'success');
});


await test('Workers sessions persist and recovery is atomic, one-time, isolated and CSRF protected', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'worker-private-account-'));
  const options = { modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'private-secure', LAB_DB: 'private-lab' }, d1Persist: directory };
  let runtime = new Miniflare(options);
  t.after(async () => { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); });
  const password = 'A private training password 🔒';
  const username = 'private-student';
  const request = (path, values, cookie = '', origin = 'https://portal.test') => runtime.dispatchFetch(`https://portal.test${path}`, {
    method: values ? 'POST' : 'GET', headers: { origin, cookie }, body: values ? new URLSearchParams(values) : undefined,
    redirect: 'manual',
  });
  assert.equal((await (await request('/signup', { username, password, confirmPassword: password })).json()).status, 'success');
  const loginResponse = await request('/', { username, password });
  assert.equal((await loginResponse.json()).redirectTo, '/dashboard');
  const setCookie = loginResponse.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-osl-session=[a-f0-9]{64}; Path=\/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict$/);
  const cookie = setCookie.split(';')[0];
  const session = await (await request('/session', null, cookie)).json();
  assert.equal(session.username, username);
  assert.equal(await (await request('/session')).json(), null);
  const secure = await runtime.getD1Database('DB');
  assert.notEqual((await secure.prepare('SELECT token_hash FROM account_sessions').first()).token_hash, cookie.split('=')[1]);
  const enrollment = { currentPassword: password, csrfToken: session.csrfToken };
  assert.equal((await (await request('/recovery-key', enrollment, cookie, 'https://attacker.test')).json()).status, 'error');
  assert.equal((await (await request('/recovery-key', { ...enrollment, csrfToken: 'forged' }, cookie)).json()).status, 'error');
  const enrolled = await (await request('/recovery-key', enrollment, cookie)).json();
  assert.equal(enrolled.status, 'success');
  const recoveryKey = enrolled.recoveryKey;
  assert.match(recoveryKey, /^[a-f0-9]{64}$/);
  assert.notEqual((await secure.prepare('SELECT recovery_hash FROM account_security').first()).recovery_hash, recoveryKey);
  // Both session and recovery enrollment survive a Workers-runtime restart.
  await runtime.dispose(); runtime = new Miniflare(options);
  assert.equal((await (await request('/session', null, cookie)).json()).username, username);
  const newPassword = ' New private training password 🔐 ';
  const recover = { username, recoveryKey, newPassword, confirmPassword: newPassword };
  const outcomes = await Promise.all(Array.from({ length: 2 }, async () => {
    const response = await request('/recover', recover);
    return response.json();
  }));
  assert.equal(outcomes.filter(outcome => outcome.status === 'success').length, 1);
  assert.equal(await (await request('/session', null, cookie)).json(), null);
  assert.equal((await (await request('/recover', recover)).json()).status, 'error');
  assert.equal((await (await request('/', { username, password })).json()).status, 'error');
  const newLogin = await request('/', { username, password: newPassword });
  assert.equal((await newLogin.json()).status, 'success');
  const newCookie = newLogin.headers.get('set-cookie').split(';')[0];
  const nextSession = await (await request('/session', null, newCookie)).json();
  assert.equal(nextSession.hasRecoveryKey, false);
  assert.equal((await request('/logout', { csrfToken: 'forged' }, newCookie)).status, 204);
  assert.equal((await (await request('/session', null, newCookie)).json()).username, username);
  assert.equal((await request('/logout', { csrfToken: nextSession.csrfToken }, newCookie)).status, 303);
  assert.equal(await (await request('/session', null, newCookie)).json(), null);
  const lab = await runtime.getD1Database('LAB_DB');
  assert.equal(await lab.prepare("SELECT name FROM sqlite_master WHERE name IN ('account_sessions', 'account_security')").first(), null);
});
