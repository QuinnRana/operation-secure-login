'use server';

import { env } from 'cloudflare:workers';

export type LabRecord = { name: string; role: string; note: string };
export type AttackState = {
  status: 'idle' | 'error' | 'success';
  message: string;
  records: LabRecord[];
  query?: string;
};

async function prepareLab(labDb: D1Database) {
  await labDb.prepare(`
    CREATE TABLE IF NOT EXISTS lab_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      private_note TEXT NOT NULL
    )
  `).run();

  const existing = await labDb.prepare('SELECT id FROM lab_accounts LIMIT 1').first();
  if (!existing) {
    await labDb.batch([
      labDb.prepare('INSERT INTO lab_accounts (username, password, display_name, role, private_note) VALUES (?, ?, ?, ?, ?)').bind('alex', 'falcon7', 'Alex Morgan', 'Finance Intern', 'Training record: invoice review due Friday.'),
      labDb.prepare('INSERT INTO lab_accounts (username, password, display_name, role, private_note) VALUES (?, ?, ?, ?, ?)').bind('jamie', 'spring22', 'Jamie Lee', 'Help Desk', 'Training record: temporary badge 1042.'),
      labDb.prepare('INSERT INTO lab_accounts (username, password, display_name, role, private_note) VALUES (?, ?, ?, ?, ?)').bind('casey', 'welcome1', 'Casey Rivera', 'Operations', 'Training record: vendor meeting moved to 3 PM.'),
    ]);
  }
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

  // Never fall back to the secure login database, including for seed writes.
  const labDb = env.LAB_DB;
  if (!labDb || labDb === env.DB) {
    return { status: 'error', message: 'The isolated Attack Lab database is unavailable.', records: [] };
  }

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
