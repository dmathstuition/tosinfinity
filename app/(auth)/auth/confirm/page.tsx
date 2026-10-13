import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConfirmLinkForm } from '../../AuthForms';

export const metadata: Metadata = { title: 'Continue to your account', robots: { index: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default function ConfirmPage({ searchParams }: { searchParams: { token_hash?: string } }) {
  const token = searchParams.token_hash;
  if (!token) redirect('/login?error=link');
  return (
    <>
      <h1 className="text-3xl font-semibold">Continue to your account</h1>
      <p className="mb-6 mt-1 text-muted">Press continue to choose your password. This link can be used once.</p>
      <ConfirmLinkForm tokenHash={token} />
    </>
  );
}
