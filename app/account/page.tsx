import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';

import { signOut } from '@/app/session-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentSession } from '@/lib/account-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AccountPage() {
  // Checked on the server for every request; there is no client-side shortcut.
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const expires = new Date(session.expiresAt).toISOString().replace('T', ' ').slice(0, 16);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="security-grid absolute inset-0" aria-hidden="true" />
      <Card className="relative z-10 w-full max-w-md border-white/10 bg-card/90 py-6">
        <CardHeader>
          <div className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-500 ring-1 ring-emerald-400/20"><ShieldCheck className="size-5" aria-hidden="true" /></div>
          <CardTitle className="text-2xl font-semibold tracking-tight">Signed in as {session.username}</CardTitle>
          <CardDescription>This page is only shown with a valid server-side session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="rounded-xl bg-white/5 px-3 py-2.5 font-mono text-xs leading-5 text-muted-foreground">Session expires at {expires} UTC</p>
          <form action={signOut}>
            <input type="hidden" name="csrfToken" value={session.csrfToken} />
            <Button type="submit" variant="outline" className="h-11 w-full"><LogOut />Log out</Button>
          </form>
          <Link href="/dashboard" className="block text-center text-sm text-emerald-300 underline underline-offset-4">Open your account dashboard and recovery settings →</Link>
        </CardContent>
      </Card>
    </main>
  );
}
