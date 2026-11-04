'use server';

import { env } from 'cloudflare:workers';

export type LabRecord = { name: string; role: string; note: string };
export type AttackState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  records: LabRecord[];
  query?: string;
};
export type ResetState = { status: 'idle' | 'error' | 'success'; message: string };

const unavailableMessage = 'The isolated Attack Lab database is unavailable.';

// Never fall back to the secure login database, including for seed writes.
function isolatedLabDb() {
  const labDb = env.LAB_DB;
  return labDb && labDb !== env.DB ? labDb : null;
}

async function prepareLab(labDb: D1Database, reset = false) {
  // D1 batches are transactions: no caller can observe a half-reset table.
  const create = labDb.prepare(`
    CREATE TABLE IF NOT EXISTS lab_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      private_note TEXT NOT NULL
    )
  `);
  // Test emptiness and insert all three rows in one statement. A separate
  // SELECT followed by inserts races with both first logins and resets.
  const seed = labDb.prepare(`
    INSERT INTO lab_accounts (username, password, display_name, role, private_note)
    SELECT column1, column2, column3, column4, column5
    FROM (VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?))
    WHERE NOT EXISTS (SELECT 1 FROM lab_accounts)
  `).bind(
    'alex', 'falcon7', 'Alex Morgan', 'Finance Intern', 'Training record: invoice review due Friday.',
    'jamie', 'spring22', 'Jamie Lee', 'Help Desk', 'Training record: temporary badge 1042.',
    'casey', 'welcome1', 'Casey Rivera', 'Operations', 'Training record: vendor meeting moved to 3 PM.',
  );
  await labDb.batch([
    ...(reset ? [labDb.prepare('DROP TABLE IF EXISTS lab_accounts')] : []),
    create,
    seed,
  ]);
}

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function vulnerableLogin(
  _previousState: AttackState,
  formData: FormData,
): Promise<AttackState> {
  const username = formText(formData, 'username');
  const password = formText(formData, 'password');
  if (!username || !password) return { status: 'error', message: 'Enter both fields.', records: [] };

  const labDb = isolatedLabDb();
  if (!labDb) return { status: 'error', message: unavailableMessage, records: [] };

  await prepareLab(labDb);

  // Intentionally vulnerable for this isolated classroom exercise.
  // The Defend phase replaces this string-built query with bound parameters.
  const query = `SELECT display_name, role, private_note FROM lab_accounts WHERE username = '${username}' AND password = '${password}'`;

  try {
    const result = await labDb.prepare(query).all<{
      display_name: string;
      role: string;
      private_note: string;
    }>();
    const records = result.results.map((row) => ({
      name: row.display_name,
      role: row.role,
      note: row.private_note,
    }));

    if (!records.length) return { status: 'error', message: 'Login failed.', records: [], query };
    return {
      status: 'success',
      message: `Login bypassed. ${records.length} fictional record${records.length === 1 ? '' : 's'} exposed.`,
      records,
      query,
    };
  } catch {
    return { status: 'error', message: 'The database rejected that input. Check the lab instructions and try again.', records: [], query };
  }
}

// Restores the fictional seed records. Only the lab table in LAB_DB is touched.
export async function resetLab(): Promise<ResetState> {
  const labDb = isolatedLabDb();
  if (!labDb) return { status: 'error', message: unavailableMessage };

  try {
    await prepareLab(labDb, true);
  } catch {
    return { status: 'error', message: 'The lab reset failed. Restart the local server and try again.' };
  }
  return { status: 'success', message: 'Lab data reset to the 3 fictional seed records.' };
}
