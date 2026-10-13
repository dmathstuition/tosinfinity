import Link from 'next/link';
import { changePasswordAction } from '@/components/portal/account-actions';
import { ActionForm } from '@/components/ui/ActionForm';
import { Alert, Card, PageHeader } from '@/components/ui/primitives';
import { ownerContext } from '@/lib/owner';
import { MfaPanel } from './MfaPanel';

export const metadata = { title: 'Security' };

export default async function SecurityPage({ searchParams }: { searchParams: { enabled?: string } }) {
  const { supabase, profile } = await ownerContext();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === 'verified') ?? null;
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/settings" className="text-link hover:underline">← Settings</Link></p>
      <PageHeader title="Security" description={`Signed in as ${profile.email}`} />
      {searchParams.enabled && factor && <div className="mb-5 max-w-3xl"><Alert tone="success">Two-step verification is now active on your account.</Alert></div>}
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Two-step verification</h2>
          <MfaPanel enrolled={Boolean(factor)} factorId={factor?.id ?? null} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Change password</h2>
          <ActionForm action={changePasswordAction} submitLabel="Change password" variant="secondary" resetOnSuccess>
            <div><label htmlFor="current" className="label">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" className="field" /></div>
            <div><label htmlFor="password" className="label">New password</label><input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
            <div><label htmlFor="confirm" className="label">Repeat new password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
