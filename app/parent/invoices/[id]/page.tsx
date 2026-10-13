import { FamilyInvoicePage } from '@/components/family/InvoicePage';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Invoice' };

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { payment?: string } }) {
  await parentContext();
  return <FamilyInvoicePage id={params.id} backHref="/parent/invoices" payment={searchParams.payment} />;
}
