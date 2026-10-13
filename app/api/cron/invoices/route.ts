import { previousMonth } from '@/lib/billing';
import { claim, localeSettings, runCron } from '@/lib/cron';
import { createTuitionInvoice, getBillingSettings, issueInvoice } from '@/lib/invoicing';
import { addDays, zonedDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily. On the configured invoice day it drafts last month's tuition invoices for
 * students on hourly or flat monthly billing. Drafts wait for the Owner's review
 * unless "issue automatically" is switched on in Settings.
 * Idempotent twice over: the month is claimed once in job_runs, and the database
 * allows only one tuition invoice per student per period.
 */
export async function GET(request: Request) {
  return runCron(request, 'invoices', async (admin) => {
    const { timezone, currency } = await localeSettings(admin);
    const settings = await getBillingSettings(admin);
    const today = zonedDate(new Date(), timezone);
    const day = Number(today.slice(8));
    // Catch-up window: if the scheduled day was missed, the next 3 days still run it.
    if (day < settings.invoice_day || day > settings.invoice_day + 3) return { skipped: 'not invoice day' };

    const period = previousMonth(today);
    if (!(await claim(admin, 'invoices-month', period.start))) return { skipped: 'already generated', period: period.start };

    const { data: students } = await admin
      .from('profiles').select('id, billing_mode, hourly_rate_minor, flat_fee_minor')
      .eq('role', 'student').eq('status', 'active').in('billing_mode', ['hourly', 'flat_monthly']);
    const tally = { created: 0, exists: 0, nothing_to_bill: 0, error: 0, issued: 0 };
    for (const s of students ?? []) {
      const r = await createTuitionInvoice(admin, s, period, { currency, timezone, dueDate: addDays(today, settings.due_days) });
      tally[r.status] += 1;
      if (r.status === 'created' && r.id && settings.auto_issue) {
        if ((await issueInvoice(admin, r.id, { asService: true })).ok) tally.issued += 1;
      }
    }
    if (tally.error > 0) {
      // Release the claim so the next run retries the students that failed.
      await admin.from('job_runs').delete().eq('job', 'invoices-month').eq('run_key', period.start);
    }
    const { data: owner } = await admin.from('profiles').select('id').eq('role', 'owner').maybeSingle();
    if (owner && tally.created > 0) {
      await admin.from('notifications').insert({
        user_id: owner.id, title: 'Tuition invoices drafted',
        body: `${tally.created} for ${period.label}${settings.auto_issue ? ' (issued automatically)' : '. Review and issue them.'}`,
        href: '/owner/billing?status=draft',
      });
    }
    return { period: period.start, ...tally };
  });
}
