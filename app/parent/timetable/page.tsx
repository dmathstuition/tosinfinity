import { AttendanceSummary, PastLessons, UpcomingClasses } from '@/components/family/views';
import { ChildSwitcher, NoChildren } from '@/components/family/ChildSwitcher';
import { PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Classes' };

export default async function Page({ searchParams }: { searchParams: { child?: string } }) {
  const { children, child } = await parentContext(searchParams.child);
  if (!child) return <NoChildren />;
  return (
    <>
      <PageHeader title="Classes" description="Times are shown in your local time." />
      <ChildSwitcher childList={children} current={child} path="/parent/timetable" />
      <UpcomingClasses studentId={child.id} roomBase="/parent/classes" />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Past lessons, recaps and homework</h2>
      <PastLessons studentId={child.id} roomBase="/parent/classes" />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Attendance record</h2>
      <AttendanceSummary studentId={child.id} detailed />
    </>
  );
}
