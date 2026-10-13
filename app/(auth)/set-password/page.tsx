import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { SetPasswordForm } from '../AuthForms';

export const metadata: Metadata = { title: 'Choose a password', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function SetPasswordPage() {
  if (!supabaseConfigured()) redirect('/login');
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect('/login?error=link');
  return (
    <>
      <h1 className="text-3xl font-semibold">Choose a password</h1>
      <p className="mb-6 mt-1 text-muted">You will use this to sign in to Tosinfinity Academy.</p>
      <SetPasswordForm />
    </>
  );
}
