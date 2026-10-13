import type { Metadata } from 'next';
import { ownerNeedsMfa, requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { MfaForm } from '../../AuthForms';
import { signOutAction } from '../../actions';

export const metadata: Metadata = { title: 'Two-step verification', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function MfaPage() {
  await requireRole('owner');
  if (!(await ownerNeedsMfa())) redirect('/owner');
  return (
    <>
      <h1 className="text-3xl font-semibold">Two-step verification</h1>
      <p className="mb-6 mt-1 text-muted">Enter the code from your authenticator app to continue.</p>
      <MfaForm />
      <form action={signOutAction} className="mt-6">
        <button type="submit" className="text-sm font-medium text-link hover:underline">Sign out instead</button>
      </form>
    </>
  );
}
