'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { recoverPassword, type AccountState } from '@/app/account-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: AccountState = { status: 'idle', message: '' };

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState(recoverPassword, initialState);
  const completed = state.status === 'success';

  return <div className="space-y-5">
    <form action={formAction} className="space-y-5" aria-busy={pending}>
      <div className="space-y-2">
        <label htmlFor="recovery-username" className="text-sm font-medium">Username</label>
        <Input id="recovery-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} required readOnly={pending || completed} />
      </div>
      <div className="space-y-2">
        <label htmlFor="recovery-key" className="text-sm font-medium">Recovery key</label>
        <Input id="recovery-key" name="recoveryKey" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={64} maxLength={64} pattern="[a-f0-9]{64}" aria-describedby="recovery-key-help" required readOnly={pending || completed} />
        <p id="recovery-key-help" className="text-xs text-muted-foreground">The 64-character key you saved from your dashboard.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="new-password" className="text-sm font-medium">New password</label>
        <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={1024} aria-describedby="new-password-help" required readOnly={pending || completed} />
        <p id="new-password-help" className="text-xs text-muted-foreground">At least 12 characters. Use a unique training password.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-new-password" className="text-sm font-medium">Confirm new password</label>
        <Input id="confirm-new-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required readOnly={pending || completed} />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Resetting your password signs out all sessions and consumes this recovery key.</p>
      <Button type="submit" disabled={pending || completed} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">{pending ? <><LoaderCircle className="animate-spin" />Resetting password…</> : 'Reset password'}</Button>
    </form>
    <output className="block" aria-live="polite" aria-atomic="true">
      {!pending && state.status !== 'idle' && <p className={completed ? 'rounded-xl bg-emerald-400/10 p-4 text-sm text-emerald-300' : 'rounded-xl bg-red-400/10 p-4 text-sm text-red-300'}>{state.message}</p>}
    </output>
    {completed && <p className="text-sm leading-6 text-muted-foreground">Log in with your new password, then create and save a new recovery key from your dashboard.</p>}
    <Link href="/" className="block text-center text-sm font-medium text-emerald-300 underline underline-offset-4">Back to log in</Link>
  </div>;
}
