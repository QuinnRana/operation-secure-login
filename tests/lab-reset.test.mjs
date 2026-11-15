import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Faults are test-only. Failing batches execute against real D1 so rollback
// is verified in Workers, not a mock transaction implementation.
const bundle = await build({
  stdin: { contents: `
    import { resetLab, vulnerableLogin } from './app/attack-lab/actions';
    export default { async fetch(request) {
      const path = new URL(request.url).pathname;
      globalThis.labFault = path;
      if (path === '/reset' || path === '/fault') return Response.json(await resetLab());
      return Response.json(await vulnerableLogin({}, await request.formData()));
    }};
  `, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  plugins: [{ name: 'test-d1-fault', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, args =>
      args.namespace === 'test-env' ? { path: args.path, external: true } : { path: args.path, namespace: 'test-env' });
    builder.onLoad({ filter: /.*/, namespace: 'test-env' }, () => ({ loader: 'js', contents: `
      import { env as real } from 'cloudflare:workers';
      export const env = new Proxy(real, { get(target, key) {
        const value = target[key];
        if (key !== 'LAB_DB' || !value) return value;
        return new Proxy(value, { get(db, method) {
          if (method === 'batch') return statements => db.batch(['/fault', '/failed-login-batch'].includes(globalThis.labFault)
            ? [...statements, db.prepare('INSERT INTO missing_test_table VALUES (1)')]
            : statements);
          if (method === 'prepare') return sql => {
            if ((globalThis.labFault === '/failed-login-create' && sql.includes('CREATE TABLE')) ||
                (globalThis.labFault === '/failed-login-seed' && sql.includes('INSERT INTO'))) {
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

async function fixture(t, lab = true) {
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', d1Databases: { DB: 'secure', ...(lab ? { LAB_DB: 'lab' } : {}) } });
  t.after(() => runtime.dispose());
  const secure = await runtime.getD1Database('DB');
  await secure.prepare('CREATE TABLE users (marker TEXT)').run();
  await secure.prepare("INSERT INTO users VALUES ('fictional-secure-sentinel')").run();
  const call = async (path, username = 'alex', password = 'falcon7') => {
    const response = await runtime.dispatchFetch('http://localhost' + path, {
      method: 'POST', body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  return { runtime, secure, call };
}

await test('login initialization failures return a friendly error and permit retry', async t => {
  for (const stage of ['create', 'seed', 'batch']) {
    await t.test(stage, async t => {
      const { runtime, secure, call } = await fixture(t);
      const lab = await runtime.getD1Database('LAB_DB');
      const expected = {
        status: 'error', message: 'The lab could not initialize. Try again.', records: [],
      };
      // A cold failure must resolve normally without leaking details or a query
      // that was never executed. D1 also rolls back the failed initialization.
      assert.deepEqual(await call(`/failed-login-${stage}`), expected);
      assert.equal(await lab.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
      assert.equal((await call('/lab')).records.length, 1);
      const before = (await lab.prepare('SELECT * FROM lab_accounts ORDER BY id').all()).results;
      assert.equal(before.length, 3);
      // The same failure on an initialized lab must preserve its baseline.
      assert.deepEqual(await call(`/failed-login-${stage}`), expected);
      assert.deepEqual((await lab.prepare('SELECT * FROM lab_accounts ORDER BY id').all()).results, before);
      assert.equal((await call('/lab', "' OR 1=1 --", 'test')).records.length, 3);
      const rejected = await call('/lab', "'", 'test');
      assert.deepEqual(rejected, {
        status: 'error',
        message: 'The database rejected that input. Check the lab instructions and try again.',
        records: [],
        query: "SELECT display_name, role, private_note FROM lab_accounts WHERE username = ''' AND password = 'test'",
      });
      assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-sentinel');
      assert.equal(await secure.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
    });
  }
});

await test('ten concurrent resets and overlapping first logins leave exactly three seeds', async t => {
  const { runtime, secure, call } = await fixture(t);
  const lab = await runtime.getD1Database('LAB_DB');
  // Cold-start login seeding must use the same atomic boundary as reset.
  const cold = await Promise.all(Array.from({ length: 10 }, () => call('/lab')));
  assert(cold.every(r => r.status === 'success' && r.records.length === 1));
  assert.equal((await lab.prepare('SELECT count(*) AS n FROM lab_accounts').first()).n, 3);
  await lab.prepare('DELETE FROM lab_accounts').run();
  const empty = await Promise.all(Array.from({ length: 10 }, () => call('/lab')));
  assert(empty.every(r => r.status === 'success' && r.records.length === 1));
  for (let round = 0; round < 3; round++) {
    const resets = await Promise.all(Array.from({ length: 10 }, () => call('/reset')));
    assert(resets.every(r => r.status === 'success'));
    assert.equal((await lab.prepare('SELECT count(*) AS n FROM lab_accounts').first()).n, 3);
    const mixed = await Promise.all(Array.from({ length: 10 }, (_, i) => call(i % 2 ? '/lab' : '/reset')));
    assert(mixed.every(r => r.status === 'success'));
    const rows = (await lab.prepare('SELECT id, username FROM lab_accounts ORDER BY id').all()).results;
    assert.deepEqual(rows, [{ id: 1, username: 'alex' }, { id: 2, username: 'jamie' }, { id: 3, username: 'casey' }]);
  }
  assert.equal((await call('/lab', 'alex', 'wrong')).status, 'error');
  assert.equal((await call('/lab', "' OR 1=1 --", 'test')).records.length, 3);
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-sentinel');
  assert.equal(await secure.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
});

await test('failed reset rolls back old lab state and later reset recovers', async t => {
  const { runtime, secure, call } = await fixture(t);
  assert.equal((await call('/reset')).status, 'success');
  const lab = await runtime.getD1Database('LAB_DB');
  await lab.prepare("UPDATE lab_accounts SET private_note = 'preserve-on-failure' WHERE id=1").run();
  await lab.prepare('CREATE TABLE unrelated (marker TEXT)').run();
  await lab.prepare("INSERT INTO unrelated VALUES ('retain')").run();
  const before = (await lab.prepare('SELECT * FROM lab_accounts ORDER BY id').all()).results;
  const schemaBefore = await lab.prepare("SELECT sql FROM sqlite_master WHERE name='lab_accounts'").first();
  // Ordinary login must not replace a nonempty, modified training baseline.
  assert.equal((await call('/lab')).records[0].note, 'preserve-on-failure');
  assert.deepEqual(await call('/fault'), { status: 'error', message: 'The lab reset failed. Restart the local server and try again.' });
  assert.deepEqual((await lab.prepare('SELECT * FROM lab_accounts ORDER BY id').all()).results, before);
  assert.deepEqual(await lab.prepare("SELECT sql FROM sqlite_master WHERE name='lab_accounts'").first(), schemaBefore);
  assert.equal((await call('/reset')).status, 'success');
  assert.equal((await lab.prepare('SELECT count(*) AS n FROM lab_accounts').first()).n, 3);
  assert.equal((await lab.prepare('SELECT marker FROM unrelated').first()).marker, 'retain');
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-sentinel');
});

await test('production-style missing lab binding rejects reset without secure writes', async t => {
  const { secure, call } = await fixture(t, false);
  assert.deepEqual(await call('/reset'), { status: 'error', message: 'The isolated Attack Lab database is unavailable.' });
  assert.equal((await secure.prepare('SELECT marker FROM users').first()).marker, 'fictional-secure-sentinel');
});
