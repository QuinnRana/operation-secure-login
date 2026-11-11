const ATTEMPTS = 3;
const WINDOW_MS = 60_000;

// Resets derive three seed hashes, so reserve a lab-wide budget first.
// Keep this table separate from reset data and all login quotas.
export async function reserveDefendedReset(db: D1Database): Promise<boolean> {
  const now = Date.now();
  await db.prepare(`CREATE TABLE IF NOT EXISTS defended_reset_limit (
    scope TEXT PRIMARY KEY CHECK (scope = 'global'),
    attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  // One atomic write admits concurrent callers across Workers. Denied requests
  // saturate the counter without extending the original window.
  const row = await db.prepare(`INSERT INTO defended_reset_limit (scope, attempts, expires_at)
    VALUES ('global', 1, ?)
    ON CONFLICT(scope) DO UPDATE SET
      attempts = CASE WHEN expires_at <= ? THEN 1 ELSE MIN(attempts + 1, ?) END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING attempts`).bind(now + WINDOW_MS, now, ATTEMPTS + 1, now).first<{ attempts: number }>();
  if (!row || !Number.isInteger(row.attempts) || row.attempts < 1) throw new Error('Invalid reset budget');
  return row.attempts <= ATTEMPTS;
}
