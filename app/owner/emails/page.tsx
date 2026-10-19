import Link from 'next/link';
import clsx from 'clsx';
import { CalendarClock, CheckCircle2, MailCheck, MailMinus, MailX } from 'lucide-react';
import { LocalTime } from '@/components/portal/LocalTime';
import { ActionForm } from '@/components/ui/ActionForm';
import { Alert, Badge, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { emailConfigured, emailProviderName } from '@/lib/email';
import { optionalEnv } from '@/lib/env';
import { academyLocale, ownerContext } from '@/lib/owner';
import { previewWeeklyReportAction, sendTestEmailAction } from './actions';

export const metadata = { title: 'Email centre' };

const PROVIDER = { resend: 'Resend', relay: 'Gmail (Google Apps Script relay)', console: 'Not sending (development console)' } as const;
const STATUS_TONE = { sent: 'green', failed: 'red', skipped: 'neutral', logged: 'blue' } as const;
const NAMES: Record<string, string> = {
  accountActivation: 'Welcome and sign-in details', passwordRecovery: 'Password reset', upcomingClass: 'Lesson reminder',
  assignmentSet: 'New work', assignmentDue: 'Work due reminder', assignmentGraded: 'Work marked', newMessage: 'New message',
  newAnnouncement: 'Announcement', invoiceIssued: 'Invoice', paymentReminder: 'Payment reminder', paymentReceipt: 'Receipt',
  weeklyReport: 'Weekly progress', testEmail: 'Test', applicationReceived: 'Application received', applicationNotifyOwner: 'New application (to you)',
  applicationRejected: 'Application declined', blogPublished: 'New article', newsletterVerify: 'Newsletter confirmation',
};
const FILTERS: Array<[label: string, value: string]> = [['All', ''], ['Sent', 'sent'], ['Failed', 'failed'], ['Switched off', 'skipped']];

export default async function EmailCentrePage({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase, profile } = await ownerContext();
  const { timezone } = await academyLocale();
  const filter = ['sent', 'failed', 'skipped'].includes(searchParams.status ?? '') ? searchParams.status! : '';
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  let logQuery = supabase.from('email_log').select('id, template, recipient, status, provider, error, created_at').order('created_at', { ascending: false }).limit(100);
  if (filter) logQuery = logQuery.eq('status', filter);
  const [{ data: log, error }, { data: week }, { data: students }, { data: settingsRow }] = await Promise.all([
    logQuery,
    supabase.from('email_log').select('status').gte('created_at', since).limit(5000),
    supabase.from('profiles').select('id, full_name').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('settings').select('value').eq('key', 'notifications').maybeSingle(),
  ]);
  const count = (s: string) => (week ?? []).filter((r) => r.status === s).length;
  const notify = (settingsRow?.value ?? {}) as { class_reminders?: boolean; work_reminders?: boolean; weekly_reports?: boolean };
  const provider = emailProviderName();
  const automatic = [
    { name: 'Lesson reminders', when: 'Daily at 07:00 (Lagos), for the next day’s lessons', on: notify.class_reminders !== false, who: 'Learner and parents' },
    { name: 'Work due reminders', when: 'Daily at 07:00, for work due the next day and not handed in', on: notify.work_reminders !== false, who: 'Learner and parents' },
    { name: 'Weekly progress email', when: 'Fridays at 16:00 (Lagos)', on: notify.weekly_reports !== false, who: 'Learner and parents (parents also see any balance)' },
    { name: 'Invoice reminders', when: 'Daily, before the due date and weekly once overdue', on: true, who: 'Parents (or an adult learner)' },
  ];

  return (
    <>
      <PageHeader title="Email centre" description="How emails are delivered, what goes out automatically, and a log of every email from the last 90 days." />
      {!emailConfigured() && (
        <div className="mb-5"><Alert tone="warning">Email delivery is not configured, so no emails are being sent. Set it up with Gmail (scripts/gmail-relay.gs) or Resend; see the README.</Alert></div>
      )}
      {error && <div className="mb-5"><Alert tone="warning">The email log is not available yet. Run supabase/setup_all.sql again to add it.</Alert></div>}

      <section aria-label="Last 7 days" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sent (7 days)" value={count('sent')} icon={MailCheck} tone="green" />
        <Stat label="Failed (7 days)" value={count('failed')} icon={MailX} tone="red" />
        <Stat label="Switched off by recipient" value={count('skipped')} icon={MailMinus} tone="lilac" />
        <Stat label="Delivery" value={provider === 'console' ? 'Off' : provider === 'relay' ? 'Gmail' : 'Resend'} icon={CheckCircle2} tone="royal" hint={PROVIDER[provider]} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-1 text-lg font-semibold">Automatic emails</h2>
          <p className="mb-4 text-sm text-muted">
            Change these in <Link href="/owner/settings#notifications" className="text-link underline">Settings → Notification preferences</Link>. Families can also switch reminders, updates and the weekly email off for themselves.
          </p>
          <ul className="space-y-3">
            {automatic.map((a) => (
              <li key={a.name} className="flex items-start justify-between gap-3 rounded-2xl bg-sunken p-3">
                <span className="flex items-start gap-3">
                  <CalendarClock size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-link" />
                  <span><span className="font-semibold">{a.name}</span><span className="block text-sm text-muted">{a.when} · {a.who}</span></span>
                </span>
                <Badge tone={a.on ? 'green' : 'neutral'}>{a.on ? 'On' : 'Off'}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Sent as things happen: welcome and sign-in details (new accounts and “Send activation link”), new work, marks, messages, announcements, invoices and receipts. Passwords are never sent by email.
          </p>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Send a test email</h2>
            <ActionForm action={sendTestEmailAction} submitLabel="Send test" variant="secondary" size="sm">
              <div><label htmlFor="to" className="label">To</label><input id="to" name="to" type="email" defaultValue={profile.email} className="field" /></div>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Preview a weekly report</h2>
            <p className="mb-3 text-sm text-muted">Sends one learner’s report for the past week to you only, as their parents would see it.</p>
            {students?.length ? (
              <ActionForm action={previewWeeklyReportAction} submitLabel="Send preview to me" variant="outline" size="sm">
                <div>
                  <label htmlFor="student_id" className="label">Learner</label>
                  <select id="student_id" name="student_id" className="field">{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
                </div>
              </ActionForm>
            ) : <p className="text-sm text-muted">Add a learner first.</p>}
          </Card>
          {!optionalEnv('EMAIL_FROM') && provider === 'resend' && <Alert tone="warning">EMAIL_FROM is not set.</Alert>}
        </div>
      </div>

      <section className="card mt-6 p-5 sm:p-6" aria-label="Email log">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Log</h2>
          <nav aria-label="Filter" className="flex flex-wrap gap-2 text-sm">
            {FILTERS.map(([label, v]) => (
              <Link key={label} href={v ? `/owner/emails?status=${v}` : '/owner/emails'} aria-current={filter === v ? 'page' : undefined}
                className={clsx('rounded-full px-3 py-1.5 font-semibold', filter === v ? 'bg-navy text-white' : 'bg-sunken')}>{label}</Link>
            ))}
          </nav>
        </div>
        {log?.length ? (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead><tr><th className="p-2 text-left">When</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">To</th><th className="p-2 text-left">Result</th></tr></thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap p-2 text-muted"><LocalTime iso={l.created_at} fallbackZone={timezone} /></td>
                    <td className="p-2">{NAMES[l.template] ?? l.template}</td>
                    <td className="max-w-[14rem] truncate p-2">{l.recipient}</td>
                    <td className="p-2">
                      <Badge tone={STATUS_TONE[l.status as keyof typeof STATUS_TONE] ?? 'neutral'}>{l.status === 'skipped' ? 'switched off' : l.status}</Badge>
                      {l.error && l.status === 'failed' && <span className="mt-1 block text-xs text-bad">{l.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No emails {filter ? `with status “${filter}” ` : ''}yet.</p>}
      </section>
    </>
  );
}
