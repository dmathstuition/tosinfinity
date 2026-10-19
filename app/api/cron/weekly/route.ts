import { claim, localeSettings, runCron } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { familyRecipients } from '@/lib/notify';
import { zonedDate } from '@/lib/time';
import { collectWeeklyReport, isEmptyReport } from '@/lib/weekly-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly (Friday afternoon): a short progress email for each active learner and
 * their verified parents: lessons, work, marks, merits and the week ahead. Parents
 * also see any balance due. Claimed once per learner per week, so a retried run never
 * sends twice. Switched off in Settings → Notification preferences, and each
 * recipient can turn it off from the link in the email.
 */
export async function GET(request: Request) {
  return runCron(request, 'weekly-report', async (admin) => {
    const { data: prefs } = await admin.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    if ((prefs?.value as { weekly_reports?: boolean } | null)?.weekly_reports === false) return { skipped: 'weekly reports are switched off' };

    const { timezone } = await localeSettings(admin);
    const now = new Date();
    const week = zonedDate(now, timezone);
    const tally = { learners: 0, emails: 0, empty: 0 };
    const { data: students } = await admin.from('profiles').select('id, full_name').eq('role', 'student').eq('status', 'active');
    const families = await familyRecipients(admin, (students ?? []).map((s) => s.id));

    for (const s of students ?? []) {
      const body = await collectWeeklyReport(admin, s, timezone, now);
      if (isEmptyReport(body)) { tally.empty += 1; continue; }
      if (!(await claim(admin, 'weekly-report', `${s.id}:${week}`))) continue;
      for (const r of families.get(s.id) ?? []) {
        const forParent = r.id !== s.id;
        const res = await sendEmail('weeklyReport', r.email, { ...body, name: r.full_name.split(' ')[0] ?? r.full_name, forParent, balance: forParent ? body.balance : null });
        if (res.ok && !res.skipped) tally.emails += 1;
      }
      tally.learners += 1;
    }
    await admin.from('job_runs').delete().eq('job', 'weekly-report').lt('created_at', new Date(Date.now() - 120 * 86400000).toISOString());
    return tally;
  });
}
