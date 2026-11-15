import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'public/project-dashboard.html'), 'utf8');
const browserChecks = await readFile(path.join(root, 'tests/fixtures/dashboard-tooltips.browser.js'), 'utf8');
const bootstrap = '(async function init(){';
assert.equal(html.split(bootstrap).length, 2, 'the dashboard must have exactly one network bootstrap');
// Keep real rendering functions, event handlers, DOM and CSP. Replace only the
// live-data startup with a deterministic fixture, and disallow all connections.
const fixture = html.slice(0, html.indexOf(bootstrap)).replace('connect-src https:', "connect-src 'none'")
  + browserChecks + '\n</script></body></html>';
let chrome;
for (const candidate of process.env.CHROME_BIN ? [process.env.CHROME_BIN] : ['chromium', 'google-chrome', 'chromium-browser']) {
  try { await exec(candidate, ['--version']); chrome = candidate; break; }
  catch { /* Try the next installed Chrome/Chromium binary. */ }
}
assert.ok(chrome, 'Chrome/Chromium is required. Set CHROME_BIN to its installed executable.');
const directory = await mkdtemp(path.join(tmpdir(), 'dashboard-tooltip-test-'));
try {
  const safeSink = 'tip.textContent=el.dataset.tip;';
  assert.ok(fixture.includes(safeSink), 'expected the text-only tooltip sink');
  for (const [name, contents, expectedStatus] of [
    ['fixed', fixture, 'passed'],
    ['negative-control', fixture.replace(safeSink, 'tip.innerHTML=el.dataset.tip;'), 'failed'],
  ]) {
    const file = path.join(directory, `${name}.html`);
    await writeFile(file, contents);
    const { stdout } = await exec(chrome, [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--disable-extensions', '--no-first-run',
      '--host-resolver-rules=MAP * ~NOTFOUND', `--user-data-dir=${path.join(directory, `${name}-profile`)}`,
      '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(file).href,
    ], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
    const result = stdout.match(/<pre id="dashboard-tooltip-results" data-status="(passed|failed)">([\s\S]*?)<\/pre>/);
    assert.ok(result, 'the browser fixture did not finish');
    assert.equal(result[1], expectedStatus, result[2]);
    if (expectedStatus === 'failed') {
      assert.match(result[2], /script executed|tooltip created markup/, 'the unsafe sink must fail for the security boundary');
    }
    console.log(`Dashboard tooltip ${name}: ${result[2]}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
