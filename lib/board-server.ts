import 'server-only';
import type { BoardState, LiveInitial, Prompt, Response } from '@/components/board/useLiveBoard';
import type { BoardEvent, BoardPage } from '@/lib/board';
import type { createClient } from '@/lib/supabase/server';

type Supabase = ReturnType<typeof createClient>;

/** Everything a board screen needs on first load. RLS decides what the viewer may read. */
export async function loadBoard(supabase: Supabase, boardId: string): Promise<LiveInitial> {
  const [ev, pg, st, pr, rs] = await Promise.all([
    supabase.from('board_events').select('id, page_id, kind, data').eq('board_id', boardId).order('id').limit(20000),
    supabase.from('board_pages').select('id, position, background, image_path').eq('board_id', boardId).order('position'),
    supabase.from('board_state').select('page_id, prompt_id, spotlight, timer_ends_at').eq('board_id', boardId).maybeSingle(),
    supabase.from('board_prompts').select('id, question, status, created_at').eq('board_id', boardId).order('created_at'),
    supabase.from('board_responses').select('id, prompt_id, student_id, strokes, text_answer, submitted_at').eq('board_id', boardId),
  ]);
  return {
    events: (ev.data ?? []) as BoardEvent[],
    pages: (pg.data ?? []) as BoardPage[],
    state: (st.data as BoardState | null) ?? { page_id: null, prompt_id: null, spotlight: null, timer_ends_at: null },
    prompts: (pr.data ?? []) as Prompt[],
    responses: (rs.data ?? []) as Response[],
  };
}
