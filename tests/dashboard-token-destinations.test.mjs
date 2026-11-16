import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createContext, Script, runInContext } from 'node:vm';

const html = readFileSync(new URL('../public/project-dashboard.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'the actual dashboard script must be present');
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `missing source section ${start}`);
  return source.slice(first, last);
}
const apiCode = section('const PROVIDER_NAME =', 'const yearAgo =');
const parserCode = section('function parseProjectUrl(', 'function tokenHelp(');
const statusCode = section('function renderTokState(', 'function openConnect(');
const connectCode = section('$("cGo").onclick=', '(async function init(){');
const openCode = section('async function openProject(', 'async function switchTo(');
const rememberCode = section('function rememberConn(', 'function persist(');
const key = c => `${c.provider}:${c.host}/${c.project}`.toLowerCase();
const original = { provider: 'gitlab', host: 'https://gitlab.example', project: 'team/original', name: 'Original' };
const oldToken = 'fictional-source-token';
const newToken = 'fictional-destination-token';

function fixture({ target = 'https://gitlab.example/team/new', provider = 'gitlab', typed = '', fail = false } = {}) {
  const fields = Object.fromEntries(['cGo', 'cUrl', 'cProvider', 'cName', 'cToken', 'cTtl', 'cTokState', 'statusLine', 'btnReset']
    .map(name => [name, { value: '', dataset: {}, textContent: '', innerHTML: '', placeholder: '' }]));
  fields.cUrl.value = target; fields.cProvider.value = provider; fields.cProvider.dataset.manual = '1';
  fields.cName.value = 'Fixture'; fields.cToken.value = typed; fields.cTtl.value = '7';
  const tokens = new Map([[key(original), oldToken]]);
  const reads = [], saves = [], forgets = [], requests = [], errors = [];
  const context = createContext({
    URL, FormData, Headers, $: id => fields[id], esc: String, connKey: key, connEditing: original,
    conns: { recent: [original], active: key(original) }, dirty: false, expiredNow: new Set(),
    ui: {}, renderOverview: {}, applyMembers() {}, saveUI() {}, render() {},
    dataKeyFor: key, readJSON: () => null, tokenInfo: c => tokens.has(key(c)) ? { tab: true } : null,
    tokenLabel: () => 'fixture lifetime',
    getToken: async c => { reads.push(key(c)); return tokens.get(key(c)) ?? ''; },
    saveToken: async (c, token, ttl) => { saves.push({ id: key(c), token, ttl }); tokens.set(key(c), token); },
    forgetToken: c => { forgets.push(key(c)); tokens.delete(key(c)); },
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      if (fail) throw new Error('synthetic connection failure');
      return { ok: true, json: async () => ({ fixture: true }) };
    },
    showConnErr: text => { if (text) errors.push(text); },
    closeOverlays() {}, toast() {}, saveConns() {}, renderRecent() {}, status() {},
    confirm() { assert.fail('unexpected dialog in fixture'); },
  });
  runInContext(apiCode + parserCode + statusCode + rememberCode + openCode + connectCode, context);
  context.fetchProject = c => context.api(c, '/projects/team%2Ffixture');
  return { context, fields, tokens, reads, saves, forgets, requests, errors, connect: async () => {
    await fields.cGo.onclick();
    if (!fail) assert.deepEqual(errors, [], 'the complete connection handler must succeed');
  } };
}

await test('standalone dashboard script parses and HTTPS project URLs fail safely', () => {
  assert.doesNotThrow(() => new Script(source));
  const { context } = fixture();
  for (const url of ['http://gitlab.example/team/repo', 'https://user:secret@gitlab.example/team/repo',
    'https://user@gitlab.example/team/repo', 'https://gitlab.example/team/%ZZ']) {
    assert.equal(context.parseProjectUrl(url, 'gitlab'), null);
  }
  for (const url of ['https://GITLAB.example:443/team/repo.git', 'git@gitlab.example:team/repo.git']) {
    const project = context.parseProjectUrl(url, 'gitlab');
    assert.equal(project.host, 'https://gitlab.example');
    assert.equal(project.project, 'team/repo');
  }
});

await test('invalid saved destinations are rejected before token reads or network', async () => {
  const f = fixture();
  for (const patch of [{ host: 'http://gitlab.example' }, { host: 'https://user:secret@gitlab.example' },
    { host: 'https://gitlab.example/other' }, { host: 'https://gitlab.example?x=1' },
    { host: 'https://gitlab.example#fragment' }, { host: 'not a URL' }, { provider: 'unknown' }]) {
    await assert.rejects(f.context.api({ ...original, ...patch }, '/projects/fixture'));
  }
  await assert.rejects(f.context.api({ ...original, provider: 'github', host: 'https://github.com' }, '@other.example/path'));
  assert.equal(f.reads.length, 0);
  assert.equal(f.requests.length, 0);
});

await test('provider API routing keeps scoped token headers and omits ambient browser credentials', async () => {
  const f = fixture();
  for (const [provider, host, expected, header] of [
    ['github', 'https://github.com', 'https://api.github.com/repos/team/repo', 'Authorization'],
    ['github', 'https://github.enterprise.example:8443', 'https://github.enterprise.example:8443/api/v3/repos/team/repo', 'Authorization'],
    ['gitlab', 'https://gitlab.example', 'https://gitlab.example/api/v4/repos/team/repo', 'PRIVATE-TOKEN'],
  ]) {
    const c = { ...original, provider, host }; f.tokens.set(key(c), newToken);
    await f.context.api(c, '/repos/team/repo', { page: 2 });
    const { url, options } = f.requests.at(-1);
    assert.equal(url, expected + '?page=2');
    assert.equal(options.headers[header], provider === 'github' ? `Bearer ${newToken}` : newToken);
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
  }
});

