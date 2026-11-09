'use server';

import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cookieOptions, digestSecret, getCurrentSession, isSameOriginRequest, prepareAccountSecurity, randomSecret, SESSION_COOKIE } from '@/lib/account-session';
import { hashPassword, safeEqual } from '@/lib/password';
import { reserveLoginAttempt, logLogin } from '@/lib/login-security';
import { reserveRecoveryAttempt } from '@/lib/recovery-security';

export type AccountState = { status: 'idle' | 'error' | 'success'; message: string; recoveryKey?: string };

function field(data: FormData, name: string, max: number) {
  const values = data.getAll(name);
  return values.length === 1 && typeof values[0] === 'string' && values[0].length <= max ? values[0] : null;
}
const retry = { status: 'error', message: 'Reload the page, sign in if needed, and try again.' } as const;
const denied = { status: 'error', message: 'The username or recovery key is incorrect or no longer valid.' } as const;

export async function logout(data: FormData): Promise<void> {
  if (!await isSameOriginRequest()) return;
  const session = await getCurrentSession();
  if (!session || !safeEqual(field(data, 'csrfToken', 64) ?? '', session.csrfToken)) return;
  await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
  (await cookies()).set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0, expires: new Date(0) });
  redirect('/');
}

export async function createRecoveryKey(_previous: AccountState, data: FormData): Promise<AccountState> {
  const password = field(data, 'currentPassword', 1024);
  if (!password) return { status: 'error', message: 'Enter your current password.' };
  try {
    if (!await isSameOriginRequest()) return retry;
    const session = await getCurrentSession();
    if (!session || !safeEqual(field(data, 'csrfToken', 64) ?? '', session.csrfToken)) return retry;
    if (session.isDemo) return { status: 'error', message: 'The shared demo account cannot have a recovery key. Create your own account.' };
    if (!await reserveLoginAttempt(env.DB, session.username)) return { status: 'error', message: 'Too many password checks. Try again in a minute.' };
    const user = await env.DB.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').bind(session.userId)
      .first<{ password_hash: string; password_salt: string }>();
    if (!user || !safeEqual(await hashPassword(password, user.password_salt), user.password_hash)) {
      return { status: 'error', message: 'The current password is incorrect.' };
    }
    const key = randomSecret();
    // Guard both the credential and session in the write: reset/logout races
    // cannot enroll a new key using an already revoked session or password.
    const updated = await env.DB.prepare(`UPDATE account_security SET recovery_hash = ? WHERE user_id = ?
      AND EXISTS (SELECT 1 FROM users WHERE users.id = account_security.user_id AND users.password_hash = ?)
      AND EXISTS (SELECT 1 FROM account_sessions WHERE token_hash = ? AND user_id = account_security.user_id
        AND expires_at > ? AND credential_version = account_security.credential_version) RETURNING user_id`)
      .bind(await digestSecret(key), session.userId, user.password_hash, session.tokenHash, Date.now()).first();
    if (!updated) return retry;
    logLogin('success', 'secure_recovery_key');
    return { status: 'success', message: 'Save this recovery key privately. It is shown only once and replaces any previous key.', recoveryKey: key };
  } catch {
    logLogin('unavailable', 'secure_recovery_key');
    return { status: 'error', message: 'Recovery key setup is temporarily unavailable. Try again later.' };
  }
}

export async function recoverPassword(_previous: AccountState, data: FormData): Promise<AccountState> {
  const rawUsername = field(data, 'username', 256);
  const key = field(data, 'recoveryKey', 64);
  const password = field(data, 'newPassword', 1024);
  const confirm = field(data, 'confirmPassword', 1024);
  if (!rawUsername?.trim() || !key || !/^[a-f0-9]{64}$/.test(key) || !password || password.length < 12 || password !== confirm) {
    return { status: 'error', message: 'Enter your username, 64-character recovery key, and matching new passwords of at least 12 characters.' };
  }
  const username = rawUsername.trim();
  try {
    if (!await isSameOriginRequest()) return retry;
    if (!await reserveRecoveryAttempt(env.DB, username)) {
      logLogin('throttled', 'secure_recovery');
      return { status: 'error', message: 'Too many recovery attempts. Try again in a minute.' };
    }
    await prepareAccountSecurity();
    const recoveryHash = await digestSecret(key);
    const salt = randomSecret();
    // Equal password-derivation work for known, unknown and invalid keys.
    const passwordHash = await hashPassword(password, salt);
    // D1 batch is transactional. Consume the key, change the credential, and
    // invalidate all sessions together. The conditional writes admit one winner.
    const results = await env.DB.batch([
      env.DB.prepare(`UPDATE users SET password_hash = ?, password_salt = ?
        WHERE username = ? AND username != 'student' AND id IN
          (SELECT user_id FROM account_security WHERE recovery_hash = ?) RETURNING id`)
        .bind(passwordHash, salt, username, recoveryHash),
      env.DB.prepare(`UPDATE account_security SET recovery_hash = NULL, credential_version = ?
        WHERE recovery_hash = ? AND user_id IN
          (SELECT id FROM users WHERE username = ? AND username != 'student' AND password_hash = ? AND password_salt = ?)
        RETURNING user_id`).bind(randomSecret(), recoveryHash, username, passwordHash, salt),
    ]);
    if (results[0].results.length !== 1 || results[1].results.length !== 1) {
      logLogin('denied', 'secure_recovery');
      return denied;
    }
    logLogin('success', 'secure_recovery');
    return { status: 'success', message: 'Password reset. All previous sessions and this recovery key are invalid. Log in with your new password, then save a new recovery key from your dashboard.' };
  } catch {
    logLogin('unavailable', 'secure_recovery');
    return { status: 'error', message: 'Password recovery is temporarily unavailable. Try again later.' };
  }
}
