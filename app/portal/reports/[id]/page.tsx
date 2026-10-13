import { FamilyReportPage } from '@/components/family/ReportPage';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Progress report' };

export default async function Page({ params }: { params: { id: string } }) {
  await studentContext();
  return <FamilyReportPage id={params.id} backHref="/portal/reports" />;
}
