'use server';

import { env } from 'cloudflare:workers';

import { hashPassword, safeEqual } from '@/lib/password';

export type LoginState = { status: 'idle' | 'error' | 'success'; message: string };

const demoUsername = 'student';
const demoPassword = 'Training123!';
const demoSalt = 'operation-secure-login-demo-salt';

async function prepareDatabase() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

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
    return { status: 'error', message: 'Enter one valid username and password within the supported lengths.' };
  }
  const username = usernames[0].trim();
  const password = passwords[0];

  if (!username || !password) {
    return { status: 'error', message: 'Enter both a username and password.' };
  }

  await prepareDatabase();
  const user = await env.DB.prepare(
    'SELECT password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
  )
    .bind(username)
    .first<{ password_hash: string; password_salt: string }>();

  if (!user) {
    return { status: 'error', message: 'The username or password is incorrect.' };
  }

  const candidateHash = await hashPassword(password, user.password_salt);
  if (!safeEqual(candidateHash, user.password_hash)) {
    return { status: 'error', message: 'The username or password is incorrect.' };
  }

  return { status: 'success', message: `Access granted. Welcome, ${username}.` };
}
