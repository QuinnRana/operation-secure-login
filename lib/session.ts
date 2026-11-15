export const SESSION_COOKIE = 'osl_session';
export const SESSION_TTL_SECONDS = 30 * 60;

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Only a digest of the token is stored, so a copy of the table cannot be replayed as a cookie.
async function tokenDigest(token: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token))));
}

async function prepareSessions(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)').run();
}

export async function createSession(db: D1Database, username: string, now = Date.now()) {
  await prepareSessions(db);
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = now + SESSION_TTL_SECONDS * 1000;
  // Remove a bounded number of expired rows so the table does not grow without limit.
  await db.prepare(`DELETE FROM sessions WHERE token_hash IN (
    SELECT token_hash FROM sessions WHERE expires_at <= ? LIMIT 100
  )`).bind(now).run();
  await db.prepare('INSERT INTO sessions (token_hash, username, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await tokenDigest(token), username, now, expiresAt)
    .run();
  return { token, expiresAt };
}

// Returns the signed-in user for a cookie value, or null. Expired sessions are deleted.
export async function readSession(db: D1Database, token: string | undefined, now = Date.now()) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  await prepareSessions(db);
  const digest = await tokenDigest(token);
  const row = await db.prepare('SELECT username, expires_at FROM sessions WHERE token_hash = ? LIMIT 1')
    .bind(digest)
    .first<{ username: string; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(digest).run();
    return null;
  }
  return { username: row.username, expiresAt: row.expires_at };
}

export async function destroySession(db: D1Database, token: string | undefined) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return;
  await prepareSessions(db);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await tokenDigest(token)).run();
}

// Secure everywhere except plain-http localhost during development.
export function sessionCookieOptions(origin: string | null, expiresAt: number, now = Date.now()) {
  const localHttp = origin !== null && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  return {
    httpOnly: true,
    secure: !localHttp,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor((expiresAt - now) / 1000)),
  };
}
