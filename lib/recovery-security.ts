import { digestSecret } from '@/lib/account-session';

// Independent global and account quotas prevent username rotation and avoid
// spending login quotas. Successful requests consume quota too.
export async function reserveRecoveryAttempt(db: D1Database, username: string) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS recovery_attempt_limits (
    scope TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
  )`).run();
  const now = Date.now();
  await db.prepare(`DELETE FROM recovery_attempt_limits WHERE scope IN
    (SELECT scope FROM recovery_attempt_limits WHERE expires_at <= ? LIMIT 100)`).bind(now).run();
  for (const [scope, limit] of [['global', 10], [`account:${await digestSecret(username)}`, 5]] as const) {
    const row = await db.prepare(`INSERT INTO recovery_attempt_limits (scope, attempts, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(scope) DO UPDATE SET
        attempts = CASE WHEN expires_at <= ? THEN 1 ELSE MIN(attempts + 1, ?) END,
        expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
      RETURNING attempts`).bind(scope, now + 60_000, now, limit + 1, now).first<{ attempts: number }>();
    if (!row || !Number.isInteger(row.attempts) || row.attempts < 1) throw new Error('Invalid recovery budget');
    if (row.attempts > limit) return false;
  }
  return true;
}
