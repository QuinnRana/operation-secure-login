import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

import { AttackForm } from '@/components/attack-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AttackLabPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-10 sm:py-14">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="size-4" />Back to secure login</Link>
        <div className="grid gap-6 md:grid-cols-[.85fr_1.15fr]">
          <section className="space-y-6 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-7">
            <div className="grid size-12 place-items-center rounded-xl bg-amber-300/10 text-amber-300"><ShieldAlert /></div>
            <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Attack phase</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">SQL injection training lab</h1></div>
            <p className="text-sm leading-6 text-slate-300">This page is intentionally vulnerable and contains only fictional records. It demonstrates how unsafe database queries can allow an attacker to bypass authentication.</p>
            <div className="rounded-xl bg-slate-950/60 p-4 text-sm">
              <p className="font-semibold text-white">Authorized test payload</p>
              <code className="mt-2 block select-all text-amber-300">&apos; OR 1=1 --</code>
              <p className="mt-3 text-xs leading-5 text-slate-400">Paste it into Username, enter anything in Password, then capture the result for your report.</p>
            </div>
          </section>
          <Card className="border-white/10 bg-card/90 py-6">
            <CardHeader><CardTitle className="text-xl">Vulnerable login</CardTitle><CardDescription>Use only the supplied classroom payload against this lab.</CardDescription></CardHeader>
            <CardContent><AttackForm /></CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
