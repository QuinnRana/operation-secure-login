'use server';

import { env } from 'cloudflare:workers';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { login, type LoginState } from '@/app/actions';
import { createSession, destroySession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

// The credential check, validation and rate limiting all stay in `login`.
// A session starts only after it reports success.
export async function signIn(previousState: LoginState, formData: FormData): Promise<LoginState> {
  const result = await login(previousState, formData);
  if (result.status !== 'success') return result;

  // `login` succeeded, so exactly one string username was submitted.
  const submitted = formData.get('username');
  if (typeof submitted !== 'string') return { status: 'error', message: 'Login is temporarily unavailable. Try again later.' };
  const username = submitted.trim();
  try {
    const { token, expiresAt } = await createSession(env.DB, username);
    const origin = (await headers()).get('origin');
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(origin, expiresAt));
  } catch {
    return { status: 'error', message: 'Login is temporarily unavailable. Try again later.' };
  }
  redirect('/account');
}

export async function signOut() {
  const cookieStore = await cookies();
  try {
    await destroySession(env.DB, cookieStore.get(SESSION_COOKIE)?.value);
  } finally {
    cookieStore.delete(SESSION_COOKIE);
  }
  redirect('/');
}
