'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';

import { login, register, type LoginState } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: LoginState = { status: 'idle', message: '' };
type Mode = 'login' | 'signup';

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('login');
  const [accountUsername, setAccountUsername] = useState('');

  function changeMode(next: Mode, username = '') {
    setAccountUsername(username);
    setMode(next);
  }

  return <AccountForm key={mode} mode={mode} initialUsername={accountUsername} changeMode={changeMode} />;
}

function AccountForm({ mode, initialUsername, changeMode }: {
  mode: Mode;
  initialUsername: string;
  changeMode: (mode: Mode, username?: string) => void;
}) {
  const router = useRouter();
  const creating = mode === 'signup';
  const [state, formAction, pending] = useActionState(creating ? register : login, initialState);
  const [username, setUsername] = useState(initialUsername);
  const [completedCelebration, setCompletedCelebration] = useState<LoginState | null>(null);
  const celebrating = !creating && !pending && state.status === 'success' && completedCelebration !== state;

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCompletedCelebration(state), 4500);
    return () => window.clearTimeout(timer);
  }, [state, celebrating]);

  useEffect(() => {
    if (creating || pending || state.status !== 'success' || state.redirectTo !== '/dashboard') return;
    const timer = window.setTimeout(() => router.replace('/dashboard'), 1800);
    return () => window.clearTimeout(timer);
  }, [creating, pending, state, router]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2" aria-label="Account options">
        <Button type="button" variant={creating ? 'outline' : 'default'} aria-pressed={!creating} disabled={pending} onClick={() => changeMode('login')}>Log in</Button>
        <Button type="button" variant={creating ? 'default' : 'outline'} aria-pressed={creating} disabled={pending} onClick={() => changeMode('signup')}>Create account</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {creating ? 'Choose your own username and a new password for this training portal.' : 'Use the same username and password each time you return.'}
      </p>
      <form action={formAction} className="space-y-5" aria-busy={pending}>
        {celebrating && (
          <div aria-hidden="true" className="login-confetti">
            {Array.from({ length: 80 }, (_, index) => (
              <span key={index} style={{
                left: `${(index * 37) % 100}%`,
                backgroundColor: ['#34d399', '#fbbf24', '#f472b6', '#60a5fa', '#c084fc'][index % 5],
                width: `${6 + index % 5}px`,
                height: `${10 + index % 7}px`,
                borderRadius: index % 3 === 0 ? '50%' : '1px',
                animationDelay: `${(index % 13) * 0.06}s`,
                animationDuration: `${2.6 + (index % 9) * 0.12}s`,
              }} />
            ))}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">Username</label>
          <Input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={username} onChange={event => setUsername(event.target.value)}
            maxLength={creating ? 64 : 256} minLength={creating ? 3 : undefined}
            pattern={creating ? '[A-Za-z0-9_.\\-]{3,64}' : undefined}
            aria-describedby={creating ? 'username-help' : undefined}
            placeholder="Enter your username" className="h-11" required readOnly={pending} />
          {creating && <p id="username-help" className="text-xs text-muted-foreground">3–64 letters, numbers, periods, underscores, or hyphens. Usernames are case-sensitive.</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <Input id="password" name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'}
            minLength={creating ? 12 : undefined} maxLength={1024} aria-describedby={creating ? 'password-help' : undefined}
            placeholder={creating ? 'Create a password' : 'Enter your password'} className="h-11" required readOnly={pending} />
          {creating && <p id="password-help" className="text-xs text-muted-foreground">At least 12 characters. Use a unique training password you do not use elsewhere.</p>}
        </div>
        {creating && <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium">Confirm password</label>
          <Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={1024}
            placeholder="Enter your new password again" className="h-11" required readOnly={pending} />
        </div>}
        <Button type="submit" size="lg" disabled={pending || state.status === 'success'} className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
          {pending ? <><LoaderCircle className="animate-spin" />{creating ? 'Creating account…' : 'Checking account…'}</> : creating ? 'Create account' : 'Log in'}
        </Button>
      </form>
      {/* React form reset clears output contents. Keep status outside the form. */}
      {!pending && state.status !== 'idle' && (
        <output aria-live="polite" className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${state.status === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
          {state.status === 'success' ? <CheckCircle2 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
          {state.message}
        </output>
      )}
      {creating && state.status === 'success' && <Button type="button" className="w-full" onClick={() => changeMode('login', state.username)}>Log in to your new account</Button>}
      {!creating && state.status === 'success' && state.redirectTo === '/dashboard' && <Link href="/dashboard" className="block text-center text-sm font-medium text-emerald-300 underline underline-offset-4">Continue to your dashboard →</Link>}
      {!creating && <Link href="/recover" className="block text-center text-sm text-muted-foreground underline underline-offset-4">Forgot your password?</Link>}
      {creating && <p className="text-xs text-muted-foreground">After signing in, save a recovery key from your dashboard so you can reset a forgotten password.</p>}
      <p className="text-xs leading-5 text-muted-foreground">Accounts are saved in this portal’s database. Passwords stay hidden while you type and are stored only as salted hashes.</p>
    </div>
  );
}
