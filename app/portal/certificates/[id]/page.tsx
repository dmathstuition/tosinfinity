import { FamilyCertificatePage } from '@/components/family/ReportPage';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Certificate' };

export default async function Page({ params }: { params: { id: string } }) {
  await studentContext();
  return <FamilyCertificatePage id={params.id} backHref="/portal/reports" />;
}