await test('same-provider project moves and lifetime edits preserve intended token use', async () => {
  const f = fixture({ target: 'https://GITLAB.example:443/team/new' });
  await f.connect();
  assert.equal(f.requests[0].options.headers['PRIVATE-TOKEN'], oldToken);
  assert.equal(f.saves.length, 1);
  assert.deepEqual(f.forgets, [key(original)]);
  assert.equal(f.context.conns.recent.includes(original), false);
  const lifetime = fixture({ target: 'https://gitlab.example/team/original' });
  lifetime.fields.cTtl.value = 'tab'; lifetime.fields.cTtl.dataset.changed = '1';
  await lifetime.connect();
  assert.equal(lifetime.saves[0].token, oldToken);
  assert.equal(lifetime.saves[0].ttl, 'tab');
  assert.equal(lifetime.forgets.length, 0);
});

await test('different hosts, ports and providers never inherit the original saved token', async () => {
  for (const [target, provider] of [
    ['https://other.example/team/repo', 'gitlab'],
    ['https://gitlab.example:8443/team/repo', 'gitlab'],
    ['https://gitlab.example/team/repo', 'github'],
  ]) {
    const f = fixture({ target, provider });
    await f.connect();
    assert.equal(f.reads.includes(key(original)), false, 'source token must not even be read');
    assert.equal(f.saves.length, 0);
    assert.equal(f.forgets.length, 0);
    assert.equal(f.tokens.get(key(original)), oldToken);
    assert.equal(f.context.conns.recent.includes(original), true);
    assert.equal(f.requests.length, 1, 'public destination can still be read anonymously');
    assert.equal(f.requests[0].options.headers.Authorization, undefined);
    assert.equal(f.requests[0].options.headers['PRIVATE-TOKEN'], undefined);
  }
});

await test('newly supplied or destination-scoped tokens work without replacing source credentials', async () => {
  for (const supplied of [true, false]) {
    const f = fixture({ target: 'https://other.example/team/repo', typed: supplied ? newToken : '' });
    const destination = { ...original, host: 'https://other.example', project: 'team/repo' };
    if (!supplied) f.tokens.set(key(destination), newToken);
    await f.connect();
    assert.equal(f.requests[0].options.headers['PRIVATE-TOKEN'], newToken);
    assert.equal(f.reads.includes(key(original)), false);
    assert.equal(f.tokens.get(key(original)), oldToken);
    assert.equal(f.forgets.length, 0);
  }
});

await test('failed project moves retain the working original connection and token', async () => {
  const f = fixture({ fail: true });
  await f.connect();
  assert.equal(f.tokens.get(key(original)), oldToken);
  assert.equal(f.context.conns.recent.includes(original), true);
  assert.equal(f.forgets.includes(key(original)), false);
  assert.equal(f.saves.length, 1);
  assert.equal(f.tokens.has(f.saves[0].id), false, 'temporary destination token is removed on failure');
  assert.match(f.errors.at(-1), /current HTTPS link/);
  assert.doesNotMatch(f.errors.at(-1), /fictional-.*token/);
});

await test('destination notice updates without clearing a newly typed token', () => {
  const f = fixture({ target: 'https://other.example/team/repo', typed: newToken });
  f.context.renderTokState(original, false);
  assert.match(f.fields.cTokState.innerHTML, /original token will not be copied or removed/);
  assert.equal(f.fields.cToken.value, newToken);
  f.fields.cUrl.value = 'https://gitlab.example/team/new';
  f.context.renderTokState(original, false);
  assert.match(f.fields.cTokState.innerHTML, /Leave the box empty to keep using it/);
  assert.equal(f.fields.cToken.value, newToken);
});

await test('all redirect statuses fail before a synthetic provider token reaches another server', async t => {
  const received = [];
  const destination = createServer((request, response) => {
    received.push(request.headers); response.writeHead(200, { 'content-type': 'application/json' }); response.end('{}');
  });
  const redirects = [];
  let status = 302;
  const upstream = createServer((request, response) => {
    redirects.push(request.headers);
    response.writeHead(status, { location: `http://127.0.0.1:${destination.address().port}/redirect-target` }); response.end();
  });
  for (const server of [destination, upstream]) {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  }
  const f = fixture();
  // Only test transport is mapped to loopback: no DNS, TLS bypass, real provider or token.
  f.context.fetch = async (url, options) => {
    assert.ok(['https://gitlab.example', 'https://api.github.com'].includes(url.origin));
    return fetch(`http://127.0.0.1:${upstream.address().port}/provider-api`, options);
  };
  for (const provider of ['gitlab', 'github']) {
    const c = { ...original, provider, host: provider === 'github' ? 'https://github.com' : original.host };
    f.tokens.set(key(c), oldToken);
    for (status of [301, 302, 303, 307, 308]) {
      await assert.rejects(f.context.api(c, '/fixture'), /API redirects are blocked/);
    }
  }
  assert.equal(redirects.length, 10);
  assert.equal(received.length, 0, 'redirect target must never be contacted');
});
