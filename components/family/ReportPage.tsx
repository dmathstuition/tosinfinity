import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/portal/PrintButton';
import { CertificateDocument, ReportDocument } from '@/components/portal/ReportDocument';
import { one } from '@/lib/family';
import type { ReportContent } from '@/lib/reports';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;

/** RLS returns a report only when it is published and the viewer is the student or a verified parent. */
export async function FamilyReportPage({ id, backHref }: { id: string; backHref: string }) {
  if (!UUID.test(id)) notFound();
  const { data: r } = await createClient().from('reports').select('period_start, period_end, content').eq('id', id).eq('status', 'published').maybeSingle();
  if (!r) notFound();
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-link hover:underline">← Reports</Link>
        <PrintButton label="Print or download report" />
      </div>
      <ReportDocument content={r.content as ReportContent} periodStart={r.period_start} periodEnd={r.period_end} />
    </>
  );
}

export async function FamilyCertificatePage({ id, backHref }: { id: string; backHref: string }) {
  if (!UUID.test(id)) notFound();
  const { data: c } = await createClient().from('certificates').select('title, description, issued_on, code, student:profiles(full_name)').eq('id', id).maybeSingle();
  if (!c) notFound();
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-link hover:underline">← Reports</Link>
        <PrintButton label="Print or download certificate" />
      </div>
      <CertificateDocument studentName={one(c.student)?.full_name ?? ''} title={c.title} description={c.description} issuedOn={c.issued_on} code={c.code} />
    </>
  );
}
