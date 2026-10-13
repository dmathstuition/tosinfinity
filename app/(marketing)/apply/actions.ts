'use server';

import { redirect } from 'next/navigation';
import { sendEmail } from '@/lib/email';
import { optionalEnv, supabaseConfigured } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { createPublicClient } from '@/lib/supabase/server';
import { applicationSchema, type ApplicationInput } from '@/lib/validation/application';

export type ApplyResult = { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Minimum time a person plausibly needs to complete four steps. */
const MIN_FILL_MS = 8000;

export async function submitApplication(
  input: ApplicationInput,
  bot: { website: string; startedAt: number },
): Promise<ApplyResult> {
  // Bot protection: honeypot + time trap. Bots get the same success page and learn nothing.
  if (bot.website || Date.now() - bot.startedAt < MIN_FILL_MS) redirect('/apply/received');

  if (!(await rateLimit('apply', clientIp(), 5, 3600))) {
    return { ok: false, message: 'Too many applications from this connection. Please try again in an hour or contact us by phone.' };
  }

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? '');
      if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    return { ok: false, message: 'Please correct the highlighted fields.', fieldErrors };
  }
  if (!supabaseConfigured()) {
    return { ok: false, message: 'Applications cannot be received yet because the site is not connected to its database. Please contact us by phone.' };
  }

  const { consent: _consent, ...d } = parsed.data;
  // Anonymous insert: RLS allows INSERT of a fresh application and nothing else (no reads).
  const { error } = await createPublicClient()!
    .from('applications')
    .insert({ ...d, consent_at: new Date().toISOString() });
  if (error) {
    console.error('[apply] insert failed', error.code);
    return { ok: false, message: 'We could not save your application. Please try again, or contact us by phone.' };
  }

  const ownerEmail = optionalEnv('OWNER_NOTIFY_EMAIL');
  await Promise.all([
    sendEmail('applicationReceived', d.guardian_email, { guardianName: d.guardian_name, studentName: d.student_name }),
    ownerEmail
      ? sendEmail('applicationNotifyOwner', ownerEmail, {
          studentName: d.student_name,
          guardianName: d.guardian_name,
          subjects: d.subjects,
          delivery: d.delivery,
        })
      : Promise.resolve(),
  ]);
  redirect('/apply/received');
}
