import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import ts from 'typescript';

const require = createRequire(import.meta.url);

// Execute the actual server actions with local SQLite-backed D1 adapters.
function loadSource(path, env) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const testModule = { exports: {} };
  const localRequire = (name) => {
    if (name === 'cloudflare:workers') return { env };
    if (name.startsWith('@/')) return loadSource(`${name.slice(2)}.ts`, env);
    return require(name);
  };
  compileFunction(outputText, ['require', 'module', 'exports'])(localRequire, testModule, testModule.exports);
  return testModule.exports;
}

function database() {
  const sqlite = new DatabaseSync(':memory:');
  const binding = {
    prepare(sql) {
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async run() { return sqlite.prepare(sql).run(...parameters); },
        async first() { return sqlite.prepare(sql).get(...parameters) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...parameters) }; },
      };
    },
    async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); },
  };
  return { sqlite, binding };
}

function form(username, password) {
  const data = new FormData();
  data.set('username', username);
  data.set('password', password);
  return data;
}

const idle = { status: 'idle', message: '' };
const failure = { status: 'error', message: 'The username or password is incorrect.' };
const payload = "' OR 1=1 --";

function setup(t) {
  const secure = database();
  const lab = database();
  t.after(() => { secure.sqlite.close(); lab.sqlite.close(); });
  const env = { DB: secure.binding, LAB_DB: lab.binding };
  return {
    secure, lab,
    ...loadSource('app/actions.ts', env),
    ...loadSource('app/attack-lab/actions.ts', env),
    ...loadSource('app/defended-lab/actions.ts', env),
  };
}

await test('the baseline bypass works on the vulnerable lab but fails on the defended lab', async (t) => {
  const { vulnerableLogin, defendedLogin } = setup(t);
  // Baseline is preserved for the before/after comparison.
  const before = await vulnerableLogin({ status: 'idle', message: '', records: [] }, form(payload, 'test'));
  assert.equal(before.records.length, 3);
  // Same payload, defended endpoint: generic failure, no query, no records.
  for (const [username, password] of [
    [payload, 'test'],
    ['alex', "' OR '1'='1"],
    ["alex' --", 'anything'],
    ["' UNION SELECT password_hash, password_salt, display_name FROM defended_lab_accounts --", 'x'],
    ["' UNION SELECT username, password_hash, password_salt FROM users --", 'x'],
  ]) {
    assert.deepEqual(await defendedLogin(idle, form(username, password)), failure, `${username} / ${password}`);
  }
});

await test('valid defended credentials succeed and wrong or unknown ones get the same generic failure', async (t) => {
  const { defendedLogin } = setup(t);
  assert.deepEqual(await defendedLogin(idle, form('alex', 'falcon7')), { status: 'success', message: 'Access granted. Welcome, Alex Morgan.' });
  assert.deepEqual(await defendedLogin(idle, form('jamie', 'spring22')), { status: 'success', message: 'Access granted. Welcome, Jamie Lee.' });
  assert.deepEqual(await defendedLogin(idle, form('alex', 'wrong')), failure);
  assert.deepEqual(await defendedLogin(idle, form('nobody', 'falcon7')), failure);
  assert.deepEqual(await defendedLogin(idle, form('alex', 'falcon7 ')), failure, 'password bytes must match exactly');
  assert.equal((await defendedLogin(idle, form('', 'x'))).status, 'error');
  assert.equal((await defendedLogin(idle, form('a'.repeat(257), 'x'))).message, 'Enter one valid username and password within the supported lengths.');
  const duplicate = form('alex', 'falcon7');
  duplicate.append('username', 'jamie');
  assert.equal((await defendedLogin(idle, duplicate)).status, 'error');
});

await test('defended accounts store unique salted hashes and never plaintext passwords', async (t) => {
  const { lab, defendedLogin } = setup(t);
  await defendedLogin(idle, form('alex', 'falcon7'));
  const rows = lab.sqlite.prepare('SELECT * FROM defended_lab_accounts ORDER BY id').all();
  assert.deepEqual(rows.map((row) => row.username), ['alex', 'jamie', 'casey']);
  const plaintext = ['falcon7', 'spring22', 'welcome1'];
  for (const row of rows) {
    assert.match(row.password_hash, /^[0-9a-f]{64}$/);
    assert.match(row.password_salt, /^[0-9a-f]{32}$/);
    for (const value of Object.values(row)) assert.ok(!plaintext.includes(value));
  }
  assert.equal(new Set(rows.map((row) => row.password_salt)).size, 3);
  assert.equal(new Set(rows.map((row) => row.password_hash)).size, 3);
  assert.ok(!lab.sqlite.prepare("SELECT sql FROM sqlite_master WHERE name='defended_lab_accounts'").get().sql.includes('password TEXT'));
});

