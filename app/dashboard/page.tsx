import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getCurrentSession } from '@/lib/account-session';
import { AccountControls } from '@/components/account-controls';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  const session = await getCurrentSession();
  if (!session) redirect('/');
  const expiry = new Date(session.expiresAt).toISOString();

  return (
    <main className="relative min-h-screen px-5 py-10 sm:py-16">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <section className="relative mx-auto max-w-2xl space-y-8 rounded-[28px] border border-white/10 bg-card/90 p-6 shadow-2xl sm:p-10">
        <header className="space-y-3">
          <ShieldCheck className="size-9 text-emerald-400" aria-hidden="true" />
          <p className="font-mono text-xs tracking-widest text-emerald-300">OPERATION SECURE LOGIN</p>
          <h1 className="text-3xl font-semibold tracking-tight">Your account dashboard</h1>
          <p className="text-muted-foreground">Welcome, <span className="break-all font-medium text-foreground">{session.username}</span>.</p>
        </header>
        {session.isDemo && <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200">You are using the shared classroom demo account. Create your own account for a personal dashboard and password recovery.</p>}
        <dl className="grid gap-5 rounded-2xl border border-white/10 p-5 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Username</dt><dd className="mt-1 break-all font-medium">{session.username}</dd></div>
          <div><dt className="text-muted-foreground">Account created (UTC)</dt><dd className="mt-1">{session.createdAt}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">This session expires (UTC)</dt><dd className="mt-1"><time dateTime={expiry}>{expiry.replace('T', ' ').replace(/\.\d{3}Z$/, '')}</time></dd></div>
        </dl>
        <AccountControls csrfToken={session.csrfToken} hasRecoveryKey={session.hasRecoveryKey} isDemo={session.isDemo} />
        <Link href="/attack-lab" className="block text-sm font-medium text-amber-300 underline underline-offset-4">Open the isolated Attack Lab →</Link>
      </section>
    </main>
  );
}
