'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** RLS limits the update to the caller's own rows and to the read_at column. */
export async function markAllNotificationsRead() {
  const profile = await getSessionProfile();
  if (!profile) return;
  await createClient()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('read_at', null);
  revalidatePath('/', 'layout');
}
