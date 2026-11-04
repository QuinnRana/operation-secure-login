'use client';

import { useActionState } from 'react';
import { DatabaseZap, FlaskConical, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';

import { type AttackState, type ResetState, resetLab, vulnerableLogin } from '@/app/attack-lab/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const initialState: AttackState = { status: 'idle', message: '', records: [] };
const initialResetState: ResetState = { status: 'idle', message: '' };

export function AttackForm() {
  const [state, formAction, pending] = useActionState(vulnerableLogin, initialState);
  const [resetState, resetAction, resetting] = useActionState(resetLab, initialResetState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <div className="space-y-2"><label htmlFor="lab-username" className="text-sm font-medium">Username input</label><Input id="lab-username" name="username" placeholder="Try the provided payload" className="h-11 font-mono" required /></div>
        <div className="space-y-2"><label htmlFor="lab-password" className="text-sm font-medium">Password input</label><Input id="lab-password" name="password" type="text" placeholder="Any non-empty value" className="h-11 font-mono" required /></div>
        <Button type="submit" disabled={pending || resetting} className="h-11 w-full bg-amber-400 text-slate-950 hover:bg-amber-300">
          {pending ? <><LoaderCircle className="animate-spin" />Running lab test…</> : <><FlaskConical />Test vulnerable login</>}
        </Button>
      </form>

      {state.status !== 'idle' && (
        <output className={`block rounded-xl border p-4 ${state.status === 'success' ? 'border-amber-300/30 bg-amber-300/10' : 'border-red-400/30 bg-red-400/10'}`}>
          <span className="flex items-center gap-2 font-medium">{state.status === 'success' ? <DatabaseZap className="size-4 text-amber-300" /> : <TriangleAlert className="size-4 text-red-300" />}{state.message}</span>
          {state.query && <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-950/70 p-3 text-xs leading-5 text-slate-300">{state.query}</code>}
        </output>
      )}

      {state.records.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">Fictional information exposed</h2>
          {state.records.map((record) => (
            <article key={record.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-semibold">{record.name}</h3><span className="text-xs text-slate-400">{record.role}</span></div>
              <p className="mt-2 text-sm text-slate-300">{record.note}</p>
            </article>
          ))}
        </div>
      )}

      <form action={resetAction} className="space-y-3 border-t border-white/10 pt-5">
        <p className="text-xs leading-5 text-slate-400">Save any evidence first. Reset discards changed lab rows and restores the 3 fictional records in the separate lab database. The secure login database is never touched.</p>
        <Button type="submit" variant="outline" disabled={resetting || pending} className="h-10 w-full">
          {resetting ? <><LoaderCircle className="animate-spin" />Resetting lab data…</> : <><RotateCcw />Reset lab data</>}
        </Button>
        {resetState.status !== 'idle' && (
          <output className={`block text-sm ${resetState.status === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>{resetState.message}</output>
        )}
      </form>
    </div>
  );
}
