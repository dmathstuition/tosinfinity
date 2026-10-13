import { changePasswordAction, updateOwnProfileAction } from '@/components/portal/account-actions';
import { PushToggle } from '@/components/portal/PushToggle';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/primitives';
import type { SessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function AccountPage({ profile }: { profile: SessionProfile }) {
  const { data } = await createClient().from('profiles').select('phone').eq('id', profile.id).maybeSingle();
  return (
    <>
      <PageHeader title="Account" description={profile.email} />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Your details</h2>
          <ActionForm action={updateOwnProfileAction} submitLabel="Save details" variant="secondary">
            <div><label htmlFor="full_name" className="label">Full name</label><input id="full_name" name="full_name" required defaultValue={profile.full_name} autoComplete="name" className="field" /></div>
            <div><label htmlFor="phone" className="label">Phone</label><input id="phone" name="phone" type="tel" defaultValue={data?.phone ?? ''} autoComplete="tel" className="field" /></div>
            <p className="text-xs text-muted">To change your login email{profile.role === 'student' ? ' or learning details' : ''}, please message the academy.</p>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Change password</h2>
          <ActionForm action={changePasswordAction} submitLabel="Change password" variant="secondary" resetOnSuccess>
            <div><label htmlFor="current" className="label">Current password</label><input id="current" name="current" type="password" required autoComplete="current-password" className="field" /></div>
            <div>
              <label htmlFor="password" className="label">New password</label>
              <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" aria-describedby="pw-hint" />
              <p id="pw-hint" className="mt-1 text-xs text-muted">At least 10 characters, with a letter and a number.</p>
            </div>
            <div><label htmlFor="confirm" className="label">Repeat new password</label><input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="field" /></div>
          </ActionForm>
        </Card>
        {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Device notifications</h2>
            <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
          </Card>
        )}
      </div>
    </>
  );
}
