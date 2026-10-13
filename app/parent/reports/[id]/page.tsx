import { FamilyReportPage } from '@/components/family/ReportPage';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Progress report' };

export default async function Page({ params }: { params: { id: string } }) {
  await parentContext();
  return <FamilyReportPage id={params.id} backHref="/parent/reports" />;
}
