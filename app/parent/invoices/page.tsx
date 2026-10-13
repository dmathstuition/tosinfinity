import { InvoiceList } from '@/components/family/views';
import { ChildSwitcher, NoChildren } from '@/components/family/ChildSwitcher';
import { PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Invoices' };

export default async function Page({ searchParams }: { searchParams: { child?: string } }) {
  const { children, child } = await parentContext(searchParams.child);
  if (!child) return <NoChildren />;
  return (
    <>
      <PageHeader title="Invoices" description="Invoices, receipts and payment history." />
      <ChildSwitcher childList={children} current={child} path="/parent/invoices" />
      <InvoiceList studentId={child.id} base="/parent" />
    </>
  );
}