await test('defended reset restores the seed with new salts and leaves other tables untouched', async (t) => {
  const { secure, lab, login, vulnerableLogin, defendedLogin, resetDefendedLab } = setup(t);
  assert.equal((await login({ status: 'idle', message: '' }, form('student', 'Training123!'))).status, 'success');
  await vulnerableLogin({ status: 'idle', message: '', records: [] }, form('alex', 'falcon7'));
  lab.sqlite.exec("UPDATE lab_accounts SET private_note = 'vulnerable-lab-marker' WHERE username = 'alex'");
  const secureBefore = secure.sqlite.prepare('SELECT * FROM users').all();

  // Reset works before first use, then after tampering.
  assert.equal((await resetDefendedLab()).status, 'success');
  const firstSalts = lab.sqlite.prepare('SELECT password_salt FROM defended_lab_accounts ORDER BY id').all().map((row) => row.password_salt);
  lab.sqlite.exec("DELETE FROM defended_lab_accounts WHERE username = 'jamie'");
  lab.sqlite.exec("UPDATE defended_lab_accounts SET password_hash = 'tampered' WHERE username = 'alex'");
  assert.deepEqual(await defendedLogin(idle, form('alex', 'falcon7')), failure);

  assert.deepEqual(await resetDefendedLab(), { status: 'success', message: 'Defended lab reset to the 3 fictional accounts with new password hashes.' });
  const rows = lab.sqlite.prepare('SELECT id, username, password_salt FROM defended_lab_accounts ORDER BY id').all();
  assert.deepEqual(rows.map((row) => [row.id, row.username]), [[1, 'alex'], [2, 'jamie'], [3, 'casey']]);
  assert.notDeepEqual(rows.map((row) => row.password_salt), firstSalts);
  assert.equal((await defendedLogin(idle, form('alex', 'falcon7'))).status, 'success');
  assert.equal((await defendedLogin(idle, form('jamie', 'spring22'))).status, 'success');

  assert.equal(lab.sqlite.prepare("SELECT private_note FROM lab_accounts WHERE username = 'alex'").get().private_note, 'vulnerable-lab-marker');
  assert.deepEqual(secure.sqlite.prepare('SELECT * FROM users').all(), secureBefore);
  assert.equal(secure.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE '%lab_accounts'").get().n, 0);
});

await test('overlapping first logins that all see an empty table still seed exactly three accounts', async (t) => {
  const { lab, defendedLogin } = setup(t);
  // Each login checks for an empty table before hashing; started together, all of
  // them see it empty. Only the conditional insert keeps the seed from duplicating.
  const results = await Promise.all(Array.from({ length: 4 }, () => defendedLogin(idle, form('alex', 'falcon7'))));
  assert(results.every((result) => result.status === 'success'));
  assert.equal(lab.sqlite.prepare('SELECT count(*) AS n FROM defended_lab_accounts').get().n, 3);
});

await test('missing or same-object lab binding fails closed before any database access', async () => {
  // Record access as well as throwing, because the defended actions catch database errors.
  let touched = 0;
  const forbidden = { prepare() { touched += 1; assert.fail('must not touch secure DB'); } };
  for (const env of [{ DB: forbidden }, { DB: forbidden, LAB_DB: forbidden }]) {
    const { defendedLogin, resetDefendedLab } = loadSource('app/defended-lab/actions.ts', env);
    const unavailable = { status: 'error', message: 'The isolated Attack Lab database is unavailable.' };
    assert.deepEqual(await defendedLogin(idle, form('alex', 'falcon7')), unavailable);
    assert.deepEqual(await resetDefendedLab(), unavailable);
  }
  assert.equal(touched, 0);
});

await test('Workers runtime: concurrent first logins and resets keep exactly three defended accounts', async (t) => {
  const bundle = await build({
    stdin: { contents: `
      import { defendedLogin, resetDefendedLab } from './app/defended-lab/actions';
      export default { async fetch(request) {
        if (new URL(request.url).pathname === '/reset') return Response.json(await resetDefendedLab());
        return Response.json(await defendedLogin({}, await request.formData()));
      }};
    `, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', platform: 'browser', write: false,
    external: ['cloudflare:workers'],
  });
  const runtime = new Miniflare({ modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-05-15', d1Databases: { DB: 'secure', LAB_DB: 'lab' } });
  t.after(() => runtime.dispose());
  const lab = await runtime.getD1Database('LAB_DB');
  const call = async (path, username = 'alex', password = 'falcon7') => {
    const response = await runtime.dispatchFetch(`http://localhost${path}`, {
      method: 'POST', body: new URLSearchParams({ username, password }),
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const count = async () => (await lab.prepare('SELECT count(*) AS n FROM defended_lab_accounts').first()).n;

  const cold = await Promise.all(Array.from({ length: 4 }, () => call('/login')));
  assert(cold.every((result) => result.status === 'success'));
  assert.equal(await count(), 3);
  const mixed = await Promise.all(Array.from({ length: 6 }, (_, i) => call(i % 2 ? '/login' : '/reset', 'jamie', 'spring22')));
  assert(mixed.every((result) => result.status === 'success'));
  assert.equal(await count(), 3);
  assert.deepEqual(await call('/login', payload, 'test'), failure);
  assert.equal((await call('/login', 'casey', 'welcome1')).status, 'success');
});
