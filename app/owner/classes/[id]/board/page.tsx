import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OwnerBoard } from '@/components/board/OwnerBoard';
import { ActionForm } from '@/components/ui/ActionForm';
import { Alert, Card, PageHeader } from '@/components/ui/primitives';
import { loadBoard } from '@/lib/board-server';
import { isUuid, ownerContext } from '@/lib/owner';
import { deleteLibraryLessonAction, loadFromLibraryAction, saveToLibraryAction } from '../../board-actions';

export const metadata = { title: 'Class board' };

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function OwnerBoardPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { data: c } = await supabase.from('classes').select('id, title, status').eq('id', params.id).maybeSingle();
  if (!c) notFound();

  // The board is created the first time it is opened, with one squared page.
  let { data: board } = await supabase.from('boards').select('id, title').eq('class_id', c.id).maybeSingle();
  if (!board) {
    const { data: created } = await supabase.from('boards').insert({ class_id: c.id, title: c.title.slice(0, 160) }).select('id, title').single();
    if (created) {
      const { data: page } = await supabase.from('board_pages').insert({ board_id: created.id, position: 1, background: 'grid' }).select('id').single();
      await supabase.from('board_state').upsert({ board_id: created.id, page_id: page?.id ?? null });
      board = created;
    } else {
      // Another tab may have created it at the same moment.
      ({ data: board } = await supabase.from('boards').select('id, title').eq('class_id', c.id).maybeSingle());
    }
  }
  if (!board) return <Alert tone="error">The board could not be opened. Please refresh the page.</Alert>;

  const [initial, { data: roster }, { data: library }] = await Promise.all([
    loadBoard(supabase, board.id),
    supabase.from('class_students').select('student_id, student:profiles(full_name)').eq('class_id', c.id),
    supabase.from('boards').select('id, title, created_at').is('class_id', null).order('created_at', { ascending: false }).limit(100),
  ]);
  const members = (roster ?? []).map((r) => ({ id: r.student_id, name: one(r.student)?.full_name ?? 'Student' }));

  return (
    <>
      <p className="mb-3 text-sm"><Link href={`/owner/classes/${c.id}/room`} className="text-link hover:underline">← Lesson room</Link></p>
      <PageHeader
        title={`Board: ${c.title}`}
        description="Write, draw and show slides. Learners in this class see it live on their phone, tablet or laptop at /portal, in the classroom or at home."
      />
      <OwnerBoard boardId={board.id} members={members} initial={initial} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Save to lesson library</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Keep these pages to reuse with another class. Answers and learner work are not copied.</p>
          <ActionForm action={saveToLibraryAction} submitLabel="Save to library" variant="secondary" size="sm" hidden={{ id: c.id, board_id: board.id }}>
            <div><label htmlFor="lib_title" className="label">Name</label><input id="lib_title" name="title" required maxLength={160} defaultValue={c.title} className="field" /></div>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Use a saved lesson</h2>
          {library?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {library.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{l.title}</span>
                  <span className="flex gap-2">
                    <ActionForm action={loadFromLibraryAction} submitLabel="Add pages" variant="outline" size="sm" hidden={{ id: c.id, board_id: board!.id, library_id: l.id }} />
                    <ActionForm action={deleteLibraryLessonAction} submitLabel="Delete" variant="ghost" size="sm" hidden={{ id: c.id, library_id: l.id }} confirm="Delete this saved lesson?" />
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Nothing saved yet.</p>}
        </Card>
      </div>
    </>
  );
}
