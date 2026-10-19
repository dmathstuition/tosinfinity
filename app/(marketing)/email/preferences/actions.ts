'use server';

import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type PrefState = { ok: boolean; message: string } | null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saves preferences for the address the secret token belongs to. */
export async function savePreferencesAction(_p: PrefState, fd: FormData): Promise<PrefState> {
  const token = String(fd.get('token') ?? '');
  if (!UUID.test(token)) return { ok: false, message: 'This link is not valid.' };
  if (!(await rateLimit('email-prefs', clientIp(), 30, 3600))) return { ok: false, message: 'Too many changes. Please try again later.' };
  const all = fd.get('all') === 'off';
  const { data, error } = await createClient().rpc('set_email_preferences', {
    p_token: token,
    p_reminders: !all && fd.get('reminders') === 'on',
    p_updates: !all && fd.get('updates') === 'on',
    p_reports: !all && fd.get('reports') === 'on',
  });
  if (error || data !== true) return { ok: false, message: 'This link is not valid.' };
  return { ok: true, message: all ? 'You will now only receive essential emails.' : 'Your email preferences have been saved.' };
}
