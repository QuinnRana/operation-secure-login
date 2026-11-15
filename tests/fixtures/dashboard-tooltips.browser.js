/* global S, ui, normalizeLive, applyMembers, render, iso, addD, tip, barMove, dragState */
// Appended to the real dashboard instead of its network/bootstrap routine.
// Only disposable fictional data is used. No API requests or saved tokens.
(async function checkTooltips() {
  const checks = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise(resolve => setTimeout(resolve, 25));
  const today = iso(new Date());
  const payloads = [
    '<svg onload="window.__tooltipExecuted=true"></svg>',
    '" onmouseover="window.__tooltipExecuted=true" data-probe="',
    '&lt;img src=x onerror=window.__tooltipExecuted=true&gt; & "quoted" \'text\' 🔒',
  ];
  window.__tooltipExecuted = false;
  window.fetch = () => { throw new Error('Network requests are forbidden in this fixture'); };

  async function hover(selector, expected, label) {
    const element = document.querySelector(selector);
    assert(element, `${label}: missing target`);
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await tick();
    assert(!window.__tooltipExecuted, `${label}: script executed`);
    assert(tip.childElementCount === 0, `${label}: tooltip created markup`);
    assert(tip.textContent.includes(expected), `${label}: text was changed or lost`);
    assert(tip.textContent === element.dataset.tip, `${label}: tooltip is not literal attribute text`);
    assert(tip.classList.contains('on'), `${label}: tooltip did not open`);
    element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    assert(!tip.classList.contains('on'), `${label}: tooltip did not dismiss`);
    checks.push(label);
  }

  for (const [index, payload] of payloads.entries()) {
    S = normalizeLive({
      title: 'Disposable dashboard fixture', sub: 'No live data', url: 'https://example.invalid/project',
      branch: 'fixture', mrPrefix: '#',
      milestones: [{ id: 1, title: payload, description: payload, due: addD(today, 7) }],
      issues: [{ id: 1, title: payload, description: 'Fictional issue', author: 'tester', assignee: 'tester',
        msId: 1, labels: [`objective::${payload}`], closed: false, createdAt: `${addD(today, -14)}T12:00:00Z`, due: addD(today, -1) }],
      commits: [{ ts: `${today}T12:00:00Z`, actor: 'tester', msg: 'Fictional commit', sha: '0000000' }],
      merges: [], sprints: [{ start: addD(today, -14), end: addD(today, 14), goal: payload }],
    }, 'github');
    ui.collapsed = []; ui.hidden = []; ui.q = ''; ui.view = 'overview';
    applyMembers(); render();
    await hover('.kpis [data-tip]', payload, `payload ${index}: overdue issue`);
    await hover('.sbar.ms', payload, `payload ${index}: milestone title`);
    await hover('.sbar.obj', payload, `payload ${index}: objective title`);
    await hover('.diamond', payload.slice(0, 60), `payload ${index}: milestone note`);
    await hover('[data-sprint]', payload, `payload ${index}: sprint goal`);
    await hover('[data-bar]', payload, `payload ${index}: issue bar`);
    assert(getComputedStyle(tip).whiteSpace === 'pre-line', 'tooltip line breaks must stay readable');
    assert(document.querySelector('[data-bar]').dataset.tip.includes('\n'), 'issue tooltip needs line breaks');
  }

  // Exercise every rendered tooltip, including the plain numeric chart labels.
  for (const view of ['overview', 'activity', 'board', 'analytics']) {
    ui.view = view; render();
    const elements = [...document.querySelectorAll('#view [data-tip]')];
    if (view !== 'board') assert(elements.length > 0, `${view}: expected tooltip coverage`);
    for (const element of elements) {
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      assert(tip.childElementCount === 0, `${view}: a tooltip contains elements`);
      assert(tip.textContent === element.dataset.tip, `${view}: tooltip text differs`);
      assert(!/<(?:b|br|span)(?:\s|>)/.test(tip.textContent), `${view}: obsolete formatting markup`);
    }
    checks.push(`${view}: ${elements.length} tooltips`);
  }
  ui.view = 'overview'; render();
  const bar = document.querySelector('[data-bar]');
  dragState = { i: S.issues[0], bar, x0: 0, moved: false, mode: 'move', l0: 0, w0: 100 };
  barMove({ clientX: 16, clientY: 16 });
  assert(tip.childElementCount === 0 && tip.textContent.startsWith('#1 '), 'drag tooltip must be text');
  dragState = null;
  checks.push('drag feedback stays text');
  await tick();
  assert(!window.__tooltipExecuted, 'a payload executed after rendering');

  const output = document.createElement('pre');
  output.id = 'dashboard-tooltip-results';
  output.dataset.status = 'passed';
  output.textContent = JSON.stringify({ checks });
  document.body.append(output);
})().catch(error => {
  const output = document.createElement('pre');
  output.id = 'dashboard-tooltip-results';
  output.dataset.status = 'failed';
  output.textContent = error.message;
  document.body.append(output);
});
