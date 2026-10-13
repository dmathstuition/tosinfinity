import { InvoiceList } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Invoices' };

export default async function Page() {
  const { profile } = await studentContext();
  return (
    <>
      <PageHeader title="Invoices and payments" description="Open an invoice to pay it or to download a receipt." />
      <InvoiceList studentId={profile.id} base="/portal" />
    </>
  );
}
