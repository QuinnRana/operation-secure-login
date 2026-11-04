import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
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

const idle = { status: 'idle', message: '', records: [] };

await test('lab controls stay usable while UNION and metadata probes cannot reach secure data', async (t) => {
  const secure = database();
  const lab = database();
  t.after(() => { secure.sqlite.close(); lab.sqlite.close(); });
  const env = { DB: secure.binding, LAB_DB: lab.binding };
  const { login } = loadSource('app/actions.ts', env);
  const { vulnerableLogin } = loadSource('app/attack-lab/actions.ts', env);
  assert.equal((await login(idle, form('student', 'Training123!'))).status, 'success');
  assert.equal((await login(idle, form('student', 'wrong'))).status, 'error');
  assert.equal((await vulnerableLogin(idle, form('alex', 'wrong'))).status, 'error');
  assert.equal((await vulnerableLogin(idle, form('alex', 'falcon7'))).records.length, 1);
  assert.equal((await vulnerableLogin(idle, form("' OR 1=1 --", 'test'))).records.length, 3);
  const crossTable = await vulnerableLogin(idle, form("' UNION SELECT username,password_hash,password_salt FROM users --", 'test'));
  assert.equal(crossTable.status, 'error', 'lab must not read the secure users table');
  const passwordProbe = await vulnerableLogin(idle, form('nobody', "' UNION SELECT username,password_hash,password_salt FROM users --"));
  assert.equal(passwordProbe.status, 'error');
  const metadata = await vulnerableLogin(idle, form("' UNION SELECT name,type,sql FROM sqlite_master WHERE name='users' --", 'test'));
  assert.equal(metadata.records.length, 0, 'secure table must not even exist in the lab database');
  assert.equal(secure.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='lab_accounts'").get().n, 0);
  assert.equal((await login(idle, form('student', 'Training123!'))).status, 'success');
});

await test('missing or same-object lab binding fails closed before any database access', async () => {
  const forbidden = { prepare() { assert.fail('must not touch secure DB'); } };
  for (const env of [{ DB: forbidden }, { DB: forbidden, LAB_DB: forbidden }]) {
    const { vulnerableLogin } = loadSource('app/attack-lab/actions.ts', env);
    const result = await vulnerableLogin(idle, form("' OR 1=1 --", 'test'));
    assert.equal(result.status, 'error');
    assert.deepEqual(result.records, []);
    assert.equal(result.query, undefined);
  }
});


await test('local configuration separates storage and omits the lab from production builds', () => {
  const { localD1Bindings } = loadSource('db/local-bindings.ts', {});
  const development = localD1Bindings('DB', 'serve');
  assert.deepEqual(development.map((db) => db.binding), ['DB', 'LAB_DB']);
  assert.notEqual(development[0].database_id, development[1].database_id);
  assert.notEqual(development[0].database_name, development[1].database_name);
  assert.equal(development[0].database_id, '00000000-0000-4000-8000-000000000000');
  assert.deepEqual(localD1Bindings('DB', 'build'), [development[0]]);
  assert.throws(() => localD1Bindings('LAB_DB', 'serve'), /must not/);
});
