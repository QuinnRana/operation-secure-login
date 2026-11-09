// Run after build. Exercise the actual bundled framework and server actions,
// without request/cookie mocks, against a disposable local Workers/D1 runtime.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const paths = await readdir('dist/server', { recursive: true });
const modules = ['index.js', ...paths.filter(path => path.endsWith('.js') && path !== 'index.js')]
  .map(path => ({ type: 'ESModule', path: `dist/server/${path}` }));
const runtime = new Miniflare({ modules, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'account-http-fixture' },
  assets: { directory: 'dist/client', binding: 'ASSETS',
    routerConfig: { has_user_worker: true, invoke_user_worker_ahead_of_assets: true } },
});
const origin = (await runtime.ready).origin;
const username = 'http-fixture-student';
const password = 'Fictional HTTP training phrase';
function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function form(html, index = 0) {
  const markup = Array.from(html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g))[index]?.[1];
  assert.ok(markup, 'Rendered form must exist');
  const data = new FormData();
  for (const match of markup.matchAll(/<input\b[^>]*>/g)) {
    if (!/type="hidden"/.test(match[0])) continue;
    const name = /\bname="([^"]*)"/.exec(match[0])?.[1];
    if (name) data.append(decode(name), decode(/\bvalue="([^"]*)"/.exec(match[0])?.[1] ?? ''));
  }
  return data;
}
async function request(path, { data, cookie = '', source = origin } = {}) {
  const headers = { host: new URL(origin).host, cookie };
  if (source !== null) headers.origin = source;
  const encoded = data ? new Response(data) : null;
  if (encoded) headers['content-type'] = encoded.headers.get('content-type');
  const response = await runtime.dispatchFetch(origin + path, { method: data ? 'POST' : 'GET', headers,
    body: encoded ? await encoded.arrayBuffer() : undefined, redirect: 'manual' });
  const html = await response.text();
  if (response.status < 400) assert.match(response.headers.get('cache-control') ?? '', /no-store/, 'Account responses must not be cached');
  return { response, html };
}
try {
  const anonymous = await request('/dashboard');
  assert.equal(anonymous.response.status, 307);
  assert.equal(anonymous.response.headers.get('location'), '/');
  const forged = await request('/dashboard', { cookie: `__Host-osl-session=${'f'.repeat(64)}` });
  assert.equal(forged.response.status, 307, 'Forged token before first signup must fail closed');
  const home = await request('/');
  assert.equal(home.response.status, 200);
  assert.ok(/Forgot (?:your )?password/.test(home.html), 'Login must link to recovery');
  const signup = form(home.html);
  // The signup and login actions are exports of the same compiled module.
  for (const [key, value] of signup) if (typeof value === 'string' && value.includes('#login')) signup.set(key, value.replace('#login', '#register'));
  signup.set('username', username); signup.set('password', password); signup.set('confirmPassword', password);
  const created = await request('/', { data: signup });
  assert.equal(created.response.status, 200);
  const db = await runtime.getD1Database('DB');
  assert.ok(await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first());
  const credentials = form(home.html); credentials.set('username', username); credentials.set('password', password);
  const crossOrigin = await request('/', { data: credentials, source: 'https://attacker.test' });
  assert.ok(crossOrigin.response.status >= 400);
  assert.equal(crossOrigin.response.headers.get('set-cookie'), null);
  const missingOrigin = await request('/', { data: credentials, source: null });
  assert.equal(missingOrigin.response.headers.get('set-cookie'), null);
  const signedIn = await request('/', { data: credentials });
  assert.equal(signedIn.response.status, 200);
  const setCookie = signedIn.response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /__Host-osl-session=[a-f0-9]{64}/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(setCookie.toLowerCase().includes(flag.toLowerCase()), `Cookie must include ${flag}`);
  const cookie = setCookie.split(';')[0];
  const dashboard = await request('/dashboard', { cookie });
  assert.equal(dashboard.response.status, 200);
  assert.ok(dashboard.html.includes('Your account dashboard'));
  assert.ok(dashboard.html.includes(username));
  assert.ok(!dashboard.html.includes(cookie.split('=')[1]), 'Session token must not be serialized in HTML');
  const enroll = form(dashboard.html); enroll.set('currentPassword', password);
  const noCsrf = new FormData(); for (const [name, value] of enroll) if (name !== 'csrfToken') noCsrf.append(name, value);
  await request('/dashboard', { cookie, data: noCsrf });
  assert.equal((await db.prepare('SELECT recovery_hash FROM account_security').first()).recovery_hash, null);
  const keyResponse = await request('/dashboard', { cookie, data: enroll });
  const recoveryKey = /<textarea\b[^>]*id="generated-key"[^>]*>([a-f0-9]{64})<\/textarea>/.exec(keyResponse.html)?.[1];
  assert.ok(recoveryKey, 'Successful enrollment must render the one-time key');
  const refreshed = await request('/dashboard', { cookie });
  assert.ok(!refreshed.html.includes(recoveryKey), 'Reload must not reveal the raw recovery key');
  const recoverPage = await request('/recover');
  const recovery = form(recoverPage.html);
  const newPassword = ' Fresh HTTP training phrase 🔐 ';
  for (const [name, value] of Object.entries({ username, recoveryKey, newPassword, confirmPassword: newPassword })) recovery.set(name, value);
  const recovered = await request('/recover', { data: recovery });
  assert.ok(recovered.html.includes('Password reset'), 'Recovery must render success');
  assert.equal((await request('/dashboard', { cookie })).response.status, 307, 'Reset must revoke the old browser session');
  assert.ok(!(await request('/recover', { data: recovery })).html.includes('Password reset.'));
  const oldLogin = await request('/', { data: credentials });
  assert.equal(oldLogin.response.headers.get('set-cookie'), null);
  credentials.set('password', newPassword);
  const newLogin = await request('/', { data: credentials });
  const newCookie = newLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(newCookie);
  const newDashboard = await request('/dashboard', { cookie: newCookie });
  const signout = await request('/dashboard', { cookie: newCookie, data: form(newDashboard.html, 1) });
  assert.equal(signout.response.status, 303);
  assert.match(signout.response.headers.get('set-cookie') ?? '', /max-age=0/i);
  assert.equal((await request('/dashboard', { cookie: newCookie })).response.status, 307);
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
  console.log('Built-app HTTP checks passed: signup, cookies, private dashboard, CSRF/origin protection, key enrollment, recovery, replay rejection, logout, cache policy and lab isolation.');
} finally { await runtime.dispose(); }
