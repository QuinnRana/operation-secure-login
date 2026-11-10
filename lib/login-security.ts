const ATTEMPTS = 5;
const WINDOW_MS = 60_000;

export function logLogin(outcome: 'invalid_input' | 'denied' | 'success' | 'throttled' | 'unavailable', event: 'secure_login' | 'defended_login' | 'secure_signup' | 'secure_recovery' | 'secure_recovery_key' | 'secure_logout' = 'secure_login') {
  console.info(JSON.stringify({ event, outcome, timestamp: new Date(Date.now()).toISOString() }));
}

// Call after input validation, before account lookup or password hashing.
// Every valid-shaped attempt consumes quota, including successful logins.
export async function reserveLoginAttempt(db: D1Database, username: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(username));
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  await db.prepare(`CREATE TABLE IF NOT EXISTS login_attempt_limits (
    account_key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS login_attempt_expiry ON login_attempt_limits(expires_at)').run();
  // Bound cleanup work; never delete application accounts or unexpired quotas.
  await db.prepare(`DELETE FROM login_attempt_limits WHERE account_key IN (
    SELECT account_key FROM login_attempt_limits WHERE expires_at <= ? LIMIT 100
  )`).bind(now).run();
  // A single write both reserves and returns the counter. No read/check/write race.
  // Blocked requests saturate the counter and never move the window's end.
  const row = await db.prepare(`INSERT INTO login_attempt_limits (account_key, attempts, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(account_key) DO UPDATE SET
      attempts = CASE WHEN expires_at <= ? THEN 1 ELSE MIN(attempts + 1, ?) END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING attempts`).bind(key, now + WINDOW_MS, now, ATTEMPTS + 1, now).first<{ attempts: number }>();
  if (!row || !Number.isInteger(row.attempts) || row.attempts < 1) throw new Error('Invalid login budget');
  return row.attempts <= ATTEMPTS;
}
