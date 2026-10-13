'use server';

import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export type NewsletterState = { ok: boolean; message: string } | null;

const GENERIC = 'Thank you. Please check your inbox to confirm your subscription.';

export async function subscribeAction(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  if (formData.get('company')) return { ok: true, message: GENERIC }; // honeypot
  const parsed = z.string().trim().toLowerCase().email().max(254).safeParse(formData.get('email'));
  if (!parsed.success) return { ok: false, message: 'Please enter a valid email address.' };
  if (!(await rateLimit('newsletter', clientIp(), 5, 3600))) {
    return { ok: false, message: 'Too many attempts. Please try again later.' };
  }
  if (!adminConfigured()) {
    return { ok: false, message: 'Subscriptions are not available yet. Please try again soon.' };
  }

  // Narrow system task: the subscribers table has no public policies at all.
  const admin = createAdminClient();
  const email = parsed.data;
  const { data: existing } = await admin
    .from('blog_subscribers')
    .select('id, status, token')
    .ilike('email', email)
    .maybeSingle();

  let token: string | undefined;
  if (!existing) {
    const { data, error } = await admin.from('blog_subscribers').insert({ email }).select('token').single();
    if (error) return { ok: false, message: 'Something went wrong. Please try again.' };
    token = data.token;
  } else if (existing.status !== 'verified') {
    // Re-subscribing after unsubscribe records fresh consent and needs re-verification.
    await admin
      .from('blog_subscribers')
      .update({ status: 'pending', consent_at: new Date().toISOString(), unsubscribed_at: null })
      .eq('id', existing.id);
    token = existing.token;
  }
  // Already verified: same generic reply, no email, so addresses cannot be probed.
  if (token) await sendEmail('newsletterVerify', email, { token });
  return { ok: true, message: GENERIC };
}
