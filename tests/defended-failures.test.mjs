import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Fault injection exists only in this test bundle. D1 executes the failing
// batch itself, so rollback is verified against Workers rather than a mock.
const bundle = await build({
  stdin: { contents: `
    import { defendedLogin, resetDefendedLab } from './app/defended-lab/actions';
    export default { async fetch(request) {
      const path = new URL(request.url).pathname;
      globalThis.labFault = path;
      if (path.includes('reset')) return Response.json(await resetDefendedLab());
      return Response.json(await defendedLogin({}, await request.formData()));
    }};
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  plugins: [{ name: 'defended-d1-faults', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, args =>
      args.namespace === 'fault-env' ? { path: args.path, external: true } : { path: args.path, namespace: 'fault-env' });
    builder.onLoad({ filter: /.*/, namespace: 'fault-env' }, () => ({ loader: 'js', contents: `
      import { env as real } from 'cloudflare:workers';
      export const env = new Proxy(real, { get(target, key) {
        const value = target[key];
        if (key !== 'LAB_DB' || !value) return value;
        return new Proxy(value, { get(db, method) {
          if (method === 'batch') return statements => db.batch(globalThis.labFault === '/failed-reset'
            ? [...statements, db.prepare('INSERT INTO nonexistent_fault_table VALUES (1)')]
            : statements);
          if (method === 'prepare') return sql => {
            if (globalThis.labFault === '/failed-login' && sql.includes('SELECT password_hash')) {
              throw new Error('private-database-detail fictional-secret-value');
            }
            return db.prepare(sql);
          };
          const member = db[method];
          return typeof member === 'function' ? member.bind(db) : member;
        }});
      }});
    ` }));
  }}],
});

async function fixture(t, withLab = true) {
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', d1Databases: { DB: 'secure', ...(withLab ? { LAB_DB: 'lab' } : {}) } });
  t.after(() => runtime.dispose());
  const secure = await runtime.getD1Database('DB');
  await secure.prepare('CREATE TABLE users (marker TEXT)').run();
  await secure.prepare("INSERT INTO users VALUES ('fictional-secure-marker')").run();
  // Tests issue requests sequentially so the injected fault cannot leak across requests.
  const call = async path => {
    const response = await runtime.dispatchFetch('http://localhost' + path, {
      method: 'POST', body: new URLSearchParams({ username: 'alex', password: 'falcon7' }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  return { runtime, secure, call };
}

await test('defended reset rolls back schema and rows on failure, then recovers without touching other data', async t => {
  const { runtime, secure, call } = await fixture(t);
  const lab = await runtime.getD1Database('LAB_DB');
  assert.equal((await call('/reset')).status, 'success');
  await lab.prepare("UPDATE defended_lab_accounts SET private_note='retain-on-failure' WHERE id=1").run();
  await lab.prepare('CREATE INDEX review_marker_index ON defended_lab_accounts(role)').run();
  await lab.prepare('CREATE TABLE lab_accounts (marker TEXT)').run();
  await lab.prepare("INSERT INTO lab_accounts VALUES ('fictional-baseline-marker')").run();
  const rows = async () => (await lab.prepare('SELECT * FROM defended_lab_accounts ORDER BY id').all()).results;
  const schema = async () => (await lab.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name='defended_lab_accounts' ORDER BY type,name").all()).results;
  const beforeRows = await rows();
  const beforeSchema = await schema();
  assert.deepEqual(await call('/failed-reset'), {
    status: 'error', message: 'The defended lab reset failed. Restart the local server and try again.',
  });
  assert.deepEqual(await rows(), beforeRows);
  assert.deepEqual(await schema(), beforeSchema);
  assert.equal((await call('/reset')).status, 'success');
  const recovered = await rows();
  assert.deepEqual(recovered.map(r => [r.id, r.username]), [[1, 'alex'], [2, 'jamie'], [3, 'casey']]);
  assert.notDeepEqual(recovered.map(r => r.password_salt), beforeRows.map(r => r.password_salt));
  assert.equal((await call('/login')).status, 'success');
  assert.equal((await lab.prepare('SELECT marker FROM lab_accounts').first()).marker, 'fictional-baseline-marker');
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-marker');
  assert.equal(await secure.prepare("SELECT name FROM sqlite_master WHERE name='defended_lab_accounts'").first(), null);
});

await test('defended lookup failures disclose no database details and remain recoverable', async t => {
  const { call } = await fixture(t);
  assert.equal((await call('/login')).status, 'success');
  assert.deepEqual(await call('/failed-login'), {
    status: 'error', message: 'The defended lab could not check that login. Try again.',
  });
  assert.equal((await call('/login')).status, 'success');
});

await test('production-style missing lab binding rejects defended login and reset without secure writes', async t => {
  const { secure, call } = await fixture(t, false);
  const tables = async () => (await secure.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()).results;
  const beforeTables = await tables();
  for (const path of ['/login', '/reset']) {
    assert.deepEqual(await call(path), { status: 'error', message: 'The isolated Attack Lab database is unavailable.' });
  }
  assert.deepEqual(await tables(), beforeTables);
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-marker');
});
