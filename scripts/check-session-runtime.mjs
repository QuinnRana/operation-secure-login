// Run the actual framework's session/CSRF checks using fresh, disposable local D1 data.
// No URL argument, existing server, .env files, or existing .wrangler state is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'This runner accepts no target: it creates its own disposable local server.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = await mkdtemp(join(tmpdir(), 'osl-session-runtime-'));
let server;
let serverExit;
let check;
let interrupted = false;
const interrupt = () => {
  interrupted = true;
  check?.kill('SIGTERM');
  server?.kill('SIGTERM');
};
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);
let output = '';
try {
  // Explicit source-only copy: never bring a developer's database or environment files.
  for (const path of ['app', 'components', 'db', 'lib', 'public', '.openai/hosting.json',
    'package.json', 'tsconfig.json', 'vite.config.ts', 'next.config.ts']) {
    await cp(join(root, path), join(fixture, path), { recursive: true });
  }
  await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${port}`;
  // Vite's programmatic options enforce loopback and strict port ownership; the
  // vinext CLI does not support --strictPort. Load the actual project plugins.
  await writeFile(join(fixture, 'run.mjs'), `
    import { createServer } from 'vite';
    const server = await createServer({ cacheDir: '.vite-cache', server: { host: '127.0.0.1', port: ${port}, strictPort: true } });
    await server.listen();
    console.log('OSL_DISPOSABLE_SERVER_READY');
    process.on('SIGTERM', async () => { await server.close(); process.exit(0); });
  `);
  assert.ok(!interrupted, 'Runtime check interrupted');
  server = spawn(process.execPath, [join(fixture, 'run.mjs')], {
    cwd: fixture,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false',
      WRANGLER_LOG_PATH: join(fixture, '.wrangler/logs'), MINIFLARE_REGISTRY_PATH: join(fixture, '.wrangler/registry') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverExit = once(server, 'exit');
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => {
    output = (output + chunk.toString()).slice(-16000);
  });
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (!interrupted && Date.now() < deadline && server.exitCode === null) {
    try {
      if (!output.includes('OSL_DISPOSABLE_SERVER_READY')) throw new Error('Server not listening yet');
      const response = await fetch(base, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
      await response.arrayBuffer();
      if (response.status === 200) { ready = true; break; }
    } catch { /* wait for the local runtime */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, 'Disposable local server did not become ready');
  check = spawn(process.execPath, [join(root, 'scripts/session-csrf-check.mjs'), base], {
    cwd: fixture, stdio: 'inherit', timeout: 120_000,
  });
  const [code, signal] = await once(check, 'exit');
  assert.equal(code, 0, `Session runtime checks failed (signal: ${signal})`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    try { await serverExit; } finally { clearTimeout(force); }
  }
  await rm(fixture, { recursive: true, force: true });
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
}
