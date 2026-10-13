import { LessonRoom } from '@/components/family/LessonRoom';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Lesson room' };

export default async function StudentLessonPage({ params }: { params: { id: string } }) {
  const { profile } = await studentContext();
  return <LessonRoom classId={params.id} studentId={profile.id} studentName={profile.full_name} mode="student" backHref="/portal/timetable" />;
}
