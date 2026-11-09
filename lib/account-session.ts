import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { ensureUsersTable } from '@/lib/account-db';

export const SESSION_COOKIE = '__Host-osl-session';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
export const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' };

export function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function digestSecret(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Origin is browser-controlled. Do not trust forwarded headers or form-supplied hosts.
// All account mutations fail closed without a same-origin browser POST.
export async function isSameOriginRequest() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('host');
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return origin === url.origin && url.host === host &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && local));
  } catch { return false; }
}

export async function prepareAccountSecurity() {
  await ensureUsersTable();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_security (
    user_id INTEGER PRIMARY KEY,
    credential_version TEXT NOT NULL,
    recovery_hash TEXT
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS account_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    credential_version TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS account_session_expiry ON account_sessions(expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS account_session_user ON account_sessions(user_id)').run();
}

export async function startSession(userId: number, verifiedPasswordHash: string) {
  await prepareAccountSecurity();
  await env.DB.prepare('INSERT OR IGNORE INTO account_security (user_id, credential_version) VALUES (?, ?)')
    .bind(userId, randomSecret()).run();
  const token = randomSecret();
  const tokenHash = await digestSecret(token);
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;
  // Recheck the password hash in the same statement that issues the session.
  // A password recovery racing this login cannot resurrect the old credential.
  const created = await env.DB.prepare(`INSERT INTO account_sessions (token_hash, user_id, credential_version, expires_at)
    SELECT ?, users.id, account_security.credential_version, ? FROM users
    JOIN account_security ON account_security.user_id = users.id
    WHERE users.id = ? AND users.password_hash = ? RETURNING token_hash`)
    .bind(tokenHash, expiresAt, userId, verifiedPasswordHash).first();
  if (!created) throw new Error('Credentials changed');
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous && /^[a-f0-9]{64}$/.test(previous)) {
    await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(await digestSecret(previous)).run();
  }
  // Expiry cleanup is bounded; the authentication query always checks expiry.
  await env.DB.prepare(`DELETE FROM account_sessions WHERE token_hash IN
    (SELECT token_hash FROM account_sessions WHERE expires_at <= ? LIMIT 100)`).bind(Date.now()).run();
  jar.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_LIFETIME_MS / 1000, expires: new Date(expiresAt) });
}

export async function getCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await prepareAccountSecurity();
  const tokenHash = await digestSecret(token);
  const row = await env.DB.prepare(`SELECT users.id, users.username, users.created_at,
    account_sessions.expires_at, account_security.recovery_hash
    FROM account_sessions JOIN users ON users.id = account_sessions.user_id
    JOIN account_security ON account_security.user_id = users.id
    WHERE account_sessions.token_hash = ? AND account_sessions.expires_at > ?
      AND account_sessions.credential_version = account_security.credential_version LIMIT 1`)
    .bind(tokenHash, Date.now()).first<{ id: number; username: string; created_at: string; expires_at: number; recovery_hash: string | null }>();
  if (!row) return null;
  return { userId: row.id, username: row.username, createdAt: row.created_at, expiresAt: row.expires_at,
    csrfToken: await digestSecret(`csrf:${token}`), tokenHash, hasRecoveryKey: !!row.recovery_hash, isDemo: row.username === 'student' };
}
