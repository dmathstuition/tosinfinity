import { ReportList } from '@/components/family/views';
import { ChildSwitcher, NoChildren } from '@/components/family/ChildSwitcher';
import { PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Reports' };

export default async function Page({ searchParams }: { searchParams: { child?: string } }) {
  const { children, child } = await parentContext(searchParams.child);
  if (!child) return <NoChildren />;
  return (
    <>
      <PageHeader title="Reports" description="Progress reports, learning targets and certificates." />
      <ChildSwitcher childList={children} current={child} path="/parent/reports" />
      <ReportList studentId={child.id} base="/parent" />
    </>
  );
}
