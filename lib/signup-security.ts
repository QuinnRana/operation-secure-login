const ATTEMPTS = 10;
const WINDOW_MS = 60_000;

// A deliberately conservative shared budget for this small classroom service.
// Unlike a username-only limit, rotating usernames cannot bypass this budget.
// It is separate from sign-in quotas, so registration never locks out a login.
export async function reserveSignupAttempt(db: D1Database): Promise<boolean> {
  const now = Date.now();
  await db.prepare(`CREATE TABLE IF NOT EXISTS signup_attempt_limits (
    scope TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  const row = await db.prepare(`
    INSERT INTO signup_attempt_limits (scope, attempts, expires_at) VALUES ('global', 1, ?)
    ON CONFLICT(scope) DO UPDATE SET
      attempts = CASE WHEN expires_at <= ? THEN 1 ELSE MIN(attempts + 1, ?) END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING attempts
  `).bind(now + WINDOW_MS, now, ATTEMPTS + 1, now).first<{ attempts: number }>();
  if (!row || !Number.isInteger(row.attempts) || row.attempts < 1) throw new Error('Invalid signup budget');
  return row.attempts <= ATTEMPTS;
}
