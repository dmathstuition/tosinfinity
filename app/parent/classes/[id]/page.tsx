import { notFound } from 'next/navigation';
import { LessonRoom } from '@/components/family/LessonRoom';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Lesson' };

/**
 * A parent's view of one lesson. Notifications link here without naming a child, so
 * the child is worked out from the class: whichever of this parent's linked children
 * is in it (or the one named in ?child=, if that child is theirs and in the class).
 */
export default async function ParentLessonPage({ params, searchParams }: { params: { id: string }; searchParams: { child?: string } }) {
  const { supabase, children } = await parentContext(searchParams.child);
  if (!/^[0-9a-f-]{36}$/i.test(params.id) || children.length === 0) notFound();
  // RLS only returns rows for this parent's own children.
  const { data } = await supabase.from('class_students').select('student_id').eq('class_id', params.id).in('student_id', children.map((c) => c.id));
  const inClass = new Set((data ?? []).map((r) => r.student_id));
  const child = children.find((c) => c.id === searchParams.child && inClass.has(c.id)) ?? children.find((c) => inClass.has(c.id));
  if (!child) notFound();
  return <LessonRoom classId={params.id} studentId={child.id} studentName={child.full_name} mode="parent" backHref={`/parent/timetable?child=${child.id}`} />;
}
