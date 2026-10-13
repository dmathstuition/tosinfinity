import { FamilyInvoicePage } from '@/components/family/InvoicePage';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Invoice' };

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { payment?: string } }) {
  await studentContext();
  return <FamilyInvoicePage id={params.id} backHref="/portal/invoices" payment={searchParams.payment} />;
}
