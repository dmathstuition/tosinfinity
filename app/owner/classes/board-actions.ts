'use server';

import { revalidatePath } from 'next/cache';
import { type BoardEvent, visibleEvents } from '@/lib/board';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';

type Supabase = Awaited<ReturnType<typeof ownerContext>>['supabase'];

/**
 * Copies the visible content of every page of one board onto another (appending
 * pages). Slide images are copied too, so deleting one board never breaks another.
 */
async function copyBoard(supabase: Supabase, fromId: string, toId: string): Promise<number> {
  const [{ data: pages }, { data: events }, { data: last }] = await Promise.all([
    supabase.from('board_pages').select('id, position, background, image_path').eq('board_id', fromId).order('position'),
    supabase.from('board_events').select('id, page_id, kind, data').eq('board_id', fromId).order('id').limit(20000),
    supabase.from('board_pages').select('position').eq('board_id', toId).order('position', { ascending: false }).limit(1).maybeSingle(),
  ]);
  let position = last?.position ?? 0;
  let copied = 0;
  for (const p of pages ?? []) {
    let imagePath: string | null = null;
    if (p.background === 'image' && p.image_path) {
      const target = `${toId}/${crypto.randomUUID()}.${p.image_path.split('.').pop() ?? 'png'}`;
      const { error } = await supabase.storage.from('boards').copy(p.image_path, target);
      imagePath = error ? null : target;
    }
    const { data: page } = await supabase
      .from('board_pages')
      .insert({ board_id: toId, position: ++position, background: imagePath ? 'image' : p.background === 'image' ? 'blank' : p.background, image_path: imagePath })
      .select('id')
      .single();
    if (!page) continue;
    const rows = visibleEvents((events ?? []) as BoardEvent[], p.id).map((e) => ({ board_id: toId, page_id: page.id, kind: e.kind, data: e.data }));
    for (let i = 0; i < rows.length; i += 500) await supabase.from('board_events').insert(rows.slice(i, i + 500));
    copied += 1;
  }
  return copied;
}

/** Saves the class board into the lesson library so it can be reused with another class. */
export async function saveToLibraryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const classId = str(fd, 'id');
  const boardId = str(fd, 'board_id');
  const title = str(fd, 'title', 160);
  if (!isUuid(classId) || !isUuid(boardId)) return fail('Unknown board.');
  if (title.length < 2) return fail('Give the saved lesson a name.');
  const { data: lib, error } = await supabase.from('boards').insert({ title }).select('id').single();
  if (error || !lib) return fail('Could not save to the library.');
  const pages = await copyBoard(supabase, boardId, lib.id);
  revalidatePath(`/owner/classes/${classId}/board`);
  return ok(`Saved “${title}” to your lesson library (${pages} page${pages === 1 ? '' : 's'}).`);
}

/** Adds the pages of a saved lesson to the end of this class's board. */
export async function loadFromLibraryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const classId = str(fd, 'id');
  const boardId = str(fd, 'board_id');
  const libraryId = str(fd, 'library_id');
  if (!isUuid(classId) || !isUuid(boardId) || !isUuid(libraryId)) return fail('Choose a saved lesson.');
  const { data: lib } = await supabase.from('boards').select('id').eq('id', libraryId).is('class_id', null).maybeSingle();
  if (!lib) return fail('That saved lesson no longer exists.');
  const pages = await copyBoard(supabase, libraryId, boardId);
  revalidatePath(`/owner/classes/${classId}/board`);
  return ok(`Added ${pages} page${pages === 1 ? '' : 's'} to this board.`);
}

export async function deleteLibraryLessonAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const libraryId = str(fd, 'library_id');
  if (!isUuid(libraryId)) return fail('Choose a saved lesson.');
  const { data: images } = await supabase.from('board_pages').select('image_path').eq('board_id', libraryId).not('image_path', 'is', null);
  const paths = (images ?? []).map((i) => i.image_path).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from('boards').remove(paths);
  await supabase.from('boards').delete().eq('id', libraryId).is('class_id', null);
  revalidatePath(`/owner/classes/${str(fd, 'id')}/board`);
  return ok('Saved lesson deleted.');
}
