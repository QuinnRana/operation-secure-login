'use server';

import { env } from 'cloudflare:workers';

import { hashPassword, safeEqual } from '@/lib/password';
import { logLogin, reserveLoginAttempt } from '@/lib/login-security';
import { reserveSignupAttempt } from '@/lib/signup-security';
import { isSameOriginRequest, startSession } from '@/lib/account-session';
import { ensureUsersTable } from '@/lib/account-db';

export type LoginState = { status: 'idle' | 'error' | 'success'; message: string; username?: string; redirectTo?: string };

const demoUsername = 'student';
const demoPassword = 'Training123!';
const demoSalt = 'operation-secure-login-demo-salt';

async function prepareDatabase() {
  await ensureUsersTable();

  const passwordHash = await hashPassword(demoPassword, demoSalt);
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)',
  )
    .bind(demoUsername, passwordHash, demoSalt)
    .run();
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const usernames = formData.getAll('username');
  const passwords = formData.getAll('password');
  // Bound raw strings before trimming, encoding, hashing, or database work.
  // Ignore unrelated fields, including framework server-action metadata.
  if (usernames.length !== 1 || passwords.length !== 1 ||
      typeof usernames[0] !== 'string' || typeof passwords[0] !== 'string' ||
      usernames[0].length > 256 || passwords[0].length > 1024) {
    logLogin('invalid_input');
    return { status: 'error', message: 'Enter one valid username and password within the supported lengths.' };
  }
  const username = usernames[0].trim();
  const password = passwords[0];

  if (!username || !password) {
    logLogin('invalid_input');
    return { status: 'error', message: 'Enter both a username and password.' };
  }

  try {
    if (!await isSameOriginRequest()) return { status: 'error', message: 'Reload this page and submit the form again.' };
    if (!await reserveLoginAttempt(env.DB, username)) {
      logLogin('throttled');
      return { status: 'error', message: 'Too many login attempts. Try again in a minute.' };
    }
    await prepareDatabase();
    const user = await env.DB.prepare(
      'SELECT id, password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
    )
      .bind(username)
      .first<{ id: number; password_hash: string; password_salt: string }>();

    // Unknown accounts perform the same credential derivation as known accounts.
    // This reduces the large hash-work timing distinction, not all timing variance.
    const candidateHash = await hashPassword(password, user?.password_salt ?? demoSalt);
    if (!user || !safeEqual(candidateHash, user.password_hash)) {
      logLogin('denied');
      return { status: 'error', message: 'The username or password is incorrect.' };
    }

    await startSession(user.id, user.password_hash);
    logLogin('success');
    return { status: 'success', message: `Access granted. Welcome, ${username}.`, redirectTo: '/dashboard' };
  } catch {
    logLogin('unavailable');
    return { status: 'error', message: 'Login is temporarily unavailable. Try again later.' };
  }
}


export async function register(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const usernames = formData.getAll('username');
  const passwords = formData.getAll('password');
  const confirmations = formData.getAll('confirmPassword');
  if (usernames.length !== 1 || passwords.length !== 1 || confirmations.length !== 1 ||
      typeof usernames[0] !== 'string' || typeof passwords[0] !== 'string' ||
      typeof confirmations[0] !== 'string' || usernames[0].length > 256 ||
      passwords[0].length > 1024 || confirmations[0].length > 1024) {
    logLogin('invalid_input', 'secure_signup');
    return { status: 'error', message: 'Enter one valid username, password, and password confirmation.' };
  }
  const username = usernames[0].trim();
  const password = passwords[0];
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) {
    logLogin('invalid_input', 'secure_signup');
    return { status: 'error', message: 'Use 3–64 letters, numbers, periods, underscores, or hyphens for your username.' };
  }
  if (password.length < 12) {
    logLogin('invalid_input', 'secure_signup');
    return { status: 'error', message: 'Choose a password with at least 12 characters.' };
  }
  if (password !== confirmations[0]) {
    logLogin('invalid_input', 'secure_signup');
    return { status: 'error', message: 'The passwords do not match.' };
  }

  try {
    if (!await isSameOriginRequest()) return { status: 'error', message: 'Reload this page and submit the form again.' };
    if (!await reserveSignupAttempt(env.DB)) {
      logLogin('throttled', 'secure_signup');
      return { status: 'error', message: 'Too many account creation attempts. Try again in a minute.' };
    }
    await prepareDatabase();
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    const passwordHash = await hashPassword(password, salt);
    // The UNIQUE constraint arbitrates concurrent signups. Never replace an
    // existing account or its password, including the classroom demo account.
    const created = await env.DB.prepare(`
      INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)
      ON CONFLICT(username) DO NOTHING RETURNING id
    `).bind(username, passwordHash, salt).first<{ id: number }>();
    if (!created) {
      logLogin('denied', 'secure_signup');
      return { status: 'error', message: 'That username is unavailable. Choose another or log in to your existing account.' };
    }
    logLogin('success', 'secure_signup');
    return { status: 'success', username, message: `Account created for ${username}. You can now log in with your new password.` };
  } catch {
    logLogin('unavailable', 'secure_signup');
    return { status: 'error', message: 'Account creation is temporarily unavailable. Try again later.' };
  }
}
