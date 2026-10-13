import { AssignmentList, ProgressBars } from '@/components/family/views';
import { ChildSwitcher, NoChildren } from '@/components/family/ChildSwitcher';
import { Card, PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Progress' };

export default async function Page({ searchParams }: { searchParams: { child?: string } }) {
  const { children, child } = await parentContext(searchParams.child);
  if (!child) return <NoChildren />;
  return (
    <>
      <PageHeader title="Progress" description="Assessment results, tutor feedback and learning trend." />
      <ChildSwitcher childList={children} current={child} path="/parent/progress" />
      <div className="mb-6">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Progress trend</h2>
          <ProgressBars studentId={child.id} />
        </Card>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Assignments and results</h2>
      <AssignmentList studentId={child.id} />
    </>
  );
}
