'use server';

import { redirect } from 'next/navigation';

import { login, type LoginState } from '@/app/actions';
import { logout } from '@/app/account-actions';

// The credential check, validation and rate limiting all stay in `login`.
// `login` also issues the one versioned account session. Never issue a second
// cookie/store here: password recovery and both protected pages must agree.
export async function signIn(previousState: LoginState, formData: FormData): Promise<LoginState> {
  const result = await login(previousState, formData);
  if (result.status !== 'success') return result;
  redirect('/account');
}

export async function signOut(formData: FormData) {
  return logout(formData);
}
