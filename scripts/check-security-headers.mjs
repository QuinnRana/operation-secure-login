import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';

// Exercise the shipped Worker after build, with disposable local bindings only.
async function fixture(t, withLab) {
  const root = resolve('dist/server');
  const files = readdirSync(root, { recursive: true }).filter(f => f.endsWith('.js') && f !== 'index.js');
  const runtime = new Miniflare({
    modulesRoot: root,
    modules: [{ type: 'ESModule', path: `${root}/index.js` },
      ...files.map(f => ({ type: 'ESModule', path: `${root}/${String(f)}` }))],
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    assets: { directory: resolve('dist/client'), routerConfig: { has_user_worker: true } },
    d1Databases: { DB: 'headers-secure-fixture', ...(withLab ? { LAB_DB: 'headers-lab-fixture' } : {}) },
  });
  t.after(() => runtime.dispose());
  const origin = (await runtime.ready).origin;
  return { runtime, origin };
}

function assertHeaders(response) {
  assert.equal(response.headers.get('content-security-policy'), "base-uri 'self'; form-action 'self'; object-src 'none'");
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
}

// Use the real rendered action reference rather than a hard-coded function ID.
function loginForm(html) {
  const markup = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    .map(match => match[1]).find(form => /name="username"/.test(form));
  assert.ok(markup, 'rendered login form must be present');
  const data = new FormData();
  const decode = text => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
  for (const input of markup.matchAll(/<input\b[^>]*>/g)) {
    if (!/type="hidden"/.test(input[0])) continue;
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    assert.ok(name, 'hidden action field must have a name');
    data.append(decode(name), decode(input[0].match(/value="([^"]*)"/)?.[1] ?? ''));
  }
  assert.ok([...data.keys()].some(key => key.startsWith('$ACTION_REF_')), 'actual action metadata must be present');
  return data;
}

async function page(f, path, method = 'GET', status = 200) {
  const response = await f.runtime.dispatchFetch(f.origin + path, { method });
  assert.equal(response.status, status);
  assertHeaders(response);
  return response.text();
}

async function login(f, path, username, password) {
  const body = loginForm(await page(f, path));
  body.set('username', username);
  body.set('password', password);
  // Serialize with the same boundary advertised in Content-Type. Miniflare's
  // bundled fetch implementation does not accept Node's FormData as native.
  const encoded = new Request(f.origin + path, { method: 'POST', body });
  const response = await f.runtime.dispatchFetch(f.origin + path, {
    method: 'POST', headers: { origin: f.origin, 'content-type': encoded.headers.get('content-type') },
    body: new Uint8Array(await encoded.arrayBuffer()),
  });
  assert.equal(response.status, 200);
  assertHeaders(response);
  return response.text();
}

await test('built Worker sends security headers on pages, 404s and working classroom forms', async t => {
  const f = await fixture(t, true);
  for (const path of ['/', '/attack-lab', '/defended-lab']) {
    const html = await page(f, path);
    // Match production's separate static-asset handler, and make sure the
    // page still references executable JS and a stylesheet with correct MIME.
    const script = html.match(/<script[^>]*src="([^"]+)"/)?.[1];
    const style = html.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/)?.[1];
    assert.ok(script && style, 'rendered page must reference JS and CSS');
    for (const [path, mime] of [[script, /^(application|text)\/javascript/], [style, /^text\/css/]]) {
      const asset = await f.runtime.dispatchFetch(new URL(path, f.origin).href);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), mime);
      assert.ok((await asset.arrayBuffer()).byteLength > 0);
    }
    await page(f, path, 'HEAD');
  }
  await page(f, '/missing-security-test-page', 'GET', 404);
  assert.match(await login(f, '/', 'student', 'Training123!'), /Access granted\. Welcome, student\./);
  assert.match(await login(f, '/', 'student', 'wrong'), /The username or password is incorrect\./);
  assert.match(await login(f, '/defended-lab', 'alex', 'falcon7'), /Access granted\. Welcome, Alex Morgan\./);
  assert.match(await login(f, '/defended-lab', "' OR 1=1 --", 'x'), /The username or password is incorrect\./);
  // Browser hardening must not remove or "fix" the intentional SQL classroom exercise.
  assert.match(await login(f, '/attack-lab', "' OR 1=1 --", 'x'), /Login bypassed/);
  const lab = await f.runtime.getD1Database('LAB_DB');
  assert.equal((await lab.prepare('SELECT count(*) AS n FROM lab_accounts').first()).n, 3);
});

await test('production-style missing lab binding stays disabled with response headers', async t => {
  const f = await fixture(t, false);
  for (const path of ['/attack-lab', '/defended-lab']) {
    assert.match(await login(f, path, 'alex', 'falcon7'), /The isolated Attack Lab database is unavailable\./);
  }
  const secure = await f.runtime.getD1Database('DB');
  const tables = (await secure.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").all()).results;
  assert.deepEqual(tables, [], 'unavailable lab requests must not initialize secure data');
});
