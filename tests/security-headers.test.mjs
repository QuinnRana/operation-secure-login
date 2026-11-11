import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import { matchHeaders } from 'vinext/config/config-matchers';

const require = createRequire(import.meta.url);

function loadConfig() {
  const source = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const configModule = { exports: {} };
  compileFunction(outputText, ['require', 'module', 'exports'])(require, configModule, configModule.exports);
  return configModule.exports;
}

const expected = {
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

await test('every page, including the bare root, gets the anti-framing and hardening headers', async () => {
  const { default: config } = loadConfig();
  const rules = await config.headers();
  const context = { headers: new Headers(), cookies: {}, query: new URLSearchParams(), host: 'localhost' };
  for (const path of ['/', '/account', '/attack-lab', '/defended-lab', '/some/unknown/path']) {
    const sent = Object.fromEntries(matchHeaders(path, rules, context).map(({ key, value }) => [key.toLowerCase(), value]));
    assert.deepEqual(sent, expected, path);
  }
});
