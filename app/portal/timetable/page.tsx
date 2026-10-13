import { AttendanceSummary, PastLessons, UpcomingClasses } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Timetable' };

export default async function Page() {
  const { profile } = await studentContext();
  return (
    <>
      <PageHeader title="Timetable" description="Times are shown in your local time." />
      <UpcomingClasses studentId={profile.id} canJoin roomBase="/portal/classes" />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Past lessons, recaps and homework</h2>
      <PastLessons studentId={profile.id} roomBase="/portal/classes" />
      <h2 className="mb-3 mt-10 text-lg font-semibold">Attendance record</h2>
      <AttendanceSummary studentId={profile.id} detailed />
    </>
  );
}
