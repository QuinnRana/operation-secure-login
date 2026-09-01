'use client';

import { useActionState } from 'react';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';

import { login, type LoginState } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: LoginState = { status: 'idle', message: '' };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">Username</label>
        <Input id="username" name="username" autoComplete="username" placeholder="Enter your username" className="h-11" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" className="h-11" required />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
        {pending ? <><LoaderCircle className="animate-spin" />Checking account…</> : 'Log in'}
      </Button>
      {state.status !== 'idle' && (
        <p role="status" className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${state.status === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
          {state.status === 'success' ? <CheckCircle2 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
          {state.message}
        </p>
      )}
    </form>
  );
}
