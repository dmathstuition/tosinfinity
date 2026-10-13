'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile, ownerNeedsMfa, ROLE_HOME } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { optionalEnv } from '@/lib/env';
import { sendPush } from '@/lib/push';
import { rateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type MessageState = { ok: boolean; message: string } | null;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Send a message in a one-to-one conversation between the Owner and one student or
 * parent. Works for all three roles: RLS guarantees a family member can only write
 * to their own thread, and only as themselves.
 */
export async function sendMessageAction(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, message: 'Your session has ended. Please sign in again.' };
  if (profile.role === 'owner' && (await ownerNeedsMfa())) return { ok: false, message: 'Please complete two-step verification.' };

  const body = String(formData.get('body') ?? '').trim().slice(0, 5000);
  const attachment = String(formData.get('attachment') ?? '').slice(0, 500);
  let threadId = String(formData.get('thread_id') ?? '');
  if (!body) return { ok: false, message: 'Write a message first.' };
  if (!(await rateLimit('message', profile.id, 30, 300))) return { ok: false, message: 'You are sending messages very quickly. Please wait a moment.' };

  const supabase = createClient();
  if (!threadId) {
    // A family member's first message opens their conversation with the Owner.
    if (profile.role === 'owner') return { ok: false, message: 'Choose who to message.' };
    const { data: existing } = await supabase.from('message_threads').select('id').eq('participant_id', profile.id).limit(1).maybeSingle();
    if (existing) threadId = existing.id;
    else {
      const { data: created, error } = await supabase.from('message_threads').insert({ participant_id: profile.id }).select('id').single();
      if (error) return { ok: false, message: 'Could not start the conversation.' };
      threadId = created.id;
    }
  }
  if (!UUID.test(threadId)) return { ok: false, message: 'Unknown conversation.' };
  if (attachment && (!attachment.startsWith(`${threadId}/`) || attachment.includes('..'))) return { ok: false, message: 'The attachment is not valid.' };

  const { error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: profile.id, body, attachment_path: attachment || null });
  if (error) return { ok: false, message: 'Your message could not be sent.' };

  // Email fallback. The email never contains the message text.
  if (profile.role === 'owner') {
    const { data: thread } = await supabase.from('message_threads').select('participant:profiles!message_threads_participant_id_fkey(id, full_name, email, role)').eq('id', threadId).maybeSingle();
    const p = thread ? (Array.isArray(thread.participant) ? thread.participant[0] : thread.participant) : null;
    if (p) {
      await sendEmail('newMessage', p.email, { name: p.full_name });
      await sendPush([p.id], { title: 'New message', body: 'You have a new message from Tosinfinity Academy.', href: (p.role === 'student' ? '/portal' : '/parent') + '/messages' });
    }
  } else {
    const ownerEmail = optionalEnv('OWNER_NOTIFY_EMAIL');
    if (ownerEmail) await sendEmail('newMessage', ownerEmail, { name: 'there' });
  }
  revalidatePath(`${ROLE_HOME[profile.role]}/messages`, 'layout');
  return { ok: true, message: 'Sent.' };
}
