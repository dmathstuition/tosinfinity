import Link from 'next/link';
import { changePasswordAction, deleteOwnAccountAction, updateOwnProfileAction } from '@/components/portal/account-actions';
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
        {profile.role !== 'owner' && (
          <Card className="border-bad/30 lg:col-span-2">
            <h2 className="text-lg font-semibold">Delete account</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Permanently deletes your details, messages and learning records. Invoices and payments are kept, without your name, because financial records must be retained.
              {profile.role === 'parent' && ' Your children’s accounts are not deleted.'} <Link href="/delete-account" className="text-link underline">More about deletion</Link>
            </p>
            <ActionForm action={deleteOwnAccountAction} submitLabel="Delete my account" variant="danger" confirm="Delete your account permanently? This cannot be undone.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="del_password" className="label">Your password</label><input id="del_password" name="password" type="password" required autoComplete="current-password" className="field" /></div>
                <div><label htmlFor="del_word" className="label">Type DELETE to confirm</label><input id="del_word" name="confirm_word" required autoComplete="off" className="field" /></div>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
