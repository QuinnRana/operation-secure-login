'use client';

import { useActionState } from 'react';
import { CheckCircle2, LoaderCircle, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';

import { type DefendedResetState, type DefendedState, defendedLogin, resetDefendedLab } from '@/app/defended-lab/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: DefendedState = { status: 'idle', message: '' };
const initialResetState: DefendedResetState = { status: 'idle', message: '' };

export function DefendedForm() {
  const [state, formAction, pending] = useActionState(defendedLogin, initialState);
  const [resetState, resetAction, resetting] = useActionState(resetDefendedLab, initialResetState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2"><label htmlFor="defended-username" className="text-sm font-medium">Username input</label><Input id="defended-username" name="username" placeholder="Try the same payload" className="h-11 font-mono" required /></div>
        <div className="space-y-2"><label htmlFor="defended-password" className="text-sm font-medium">Password input</label><Input id="defended-password" name="password" type="text" placeholder="Any non-empty value" className="h-11 font-mono" required /></div>
        <Button type="submit" disabled={pending || resetting} className="h-11 w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
          {pending ? <><LoaderCircle className="animate-spin" />Checking login…</> : <><ShieldCheck />Test defended login</>}
        </Button>
      </form>

      {state.status !== 'idle' && (
        <output className={`flex items-center gap-2 rounded-xl border p-4 font-medium ${state.status === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
          {state.status === 'success' ? <CheckCircle2 className="size-4 shrink-0" /> : <TriangleAlert className="size-4 shrink-0" />}
          {state.message}
        </output>
      )}

      <form action={resetAction} className="space-y-3 border-t border-white/10 pt-5">
        <p className="text-xs leading-5 text-slate-400">Reset restores the 3 fictional defended accounts with new random salts and hashes. It never touches the vulnerable lab table or the secure login database.</p>
        <Button type="submit" variant="outline" disabled={resetting || pending} className="h-10 w-full">
          {resetting ? <><LoaderCircle className="animate-spin" />Resetting defended lab…</> : <><RotateCcw />Reset defended lab</>}
        </Button>
        {resetState.status !== 'idle' && (
          <output className={`block text-sm ${resetState.status === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{resetState.message}</output>
        )}
      </form>
    </div>
  );
}
