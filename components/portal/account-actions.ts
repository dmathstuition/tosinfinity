'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AccountState = { ok: boolean; message: string } | null;

/** The database function limits self-service edits to name and phone. */
export async function updateOwnProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: 'Please sign in again.' };
  const name = String(formData.get('full_name') ?? '').trim();
  if (name.length < 2) return { ok: false, message: 'Enter your full name.' };
  const { error } = await createClient().rpc('update_own_profile', { p_full_name: name, p_phone: String(formData.get('phone') ?? '') });
  if (error) return { ok: false, message: 'Could not save your details.' };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Details saved.' };
}

/** Changing the password requires the current one, so an unattended session cannot be hijacked. */
export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: 'Please sign in again.' };
  if (!(await rateLimit('change-password', profile.id, 5, 900))) return { ok: false, message: 'Too many attempts. Please wait 15 minutes.' };
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('password') ?? '');
  if (next.length < 10 || next.length > 72 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) {
    return { ok: false, message: 'Use at least 10 characters, with a letter and a number.' };
  }
  if (next !== String(formData.get('confirm') ?? '')) return { ok: false, message: 'The two new passwords do not match.' };
  const supabase = createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: profile.email, password: current });
  if (wrong) return { ok: false, message: 'Your current password is not correct.' };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, message: 'Could not change the password. Please choose a different one.' };
  return { ok: true, message: 'Password changed.' };
}

/**
 * Self-service account deletion for students and parents. Requires the current
 * password and the word DELETE. Personal and learning data are erased in the
 * database (erase_account); invoices and payments are kept, unlinked from the
 * person's name, because financial records must be retained. The login is then
 * renamed and blocked, and the session ended.
 */
export async function deleteOwnAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: 'Please sign in again.' };
  if (profile.role === 'owner') return { ok: false, message: 'The Owner account cannot be deleted from here.' };
  if (!(await rateLimit('delete-account', profile.id, 5, 900))) return { ok: false, message: 'Too many attempts. Please wait 15 minutes.' };
  if (String(formData.get('confirm_word') ?? '').trim() !== 'DELETE') return { ok: false, message: 'Type DELETE in capital letters to confirm.' };
  const supabase = createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: profile.email, password: String(formData.get('password') ?? '') });
  if (wrong) return { ok: false, message: 'Your password is not correct.' };
  if (!adminConfigured()) return { ok: false, message: 'Account deletion is not available right now. Please message the academy.' };

  const admin = createAdminClient();
  const { error } = await admin.rpc('erase_account', { p_user: profile.id });
  if (error) return { ok: false, message: 'Could not delete the account. Please message the academy.' };
  await admin.auth.admin.updateUserById(profile.id, {
    email: `deleted+${profile.id}@invalid.invalid`,
    email_confirm: true,
    password: randomBytes(32).toString('base64url'),
    ban_duration: '876000h',
    user_metadata: {},
  });
  await supabase.auth.signOut();
  redirect('/delete-account?done=1');
}
