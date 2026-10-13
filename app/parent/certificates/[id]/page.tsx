import { FamilyCertificatePage } from '@/components/family/ReportPage';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Certificate' };

export default async function Page({ params }: { params: { id: string } }) {
  await parentContext();
  return <FamilyCertificatePage id={params.id} backHref="/parent/reports" />;
}
