import { LockKeyhole, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from '@/components/login-form';

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <div className="glow absolute -left-32 top-12 h-80 w-80 rounded-full" aria-hidden="true" />
      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-card/80 shadow-2xl shadow-black/30 backdrop-blur-xl md:grid-cols-[1.05fr_.95fr]">
        <div className="flex min-h-[330px] flex-col justify-between bg-primary p-8 text-primary-foreground md:p-12">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20"><ShieldCheck className="size-5" aria-hidden="true" /></span>
            OPERATION SECURE LOGIN
          </div>
          <div className="max-w-md py-12">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-emerald-300">CIS 3353 Security Lab</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Sign in to the training portal.</h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">A controlled Build–Attack–Defend environment for learning how authentication systems fail—and how to secure them.</p>
          </div>
          <p className="text-xs text-slate-400">Authorized classroom testing only</p>
        </div>
        <div className="flex items-center p-6 sm:p-10 md:p-12">
          <Card className="w-full border-0 bg-transparent shadow-none ring-0">
            <CardHeader className="px-0">
              <div className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-500 ring-1 ring-emerald-400/20"><LockKeyhole className="size-5" aria-hidden="true" /></div>
              <CardTitle className="text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
              <CardDescription>Enter your account details to continue.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-3">
              <LoginForm />
              <div className="mt-6 rounded-xl bg-white/5 px-3 py-2.5 text-center font-mono text-xs leading-5 text-muted-foreground">
                Demo: student / Training123!
              </div>
              <Link href="/attack-lab" className="mt-3 block rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-center text-xs font-medium text-amber-300 transition hover:bg-amber-300/10">
                Open the isolated Attack Lab →
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
