import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/portal/PrintButton';
import { CertificateDocument } from '@/components/portal/ReportDocument';
import { isUuid, ownerContext } from '@/lib/owner';

export const metadata = { title: 'Certificate' };

export default async function CertificatePage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { data: c } = await supabase.from('certificates').select('*, student:profiles(full_name)').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const student = Array.isArray(c.student) ? c.student[0] : c.student;
  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/owner/reports" className="text-sm text-link hover:underline">← Reports and certificates</Link>
        <PrintButton />
      </div>
      <CertificateDocument studentName={student?.full_name ?? ''} title={c.title} description={c.description} issuedOn={c.issued_on} code={c.code} />
    </>
  );
}
