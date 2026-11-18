import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext, Script } from 'node:vm';

const html = readFileSync(new URL('../public/project-dashboard.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('const esc ='), html.indexOf('\n}', html.indexOf('function assigneeOption(')) + 2);
function option(name, role, selected = false, withRole = false) {
  const context = { MEMBERS: { [name]: { role } } };
  runInNewContext(`${source}\nthis.render = assigneeOption;`, context);
  return context.render(name, selected, withRole);
}

await test('dashboard script remains syntactically valid', () => {
  for (const [, script] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(script);
});

await test('assignee values and labels escape imported markup and attribute breakouts', () => {
  const name = '"><img src=x onerror=alert(1)></option></select><svg onload=alert(2)>';
  const role = '<script>alert(3)</script> & "mentor"';
  const result = option(name, role, true, true);
  assert.equal((result.match(/<option\b/g) || []).length, 1);
  assert.equal((result.match(/<\/option>/g) || []).length, 1);
  assert.ok(!/<(?:img|svg|script|\/select)\b/.test(result));
  assert.ok(result.includes('&quot;&gt;&lt;img'));
  assert.ok(result.includes('&lt;script&gt;alert(3)&lt;/script&gt; &amp; &quot;mentor&quot;'));
  assert.ok(result.includes(' selected>'));
});

await test('ordinary names, quotes, ampersands and Unicode retain explicit identity values', () => {
  assert.equal(option('Quinn', 'Developer', false, true), '<option value="Quinn">Quinn — Developer</option>');
  assert.equal(option('Renée & O\'Neil', 'Teacher', true), '<option value="Renée &amp; O&#39;Neil" selected>Renée &amp; O&#39;Neil</option>');
  assert.equal(option('Team', undefined, false, true), '<option value="Team">Team — </option>');
});

await test('all three assignee selectors use the safe renderer', () => {
  assert.ok(html.includes('ASSIGNEES.map(a=>assigneeOption(a,a===val))'));
  assert.ok(html.includes('ASSIGNEES.map(a=>assigneeOption(a,false,true))'));
  assert.ok(html.includes('ASSIGNEES.map(a=>assigneeOption(a,ui.boardWho===a))'));
  assert.ok(!/ASSIGNEES\.map\(a=>`<option/.test(html));
});
