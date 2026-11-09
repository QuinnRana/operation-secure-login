'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { createRecoveryKey, logout, type AccountState } from '@/app/account-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: AccountState = { status: 'idle', message: '' };

function LogoutButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? 'Logging out…' : 'Log out'}</Button>;
}

export function AccountControls({ csrfToken, hasRecoveryKey, isDemo }: {
  csrfToken: string; hasRecoveryKey: boolean; isDemo: boolean;
}) {
  const [state, formAction, pending] = useActionState(createRecoveryKey, initialState);
  const hasKey = hasRecoveryKey || !!state.recoveryKey;

  return (
    <div className="space-y-8">
      <section aria-labelledby="recovery-heading" className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <h2 id="recovery-heading" className="text-xl font-semibold">Password recovery</h2>
        {isDemo ? <p className="text-sm leading-6 text-muted-foreground">The shared student demo cannot create recovery keys or reset its password. Create your own account to use private recovery.</p> : <>
          <p className="text-sm leading-6 text-muted-foreground">Save a recovery key now so you can reset your password if you forget it. There is no email reset service. Keep the key private in a password manager: anyone with it can reset your password.</p>
          <p className="text-sm text-muted-foreground">{hasKey ? 'A recovery key is set. Creating a new key immediately invalidates your previous key.' : 'You have not set up a recovery key yet.'}</p>
          <form action={formAction} className="space-y-4" aria-busy={pending}>
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <div className="space-y-2">
              <label htmlFor="current-password" className="text-sm font-medium">Current password</label>
              <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" maxLength={1024} required readOnly={pending} />
            </div>
            <Button type="submit" disabled={pending}>{pending ? <><LoaderCircle className="animate-spin" />Creating key…</> : hasKey ? 'Replace recovery key' : 'Create recovery key'}</Button>
          </form>
          {/* Keep the credential outside the form so React's form reset cannot erase it. */}
          <output className="block" aria-live="polite" aria-atomic="true">
            {!pending && state.status !== 'idle' && <p className={state.status === 'error' ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}>{state.message}</p>}
          </output>
          {!pending && state.recoveryKey && <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4">
            <p className="text-sm font-semibold text-amber-200">Save this key now. It will not be shown again after you leave this page.</p>
            <label htmlFor="generated-key" className="block text-sm">Your new recovery key</label>
            <textarea id="generated-key" readOnly value={state.recoveryKey} rows={3} autoComplete="off" spellCheck={false} className="w-full resize-none rounded-md border border-white/20 bg-background p-3 font-mono text-sm break-all" onFocus={event => event.target.select()} />
            <p className="text-xs leading-5 text-muted-foreground">Store it privately in your password manager. Using it resets your password, signs out every session, and consumes the key. You will need to create a new key after signing in again.</p>
          </div>}
        </>}
      </section>
      <form action={logout}>
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <LogoutButton />
      </form>
    </div>
  );
}
