import { formatMoney } from '@/lib/billing';
import { claim, localeSettings, runCron } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { getBillingSettings, invoiceContacts } from '@/lib/invoicing';
import { addDays, formatDate, formatDateTime, zonedDate, zonedToUtc } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily: (1) mark invoices past their due date as overdue; (2) remind families a few
 * days before the due date; (3) remind weekly once overdue; (4) remind families of
 * tomorrow's lessons. Each reminder is claimed once per invoice/lesson per day, so a
 * retried run never sends it twice.
 */
export async function GET(request: Request) {
  return runCron(request, 'reminders', async (admin) => {
    const { timezone } = await localeSettings(admin);
    const settings = await getBillingSettings(admin);
    const today = zonedDate(new Date(), timezone);
    const tally = { marked_overdue: 0, upcoming: 0, overdue: 0, lessons: 0 };

    const { data: nowOverdue } = await admin.from('invoices').update({ status: 'overdue' }).eq('status', 'unpaid').lt('due_date', today).select('id');
    tally.marked_overdue = nowOverdue?.length ?? 0;

    const { data: open } = await admin
      .from('invoices').select('id, number, student_id, total_minor, paid_minor, currency, due_date, status')
      .in('status', ['unpaid', 'partially_paid', 'overdue']).not('due_date', 'is', null);
    for (const inv of open ?? []) {
      const due = inv.due_date as string;
      const isUpcoming = due === addDays(today, settings.reminder_days_before);
      const daysLate = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);
      const isOverdue = daysLate >= 1 && (daysLate - 1) % 7 === 0; // day 1, 8, 15, …
      if (!isUpcoming && !isOverdue) continue;
      if (!(await claim(admin, 'invoice-reminder', `${inv.id}:${today}`))) continue;

      const amount = formatMoney(Number(inv.total_minor) - Number(inv.paid_minor), inv.currency);
      await admin.rpc('notify_family', { p_student: inv.student_id, p_title: isOverdue ? 'Invoice overdue' : 'Payment reminder', p_body: `Invoice ${inv.number}`, p_path: '/invoices' });
      for (const c of await invoiceContacts(admin, inv.student_id)) {
        await sendEmail('paymentReminder', c.email, { name: c.full_name, number: inv.number, amount, due: formatDate(due), overdue: isOverdue });
      }
      tally[isOverdue ? 'overdue' : 'upcoming'] += 1;
    }

    // Lesson reminders for tomorrow (academy calendar day).
    const { data: prefs } = await admin.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    if ((prefs?.value as { class_reminders?: boolean } | null)?.class_reminders !== false) {
      const from = zonedToUtc(`${addDays(today, 1)}T00:00`, timezone)!.toISOString();
      const to = zonedToUtc(`${addDays(today, 2)}T00:00`, timezone)!.toISOString();
      const { data: classes } = await admin
        .from('classes').select('id, title, starts_at, delivery, venue, class_students(student_id)')
        .eq('status', 'scheduled').gte('starts_at', from).lt('starts_at', to);
      for (const c of classes ?? []) {
        // Keyed by class and date, so a rescheduled class is reminded again for its new day.
        if (!(await claim(admin, 'lesson-reminder', `${c.id}:${zonedDate(c.starts_at, timezone)}`))) continue;
        const when = `${formatDateTime(c.starts_at, timezone)} (${timezone} time)`;
        const where = c.delivery === 'online' ? 'Online. Join from your portal timetable.' : `Home tutoring${c.venue ? ` at ${c.venue}` : ''}.`;
        for (const row of (c.class_students as Array<{ student_id: string }>) ?? []) {
          await admin.rpc('notify_family', { p_student: row.student_id, p_title: 'Class tomorrow', p_body: c.title, p_path: '/timetable' });
          const { data: student } = await admin.from('profiles').select('full_name, email, status').eq('id', row.student_id).maybeSingle();
          if (student?.status === 'active') await sendEmail('upcomingClass', student.email, { name: student.full_name, title: c.title, when, where });
        }
        tally.lessons += 1;
      }
    }

    // Housekeeping: claims older than 90 days are no longer needed.
    await admin.from('job_runs').delete().in('job', ['invoice-reminder', 'lesson-reminder']).lt('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
    return tally;
  });
}
