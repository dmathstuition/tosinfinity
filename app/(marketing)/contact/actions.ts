'use server';

import { z } from 'zod';
import { supabaseConfigured } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { createPublicClient } from '@/lib/supabase/server';

export type ContactState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  message: z.string().trim().min(10, 'Please write a little more so we can help').max(4000),
});

export async function contactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const done = { ok: true, message: 'Thank you. Your message has been sent and we will reply as soon as we can.' };
  if (formData.get('company')) return done; // honeypot
  if (!(await rateLimit('contact', clientIp(), 5, 3600))) {
    return { ok: false, message: 'Too many messages from this connection. Please try again later or call us.' };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, message: 'Please correct the highlighted fields.', errors };
  }
  if (!supabaseConfigured()) {
    return { ok: false, message: 'Messages cannot be received online yet. Please call or message us on WhatsApp.' };
  }
  // Anonymous insert only; RLS grants no read access to this table.
  const { error } = await createPublicClient()!.from('contact_messages').insert(parsed.data);
  if (error) return { ok: false, message: 'We could not send your message. Please try again or call us.' };
  return done;
}
