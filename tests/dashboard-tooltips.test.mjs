import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Script, runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../public/project-dashboard.html', import.meta.url), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const handlers = source.slice(source.indexOf('const tip=document.getElementById("tip");'),
  source.indexOf('/* =====================================================================\n   RENDER ROOT'));

function fixture() {
  const listeners = new Map();
  const classes = new Set();
  const tip = {
    textContent: '',
    set innerHTML(_value) { throw new Error('tooltip must not parse HTML'); },
    classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
  };
  const context = { dragState: null, document: {
    getElementById(id) { assert.equal(id, 'tip'); return tip; },
    addEventListener(name, listener) { listeners.set(name, listener); },
  } };
  runInNewContext(handlers, context);
  return { tip, context, listeners };
}

await test('the standalone dashboard script remains valid JavaScript', () => {
  assert.ok(source);
  assert.doesNotThrow(() => new Script(source));
});

await test('the actual hover handler treats decoded attributes as text, never HTML', () => {
  const { tip, listeners } = fixture();
  for (const value of ['<svg onload="alert(1)"></svg>', '&lt;img src=x&gt;', '"quoted" & \'single\' 🔒\nSecond line']) {
    listeners.get('mouseover')({ target: { closest: () => ({ dataset: { tip: value } }) } });
    assert.equal(tip.textContent, value);
    assert.equal(tip.classList.contains('on'), true);
  }
  assert.match(html, /#tip\{[^}]*white-space:pre-line/);
});

await test('tooltips dismiss on exit, missing targets, and active dragging', () => {
  const { tip, context, listeners } = fixture();
  const target = { closest: () => ({ dataset: { tip: 'fixture text' } }) };
  listeners.get('mouseover')({ target });
  listeners.get('mouseout')({ target, relatedTarget: null });
  assert.equal(tip.classList.contains('on'), false);
  listeners.get('mouseover')({ target });
  listeners.get('mouseover')({ target: { closest: () => null } });
  assert.equal(tip.classList.contains('on'), false);
  context.dragState = {};
  listeners.get('mouseover')({ target });
  assert.equal(tip.classList.contains('on'), false);
});
