'use server';

import { isolatedLabDb, labUnavailableMessage } from '@/lib/lab-db';
import { hashPassword, safeEqual } from '@/lib/password';

export type DefendedState = { status: 'idle' | 'error' | 'success'; message: string };
export type DefendedResetState = { status: 'idle' | 'error' | 'success'; message: string };

const failureMessage = 'The username or password is incorrect.';

// The same fictional accounts as the vulnerable lab, so the same valid
// credentials and the same attack payload can be compared on both pages.
const seedAccounts = [
  { username: 'alex', password: 'falcon7', displayName: 'Alex Morgan', role: 'Finance Intern', note: 'Training record: invoice review due Friday.' },
  { username: 'jamie', password: 'spring22', displayName: 'Jamie Lee', role: 'Help Desk', note: 'Training record: temporary badge 1042.' },
  { username: 'casey', password: 'welcome1', displayName: 'Casey Rivera', role: 'Operations', note: 'Training record: vendor meeting moved to 3 PM.' },
];

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function prepareDefendedLab(labDb: D1Database, reset = false) {
  const create = labDb.prepare(`
    CREATE TABLE IF NOT EXISTS defended_lab_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      private_note TEXT NOT NULL
    )
  `);

  // Hashing is slow by design, so only derive seed hashes when they are needed.
  if (!reset) {
    await create.run();
    if (await labDb.prepare('SELECT 1 FROM defended_lab_accounts LIMIT 1').first()) return;
  }

  const rows = await Promise.all(seedAccounts.map(async (account) => {
    const salt = randomSalt();
    return [account.username, await hashPassword(account.password, salt), salt, account.displayName, account.role, account.note];
  }));
  // Insert only into an empty table, in the same transaction, so overlapping
  // first logins and resets cannot duplicate the seed.
  const seed = labDb.prepare(`
    INSERT INTO defended_lab_accounts (username, password_hash, password_salt, display_name, role, private_note)
    SELECT column1, column2, column3, column4, column5, column6
    FROM (VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?))
    WHERE NOT EXISTS (SELECT 1 FROM defended_lab_accounts)
  `).bind(...rows.flat());
  await labDb.batch([
    ...(reset ? [labDb.prepare('DROP TABLE IF EXISTS defended_lab_accounts')] : []),
    create,
    seed,
  ]);
}

export async function defendedLogin(
  _previousState: DefendedState,
  formData: FormData,
): Promise<DefendedState> {
  const usernames = formData.getAll('username');
  const passwords = formData.getAll('password');
  if (usernames.length !== 1 || passwords.length !== 1 ||
      typeof usernames[0] !== 'string' || typeof passwords[0] !== 'string' ||
      usernames[0].length > 256 || passwords[0].length > 1024) {
    return { status: 'error', message: 'Enter one valid username and password within the supported lengths.' };
  }
  const username = usernames[0];
  const password = passwords[0];
  if (!username || !password) return { status: 'error', message: 'Enter both fields.' };

  const labDb = isolatedLabDb();
  if (!labDb) return { status: 'error', message: labUnavailableMessage };

  try {
    await prepareDefendedLab(labDb);
    // Bound parameter: the input is only ever compared as data.
    const account = await labDb.prepare(
      'SELECT password_hash, password_salt, display_name FROM defended_lab_accounts WHERE username = ? LIMIT 1',
    )
      .bind(username)
      .first<{ password_hash: string; password_salt: string; display_name: string }>();

    // Hash even for unknown users so both failures take similar time.
    const candidate = await hashPassword(password, account?.password_salt ?? randomSalt());
    if (!account || !safeEqual(candidate, account.password_hash)) {
      return { status: 'error', message: failureMessage };
    }
    return { status: 'success', message: `Access granted. Welcome, ${account.display_name}.` };
  } catch {
    // Never echo the input, query or database error back to the page.
    return { status: 'error', message: 'The defended lab could not check that login. Try again.' };
  }
}

// Restores the defended seed with fresh random salts. Only the defended table in LAB_DB is touched.
export async function resetDefendedLab(): Promise<DefendedResetState> {
  const labDb = isolatedLabDb();
  if (!labDb) return { status: 'error', message: labUnavailableMessage };

  try {
    await prepareDefendedLab(labDb, true);
  } catch {
    return { status: 'error', message: 'The defended lab reset failed. Restart the local server and try again.' };
  }
  return { status: 'success', message: 'Defended lab reset to the 3 fictional accounts with new password hashes.' };
}
