import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';

// Run after build: exercise the shipped Worker, not a substitute action bundle.
// Every database is disposable local D1; no hosted bindings or endpoints are used.
await test('built Worker bounds declared and streamed action bodies before database work', async t => {
  const root = resolve('dist/server');
  const files = readdirSync(root, { recursive: true }).filter(f => f.endsWith('.js') && f !== 'index.js');
  const runtime = new Miniflare({
    modulesRoot: root,
    modules: [{ type: 'ESModule', path: `${root}/index.js` },
      ...files.map(f => ({ type: 'ESModule', path: `${root}/${String(f)}` }))],
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: { DB: 'request-limit-fixture' },
  });
  t.after(() => runtime.dispose());
  const origin = (await runtime.ready).origin;
  const page = await runtime.dispatchFetch(origin + '/');
  assert.equal(page.status, 200);
  const html = await page.text();
  const form = new FormData();
  const decode = text => text.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  for (const input of html.matchAll(/<input type="hidden"[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)[1];
    const value = input[0].match(/value="([^"]*)"/)?.[1] ?? '';
    form.append(decode(name), decode(value));
  }
  assert.ok([...form.keys()].some(key => key.startsWith('$ACTION_REF_')));
  const action = [...form.values()].map(value => {
    try { return JSON.parse(value); } catch { return null; }
  }).find(value => typeof value?.id === 'string')?.id;
  assert.ok(action, 'actual login action reference must be present');
  form.set('username', 'student');
  form.set('password', 'Training123!');
  form.set('padding', '');
  const limit = 16 * 1024;
  const initial = new Request('http://localhost/', { method: 'POST', body: form });
  const overhead = (await initial.arrayBuffer()).byteLength;
  assert.ok(overhead < limit);
  form.set('padding', 'x'.repeat(limit - overhead));
  const encoded = new Request('http://localhost/', { method: 'POST', body: form });
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  assert.equal(bytes.length, limit);
  const contentType = encoded.headers.get('content-type');
  const db = await runtime.getD1Database('DB');
  const tables = async () => (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").all()).results;
  const before = await tables();
  const send = async (data, streamed, fetchAction = false) => {
    const headers = { 'content-type': fetchAction ? 'text/plain;charset=UTF-8' : contentType, origin };
    if (!streamed) headers['content-length'] = String(data.length);
    if (fetchAction) headers['next-action'] = action;
    let body = data;
    if (streamed) body = new ReadableStream({ start(controller) {
      for (let i = 0; i < data.length; i += 1024) controller.enqueue(data.slice(i, i + 1024));
      controller.close();
    } });
    return runtime.dispatchFetch(origin + '/', { method: 'POST', headers, body, duplex: 'half' });
  };
  const oversized = new Uint8Array(limit + 1);
  oversized.set(bytes);
  for (const streamed of [false, true]) {
    const response = await send(oversized, streamed);
    assert.equal(response.status, 413, `progressive form, streamed=${streamed}`);
    await response.text();
    const fetchResponse = await send(oversized, streamed, true);
    // vinext deliberately reports fetch-action overflow as an RSC error, not 413.
    assert.equal(fetchResponse.status, 500, `fetch action, streamed=${streamed}`);
    assert.match(fetchResponse.headers.get('content-type'), /text\/x-component/);
    await fetchResponse.text();
    assert.deepEqual(await tables(), before, 'oversized actions must not initialize or query credentials');
  }
  // Exact-boundary, valid form including framework metadata still authenticates.
  for (const streamed of [false, true]) {
    const response = await send(bytes, streamed);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Access granted\. Welcome, student\./);
  }
  assert.equal((await db.prepare('SELECT attempts FROM login_attempt_limits').first()).attempts, 2);
});
