'use server';

import { z } from 'zod';
import { localeSettings } from '@/lib/cron';
import { emailConfigured, emailProviderName, sendEmail } from '@/lib/email';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { collectWeeklyReport } from '@/lib/weekly-report';

/** Sends the test template to an address the Owner enters (default: their own). */
export async function sendTestEmailAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { profile } = await ownerContext();
  const to = z.string().trim().email().safeParse(str(fd, 'to', 320) || profile.email);
  if (!to.success) return fail('Enter a valid email address.');
  if (!(await rateLimit('email-test', profile.id, 10, 3600))) return fail('Too many test emails. Try again later.');
  if (!emailConfigured()) return fail('Email delivery is not configured yet, so nothing can be sent. See README → Email.');
  const res = await sendEmail('testEmail', to.data, { provider: emailProviderName() });
  return res.ok ? ok(`Test email sent to ${to.data}. Check the inbox and the spam folder.`) : fail(`The test email failed: ${res.error ?? 'unknown error'}.`);
}

/** Sends one learner's weekly report, as a parent would see it, to the Owner only. */
export async function previewWeeklyReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { profile, supabase } = await ownerContext();
  const id = str(fd, 'student_id');
  if (!isUuid(id)) return fail('Choose a learner.');
  if (!adminConfigured()) return fail('Scheduled emails need SUPABASE_SERVICE_ROLE_KEY.');
  if (!(await rateLimit('email-test', profile.id, 10, 3600))) return fail('Too many test emails. Try again later.');
  const { data: s } = await supabase.from('profiles').select('id, full_name').eq('id', id).eq('role', 'student').maybeSingle();
  if (!s) return fail('Unknown learner.');
  const admin = createAdminClient();
  const { timezone } = await localeSettings(admin);
  const body = await collectWeeklyReport(admin, s, timezone);
  const res = await sendEmail('weeklyReport', profile.email, { ...body, name: profile.full_name.split(' ')[0] ?? 'there', forParent: true });
  return res.ok ? ok(`Preview of ${s.full_name}’s weekly report sent to ${profile.email}.`) : fail(`Could not send: ${res.error ?? 'unknown error'}.`);
}
