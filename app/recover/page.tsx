import { KeyRound } from 'lucide-react';
import { RecoveryForm } from '@/components/recovery-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RecoverPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <section className="relative w-full max-w-lg space-y-6 rounded-[28px] border border-white/10 bg-card/90 p-6 shadow-2xl sm:p-10">
        <header className="space-y-3">
          <KeyRound className="size-9 text-emerald-400" aria-hidden="true" />
          <h1 className="text-3xl font-semibold tracking-tight">Recover your account</h1>
          <p className="text-sm leading-6 text-muted-foreground">Use your saved recovery key to choose a new password. We do not collect email addresses or send password-reset emails.</p>
          <p className="text-xs leading-5 text-muted-foreground">If you never saved a key, sign in with your existing password to create one. Without your password or a saved key, you cannot recover this account. The shared student demo does not support password recovery.</p>
        </header>
        <RecoveryForm />
      </section>
    </main>
  );
}
