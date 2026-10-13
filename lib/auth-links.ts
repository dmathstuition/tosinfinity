import 'server-only';
import { publicEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Builds our own single-use password link from a Supabase recovery token, so
 * activation and recovery emails go through the academy's email provider.
 *
 * SECURITY: this returns a link that grants access to the account. It must only be
 * emailed to the account's own address, never returned to a browser. Keep this
 * module out of 'use server' files (their exports are public endpoints).
 */
export async function createPasswordLink(email: string): Promise<string | null> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'recovery', email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return null;
  return `${publicEnv.siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hash)}`;
}
