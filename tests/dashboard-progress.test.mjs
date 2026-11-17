import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../public/project-dashboard.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const panelSource = source.slice(source.indexOf('function progressIssueUrl('), source.indexOf('function renderBrand('));
function fixture(project, issues, team = false) {
  const nodes = [];
  const element = tag => {
    const node = { tag, textContent: '', children: [], style: {},
      set innerHTML(_) { throw new Error('untrusted progress must not parse HTML'); },
      append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; this.textContent = ''; },
      setAttribute(key, value) { this[key] = value; },
    };
    nodes.push(node); return node;
  };
  const root = element('section');
  const context = { URL, S: { project, issues }, activeConn: () => team ? { project: 'QuinnRana/operation-secure-login' } : null,
    document: { getElementById: () => root, createElement: element } };
  runInNewContext(panelSource, context);
  context.renderProjectProgress();
  return { nodes, root, context };
}
const issue = (id = 1, status = 'todo') => ({ id, status, title: '<img src=x onerror=alert(1)>', assignee: '<svg onload=alert(2)>' });

await test('standalone dashboard script remains syntactically valid', () => assert.doesNotThrow(() => new Script(source)));
await test('progress panel renders remote and imported labels as text', () => {
  const f = fixture({ url: 'https://github.com/owner/repo' }, [issue()]);
  const link = f.nodes.find(n => n.tag === 'a');
  assert.equal(link.textContent, '#1 · <img src=x onerror=alert(1)>');
  assert.equal(link.href, 'https://github.com/owner/repo/issues/1');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.target, '_blank');
  assert.ok(f.nodes.some(n => n.textContent === ' — <svg onload=alert(2)>'));
});
await test('unsafe or malformed destinations and IDs become non-clickable text', () => {
  for (const url of ['javascript:alert(1)//', 'data:text/html,<svg>', '//evil.test/repo', 'http://example.test/repo', 'https://user:secret@example.test/repo', 'not a URL']) {
    const f = fixture({ url }, [issue()]);
    assert.equal(f.nodes.filter(n => n.tag === 'a').length, 0, url);
    assert.ok(f.nodes.some(n => n.textContent.startsWith('#1 · ')));
  }
  for (const id of ['1" onclick="alert(1)', '<svg onload=alert(1)>', '1', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture({ url: 'https://github.com/owner/repo' }, [issue(id)]);
    assert.equal(f.nodes.filter(n => n.tag === 'a').length, 0);
    assert.ok(f.nodes.some(n => n.textContent === `#${id} · ${issue().title}`));
  }
});
await test('HTTPS GitHub, GitLab, and enterprise links preserve project paths', () => {
  for (const [url, expected] of [
    ['https://github.com/owner/repo/?tab=readme#anchor', 'https://github.com/owner/repo/issues/42'],
    ['https://gitlab.com/group/subgroup/project', 'https://gitlab.com/group/subgroup/project/issues/42'],
    ['https://git.example.test:8443/team/project', 'https://git.example.test:8443/team/project/issues/42'],
  ]) {
    const f = fixture({ url }, [issue(42)]);
    assert.equal(f.nodes.find(n => n.tag === 'a').href, expected);
  }
});
await test('counts, roadmap exclusion, empty/demo states and repeated rendering are retained', () => {
  const f = fixture({ url: 'https://github.com/QuinnRana/operation-secure-login' }, [issue(15), issue(1, 'done'), issue(2)], true);
  assert.equal(f.nodes.find(n => n.tag === 'h2').textContent, 'Project completion: 50%');
  assert.equal(f.nodes.find(n => n.tag === 'progress').max, 2);
  assert.equal(f.nodes.find(n => n.tag === 'progress').value, 1);
  assert.equal(f.nodes.filter(n => n.tag === 'a').length, 1);
  f.context.S.issues = [issue(1, 'done')]; f.context.renderProjectProgress();
  assert.equal(f.root.children.some(n => n.tag === 'ul'), false);
  f.context.S.issues = []; f.context.renderProjectProgress();
  assert.equal(f.root.children[0].textContent, 'Project completion: Not tracked yet');
  assert.equal(f.root.children.some(n => n.tag === 'progress'), false);
  f.context.S.project = null; f.context.renderProjectProgress();
  assert.equal(f.root.children.length, 0);
  assert.match(f.root.textContent, /Demo project/);
});
