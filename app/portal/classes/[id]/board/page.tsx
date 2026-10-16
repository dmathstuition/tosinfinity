import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LiveBoard } from '@/components/board/LiveBoard';
import { PageHeader } from '@/components/ui/primitives';
import { loadBoard } from '@/lib/board-server';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Class board' };

/** A learner's view of the class board. RLS returns the board only to learners in the class. */
export default async function StudentBoardPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { profile, supabase } = await studentContext();
  const [{ data: c }, { data: member }, { data: board }] = await Promise.all([
    supabase.from('classes').select('id, title').eq('id', params.id).maybeSingle(),
    supabase.from('class_students').select('student_id').eq('class_id', params.id).eq('student_id', profile.id).maybeSingle(),
    supabase.from('boards').select('id').eq('class_id', params.id).maybeSingle(),
  ]);
  if (!c || !member) notFound();

  return (
    <>
      <p className="mb-3 text-sm"><Link href={`/portal/classes/${c.id}`} className="text-link hover:underline">← Lesson room</Link></p>
      <PageHeader title={`Board: ${c.title}`} description="Follows your tutor’s board as they write." />
      {board
        ? <LiveBoard boardId={board.id} studentId={profile.id} initial={await loadBoard(supabase, board.id)} />
        : <p className="card p-6 text-muted">Your tutor has not opened a board for this lesson yet.</p>}
    </>
  );
}
