import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, platform, arch } from 'node:os';
import { resolve, join } from 'node:path';

// Execute only the reviewed release; never use a hosted URL or existing DB.
const expected = '59cbc3a9dd81129ffb208a6f77c5bc5f74790d94';
assert.equal(process.argv.length, 3, 'Usage: node scripts/rehearsal-evidence.mjs /path/to/pinned-checkout');
const root = resolve(process.argv[2]);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), expected, 'Target must be the pinned release');
assert.equal(git('status', '--porcelain', '--untracked-files=all'), '', 'Target must be clean');
const require = createRequire(join(root, 'package.json'));
const { build } = require('esbuild');
const { Miniflare } = require('miniflare');
const bundle = await build({
  stdin: { contents: `
    import { login } from './app/actions';
    import { vulnerableLogin } from './app/attack-lab/actions';
    export default { async fetch(request) {
      const data = await request.formData();
      const action = new URL(request.url).pathname === '/lab' ? vulnerableLogin : login;
      return Response.json(await action({}, data));
    }};
  `, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'browser', write: false,
  external: ['cloudflare:workers'],
});
const fixture = await mkdtemp(join(tmpdir(), 'secure-login-rehearsal-'));
let runtime;
const results = [];
const start = (lab = true) => new Miniflare({
  modules: true, script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-05-15',
  d1Persist: fixture,
  d1Databases: { DB: 'rehearsal-secure', ...(lab ? { LAB_DB: 'rehearsal-lab' } : {}) },
});
async function submit(path, username, password) {
  const response = await runtime.dispatchFetch(`http://localhost${path}`, {
    method: 'POST', body: new URLSearchParams({ username, password }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
function record(name, expectedResult, actual) {
  results.push({ name, expected: expectedResult, actual, passed: true });
}
try {
  runtime = start();
  const valid = await submit('/', 'student', 'Training123!');
  assert.equal(valid.status, 'success');
  record('secure valid login', 'success', valid);
  for (const [name, username, password] of [
    ['wrong password', 'student', 'wrong'],
    ['unknown account', 'unknown', 'wrong'],
    ['secure injection control', "' OR 1=1 --", 'test'],
    ['empty input', '', ''],
    ['oversized input', 'u'.repeat(257), 'test'],
  ]) {
    const result = await submit('/', username, password);
    assert.equal(result.status, 'error');
    assert.equal(result.records, undefined);
    assert.equal(result.query, undefined);
    record(name, 'error without query or records', result);
  }
  const wrongLab = await submit('/lab', 'alex', 'wrong');
  assert.equal(wrongLab.status, 'error');
  assert.deepEqual(wrongLab.records, []);
  record('baseline wrong password', 'error, zero records', wrongLab);
  const baseline = await submit('/lab', "' OR 1=1 --", 'test');
  assert.equal(baseline.status, 'success');
  assert.equal(baseline.records.length, 3);
  record('intentional local baseline bypass', 'success, three fictional records', baseline);
  const probe = await submit('/lab', "' UNION SELECT username,password_hash,password_salt FROM users --", 'test');
  assert.equal(probe.status, 'error');
  assert.deepEqual(probe.records, []);
  record('lab cannot select secure users', 'error, zero records', probe);
  const secure = await runtime.getD1Database('DB');
  await secure.prepare('CREATE TABLE rehearsal_marker (value TEXT)').run();
  await secure.prepare('INSERT INTO rehearsal_marker VALUES (?)').bind('fictional-preservation-marker').run();
  assert.equal(await secure.prepare("SELECT name FROM sqlite_master WHERE name='lab_accounts'").first(), null);
  record('secure DB has no lab table', 'no lab_accounts table', null);
  await runtime.dispose();
  runtime = start();
  const restarted = await submit('/', 'student', 'Training123!');
  assert.equal(restarted.status, 'success');
  const retained = await (await runtime.getD1Database('DB')).prepare('SELECT value FROM rehearsal_marker').first();
  assert.equal(retained.value, 'fictional-preservation-marker');
  record('restart retains secure data and login', 'success and marker preserved', { login: restarted, marker: retained.value });
  const labAfterRestart = await submit('/lab', 'alex', 'falcon7');
  assert.equal(labAfterRestart.records.length, 1);
  record('restart retains lab seed', 'one legitimate fictional record', labAfterRestart);
  await runtime.dispose();
  runtime = start(false);
  const disabled = await submit('/lab', 'alex', 'falcon7');
  assert.equal(disabled.status, 'error');
  assert.deepEqual(disabled.records, []);
  assert.equal(disabled.query, undefined);
  record('production-style binding disables lab', 'error without query or records', disabled);
  const productionLogin = await submit('/', 'student', 'Training123!');
  assert.equal(productionLogin.status, 'success');
  record('production-style binding preserves secure login', 'success', productionLogin);
} finally {
  try { if (runtime) await runtime.dispose(); }
  finally { await rm(fixture, { recursive: true, force: true }); }
}
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(), sourceCommit: expected,
  environment: { node: process.version, platform: platform(), arch: arch() },
  scope: 'Local server actions in Workers/D1; disposable fictional fixtures; no hosted requests',
  limits: ['No browser screenshot or recording', 'No timed team rehearsal or second-person reproduction',
    'No instructor approval', 'No full offline-browser test', 'No defended-lab implementation or retest',
    'Restart proof is not a lab-only reset procedure'],
  results,
}, null, 2));
