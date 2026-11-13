import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Test-only adapter: explicit time avoids sleeps and races at expiry boundaries.
// This bundle is never part of the application or a deployed worker.
const bundle = await build({
  stdin: { contents: `
    import { env } from 'cloudflare:workers';
    import { createSession, readSession, destroySession } from './lib/session';
    export default { async fetch(request) {
      const { action, token, username, now } = await request.json();
      if (action === 'create') return Response.json(await createSession(env.DB, username, now));
      if (action === 'read') return Response.json(await readSession(env.DB, token, now));
      if (action === 'destroy') { await destroySession(env.DB, token); return Response.json(null); }
      return new Response('Unknown fixture action', { status: 400 });
    }};
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  external: ['cloudflare:workers'],
});

const now = Date.parse('2026-11-13T12:00:00Z');
const ttl = 1_800_000;
const digest = token => createHash('sha256').update(token).digest('hex');

await test('Workers share persisted session digests, revocation and exact absolute expiry', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'osl-session-d1-'));
  let runtime;
  t.after(async () => {
    try { await runtime?.dispose(); } finally { await rm(directory, { recursive: true, force: true }); }
  });
  function start() {
    return new Miniflare({ d1Persist: directory, workers: ['session-a', 'session-b'].map(name => ({
      name, modules: true, script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-05-15', d1Databases: { DB: 'session-lifecycle-fixture' },
    })) });
  }
  async function call(workerName, action, fields = {}) {
    const worker = await runtime.getWorker(workerName);
    const response = await worker.fetch('http://localhost/session-fixture', {
      method: 'POST', body: JSON.stringify({ action, now, ...fields }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  async function rows() {
    const db = await runtime.getD1Database('DB', 'session-a');
    return (await db.prepare('SELECT * FROM sessions ORDER BY token_hash').all()).results;
  }
  runtime = start();
  // Simultaneous first use also exercises idempotent schema creation on shared D1.
  const sessions = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    call(i % 2 ? 'session-a' : 'session-b', 'create', { username: `fixture-${i}` })));
  assert.equal(new Set(sessions.map(session => session.token)).size, 12);
  for (const session of sessions) {
    assert.match(session.token, /^[0-9a-f]{64}$/);
    assert.equal(session.expiresAt, now + ttl);
  }
  const stored = await rows();
  assert.equal(stored.length, 12);
  for (const [i, session] of sessions.entries()) {
    const row = stored.find(row => row.token_hash === digest(session.token));
    assert.deepEqual(row, { token_hash: digest(session.token), username: `fixture-${i}`, created_at: now, expires_at: now + ttl });
    assert.ok(!JSON.stringify(stored).includes(session.token), 'raw tokens are never stored');
    assert.deepEqual(await call('session-b', 'read', { token: session.token }), { username: `fixture-${i}`, expiresAt: now + ttl });
  }
  // Dispose both workers, then reopen the same disposable D1 directory.
  await runtime.dispose();
  runtime = start();
  assert.deepEqual(await rows(), stored, 'restart must preserve every session row');
  const token = sessions[0].token;
  assert.deepEqual(await call('session-a', 'read', { token }), { username: 'fixture-0', expiresAt: now + ttl });
  assert.equal(await call('session-b', 'read', { token: digest(token) }), null, 'a copied database digest is not a bearer token');
  await call('session-a', 'destroy', { token });
  assert.equal(await call('session-b', 'read', { token }), null, 'revocation is visible to another worker');
  await call('session-b', 'destroy', { token });
  assert.deepEqual(await rows(), stored.filter(row => row.token_hash !== digest(token)), 'revocation preserves all other sessions');

  const expiring = sessions[1].token;
  assert.deepEqual(await call('session-a', 'read', { token: expiring, now: now + ttl - 1 }), { username: 'fixture-1', expiresAt: now + ttl });
  assert.equal(await call('session-b', 'read', { token: expiring, now: now + ttl }), null, 'expiry is enforced at the exact boundary');
  assert.equal(await call('session-a', 'read', { token: expiring, now: now + ttl }), null);
  assert.deepEqual(await rows(), stored.filter(row => ![digest(token), digest(expiring)].includes(row.token_hash)), 'expiry deletes only the requested expired session');
});
