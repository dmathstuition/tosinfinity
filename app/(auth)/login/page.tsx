import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/primitives';
import { getSessionProfile, ROLE_HOME } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/env';
import { SignInForm } from '../AuthForms';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const profile = await getSessionProfile();
  if (profile) redirect(ROLE_HOME[profile.role]);
  return (
    <>
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mb-6 mt-1 text-muted">Student, parent and owner accounts.</p>
      {!supabaseConfigured() && (
        <div className="mb-5"><Alert tone="warning">The portal is not connected to its database yet. See README.md to finish setup.</Alert></div>
      )}
      {searchParams.error === 'link' && (
        <div className="mb-5"><Alert tone="error">That link has expired or was already used. Request a new one with “Forgot password”.</Alert></div>
      )}
      <SignInForm />
      <p className="mt-6 text-sm text-muted">
        New to the academy? <Link href="/apply" className="font-medium text-link hover:underline">Apply for tutoring</Link>. Accounts are created once a place is agreed.
      </p>
    </>
  );
}
