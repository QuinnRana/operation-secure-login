import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { DefendedForm } from '@/components/defended-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DefendedLabPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-10 sm:py-14">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <Link href="/attack-lab" className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="size-4" />Back to the vulnerable lab</Link>
        <div className="grid gap-6 md:grid-cols-[.85fr_1.15fr]">
          <section className="space-y-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-7">
            <div className="grid size-12 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck /></div>
            <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">Defend phase</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Defended lab login</h1></div>
            <p className="text-sm leading-6 text-slate-300">The same fictional accounts as the Attack Lab, defended. Usernames are passed to the database as bound parameters, passwords are stored only as salted PBKDF2-SHA-256 hashes, and every wrong username or password gets the same generic message without the query or any records.</p>
            <div className="rounded-xl bg-slate-950/60 p-4 text-sm">
              <p className="font-semibold text-white">Retest the baseline attack</p>
              <code className="mt-2 block select-all text-emerald-300">&apos; OR 1=1 --</code>
              <p className="mt-3 text-xs leading-5 text-slate-400">Paste the same payload into Username with any password. It should fail. Then log in as alex / falcon7 to show that valid credentials still work.</p>
            </div>
          </section>
          <Card className="border-white/10 bg-card/90 py-6">
            <CardHeader><CardTitle className="text-xl">Defended login</CardTitle><CardDescription>Fictional lab accounts only, in the separate local lab database.</CardDescription></CardHeader>
            <CardContent><DefendedForm /></CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
