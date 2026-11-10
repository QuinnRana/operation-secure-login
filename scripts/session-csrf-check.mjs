// Runtime check of login sessions and their CSRF defenses against a LOCAL dev server.
// Usage: node scripts/session-csrf-check.mjs http://localhost:5179
// It sends the same no-JavaScript form posts a browser would, including forged
// cross-site ones, using only the fictional demo account. Exits nonzero on failure.
import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'http://localhost:5179');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  console.error('Refusing to run: only a local http dev server (localhost, 127.0.0.1 or [::1]) is allowed.');
  process.exit(2);
}
const sameOrigin = base.origin;
const results = [];

function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// The hidden fields React renders for a progressively enhanced server-action form.
async function actionForm(path, cookie) {
  const response = await fetch(new URL(path, base), { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  assert.equal(response.status, 200, `GET ${path}`);
  const html = await response.text();
  const markup = Array.from(html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g))[0]?.[1];
  assert.ok(markup, `no form on ${path}`);
  const form = new FormData();
  for (const [, name, value] of markup.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/g)) {
    form.append(decode(name), decode(value ?? ''));
  }
  assert.ok([...form.keys()].some((key) => key.startsWith('$ACTION_')), `no server-action form on ${path}`);
  return form;
}

async function post(path, form, { origin, cookie } = {}) {
  const headers = {};
  if (origin !== undefined) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  return fetch(new URL(path, base), { method: 'POST', body: form, headers, redirect: 'manual' });
}

// Redirects may be relative or absolute; compare only same-origin paths.
function locationPath(response) {
  const location = response.headers.get('location');
  if (!location) return null;
  const target = new URL(location, base);
  return target.origin === sameOrigin ? target.pathname : target.href;
}

async function accountStatus(cookie) {
  const response = await fetch(new URL('/account', base), { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const body = response.status === 200 ? await response.text() : '';
  return { status: response.status, location: locationPath(response), signedIn: body.includes('Signed in as') };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ check: name, result: 'pass', ...(detail ? { detail } : {}) });
  } catch (error) {
    results.push({ check: name, result: 'FAIL', detail: error.message });
  }
}

async function loginForm() {
  const form = await actionForm('/');
  form.set('username', 'student');
  form.set('password', 'Training123!');
  return form;
}

let cookie;

await check('no session: GET /account redirects to /', async () => {
  const account = await accountStatus();
  assert.equal(account.status, 307);
  assert.equal(account.location, '/');
});

await check('cross-site login (Origin https://attacker.example) is rejected with 403 and sets no cookie', async () => {
  const response = await post('/', await loginForm(), { origin: 'https://attacker.example' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.getSetCookie().length, 0);
  return `status ${response.status}`;
});

await check('sandboxed login (Origin null) is rejected with 403', async () => {
  const response = await post('/', await loginForm(), { origin: 'null' });
  assert.equal(response.status, 403);
});

await check('same-origin login sets the canonical session cookie', async () => {
  const response = await post('/', await loginForm(), { origin: sameOrigin });
  assert.equal(response.status, 200, 'login returns state for the client celebration and navigation');
  const setCookie = response.headers.getSetCookie().find((value) => value.startsWith('__Host-osl-session='));
  assert.ok(setCookie, '__Host-osl-session cookie set');
  const attributes = setCookie.split(';').slice(1).map((part) => part.trim().toLowerCase());
  assert.ok(attributes.includes('httponly'), 'HttpOnly');
  assert.ok(attributes.includes('samesite=strict'), 'SameSite=Strict');
  assert.ok(attributes.includes('path=/'), 'Path=/');
  // The canonical session lifetime is eight hours.
  const maxAge = Number(attributes.find((part) => part.startsWith('max-age='))?.slice(8));
  assert.ok(maxAge === 28800, `Max-Age eight hours (got ${maxAge})`);
  assert.ok(attributes.includes('secure'), 'Secure even on localhost');
  cookie = setCookie.split(';')[0];
  return `status ${response.status}; attributes: ${attributes.join('; ')}`;
});

await check('with the cookie, /account shows the signed-in page', async () => {
  const account = await accountStatus(cookie);
  assert.equal(account.status, 200);
  assert.ok(account.signedIn);
  assert.equal((await fetch(new URL('/dashboard', base), { headers: { cookie }, redirect: 'manual' })).status, 200);
});

await check('cross-site logout (Origin https://attacker.example) is rejected with 403 and the session survives', async () => {
  const response = await post('/account', await actionForm('/account', cookie), { origin: 'https://attacker.example', cookie });
  assert.equal(response.status, 403);
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.ok((await accountStatus(cookie)).signedIn, 'still signed in after the forged request');
  return `status ${response.status}`;
});

await check('missing or wrong logout CSRF token is rejected and the session survives', async () => {
  for (const value of [null, 'f'.repeat(64)]) {
    const form = await actionForm('/account', cookie);
    assert.match(form.get('csrfToken') ?? '', /^[a-f0-9]{64}$/);
    if (value === null) form.delete('csrfToken'); else form.set('csrfToken', value);
    const response = await post('/account', form, { origin: sameOrigin, cookie });
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.ok((await accountStatus(cookie)).signedIn);
  }
});

await check('same-origin logout clears the cookie, redirects to /, and the old cookie stops working', async () => {
  const response = await post('/account', await actionForm('/account', cookie), { origin: sameOrigin, cookie });
  assert.ok([302, 303, 307].includes(response.status), `status ${response.status}`);
  assert.equal(locationPath(response), '/');
  const cleared = response.headers.getSetCookie().find((value) => value.startsWith('__Host-osl-session='));
  assert.ok(cleared && /max-age=0|expires=thu, 01 jan 1970/i.test(cleared), 'cookie cleared');
  const account = await accountStatus(cookie);
  assert.equal(account.status, 307, 'the copied old cookie no longer opens /account');
  assert.equal((await fetch(new URL('/dashboard', base), { headers: { cookie }, redirect: 'manual' })).status, 307, 'the same copied token cannot open /dashboard');
  return `status ${response.status}`;
});

console.log(JSON.stringify({ target: sameOrigin, checkedAt: new Date().toISOString(), results }, null, 2));
process.exit(results.every((entry) => entry.result === 'pass') ? 0 : 1);
