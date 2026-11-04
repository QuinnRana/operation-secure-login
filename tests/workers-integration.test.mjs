import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const bundle = await build({
  stdin: { contents: `
    import { login } from './app/actions';
    import { vulnerableLogin } from './app/attack-lab/actions';
    import { hashPassword } from './lib/password';
    export default { async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/hash') return Response.json(await hashPassword('päss🔒word', 'fixture-salt'));
      const data = await request.formData();
      return Response.json(await (path === '/lab' ? vulnerableLogin : login)({}, data));
    }};
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  external: ['cloudflare:workers'],
});

async function submit(runtime, path, username, password) {
  const body = new URLSearchParams({ username, password });
  const response = await runtime.dispatchFetch(`http://localhost${path}`, { method: 'POST', body });
  assert.equal(response.status, 200);
  return response.json();
}

await test('Workers runtime preserves hashes, secure login and isolated classroom baseline', async (t) => {
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', d1Databases: { DB: 'secure-fixture', LAB_DB: 'lab-fixture' } });
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
    compatibilityDate: '2026-05-15', d1Databases: { DB: 'secure-only-fixture' } });
  t.after(() => runtime.dispose());
  const result = await submit(runtime, '/lab', "' OR 1=1 --", 'test');
  assert.equal(result.status, 'error');
  assert.deepEqual(result.records, []);
  assert.equal(result.query, undefined);
});
