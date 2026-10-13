import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { currentMonth } from '@/lib/billing';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { formatDate, zonedDate } from '@/lib/time';
import { createReportAction, issueCertificateAction, revokeCertificateAction } from './actions';

export const metadata = { title: 'Reports' };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function ReportsPage({ searchParams }: { searchParams: { student?: string } }) {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const today = zonedDate(new Date(), timezone);
  const month = currentMonth(today);
  const preset = searchParams.student && isUuid(searchParams.student) ? searchParams.student : '';
  const [{ data: reports }, { data: certificates }, { data: students }] = await Promise.all([
    supabase.from('reports').select('id, period_start, period_end, status, student:profiles(full_name)').order('created_at', { ascending: false }).limit(60),
    supabase.from('certificates').select('id, title, issued_on, code, student:profiles(full_name)').order('created_at', { ascending: false }).limit(40),
    supabase.from('profiles').select('id, full_name').eq('role', 'student').eq('status', 'active').order('full_name'),
  ]);
  const studentSelect = (id: string) => (
    <div>
      <label htmlFor={id} className="label">Student</label>
      <select id={id} name="student_id" required defaultValue={preset} className="field">
        <option value="" disabled>Select…</option>
        {(students ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader title="Reports and certificates" description="Draft, review and publish progress reports. Certificates are issued only when you choose." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">New progress report</h2>
            <ActionForm action={createReportAction} submitLabel="Create draft">
              {studentSelect('report-student')}
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="period_start" className="label">From</label><input id="period_start" name="period_start" type="date" required defaultValue={month.start} className="field" /></div>
                <div><label htmlFor="period_end" className="label">To</label><input id="period_end" name="period_end" type="date" required defaultValue={today} className="field" /></div>
              </div>
              <p className="text-xs text-muted">Attendance and marked work for the period are filled in automatically. You add the comments, then publish.</p>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Issue a certificate</h2>
            <ActionForm action={issueCertificateAction} submitLabel="Issue certificate" variant="secondary" resetOnSuccess confirm="Issue this certificate? The family will be notified.">
              {studentSelect('cert-student')}
              <div><label htmlFor="cert-title" className="label">Title</label><input id="cert-title" name="title" required placeholder="e.g. Certificate of Completion" className="field" /></div>
              <div><label htmlFor="cert-desc" className="label">Wording</label><textarea id="cert-desc" name="description" rows={3} placeholder="For successfully completing…" className="field" /></div>
              <div><label htmlFor="issued_on" className="label">Date issued</label><input id="issued_on" name="issued_on" type="date" defaultValue={today} className="field" /></div>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Reports</h2>
            {reports?.length ? (
              <ul className="mt-2 divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/owner/reports/${r.id}`} className="min-w-0 hover:underline">
                      <p className="truncate font-medium">{one(r.student)?.full_name}</p>
                      <p className="text-sm text-muted">{formatDate(r.period_start)} to {formatDate(r.period_end)}</p>
                    </Link>
                    <Badge tone={r.status === 'published' ? 'green' : 'neutral'}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-3"><EmptyState title="No reports yet" /></div>}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Certificates issued</h2>
            {certificates?.length ? (
              <ul className="mt-2 divide-y divide-line">
                {certificates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.title}</p>
                      <p className="text-sm text-muted">{one(c.student)?.full_name} · {formatDate(c.issued_on)}</p>
                    </div>
                    <div className="flex gap-2">
                      <ButtonLink href={`/owner/reports/certificates/${c.id}`} variant="outline" size="sm">View</ButtonLink>
                      <ActionForm action={revokeCertificateAction} submitLabel="Withdraw" variant="outline" size="sm" hidden={{ id: c.id }} confirm="Withdraw this certificate?" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No certificates have been issued.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
