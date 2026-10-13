'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
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
