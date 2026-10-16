'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardEvent, BoardPage } from '@/lib/board';
import { createClient } from '@/lib/supabase/client';

export type BoardState = { page_id: string | null; prompt_id: string | null; spotlight: { name: string; strokes: unknown; text?: string | null } | null; timer_ends_at: string | null };
export type Prompt = { id: string; question: string; status: 'open' | 'closed'; created_at: string };
export type Response = { id: string; prompt_id: string; student_id: string; strokes: unknown; text_answer: string | null; submitted_at: string };

export type LiveInitial = { events: BoardEvent[]; pages: BoardPage[]; state: BoardState; prompts: Prompt[]; responses: Response[] };

const POLL_MS = 4000;

/**
 * Keeps a board in sync. Supabase Realtime pushes new rows instantly (RLS applies to
 * each subscriber); a light poll every few seconds catches anything missed on a weak
 * connection. Rows are merged by id, so duplicates from both paths are harmless.
 */
export function useLiveBoard(boardId: string, initial: LiveInitial, withResponses: boolean) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<BoardEvent[]>(initial.events);
  const [pages, setPages] = useState<BoardPage[]>(initial.pages);
  const [state, setState] = useState<BoardState>(initial.state);
  const [prompts, setPrompts] = useState<Prompt[]>(initial.prompts);
  const [responses, setResponses] = useState<Response[]>(initial.responses);
  const [live, setLive] = useState(false);
  const lastId = useRef(initial.events.reduce((m, e) => Math.max(m, e.id), 0));

  const mergeEvents = useCallback((rows: BoardEvent[]) => {
    if (!rows.length) return;
    for (const r of rows) lastId.current = Math.max(lastId.current, r.id);
    setEvents((prev) => {
      const seen = new Set(prev.map((e) => e.id));
      const add = rows.filter((r) => !seen.has(r.id));
      return add.length ? [...prev, ...add].sort((a, b) => a.id - b.id) : prev;
    });
  }, []);
  const upsert = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>) => (row: T) =>
    set((prev) => (prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row]));

  const poll = useCallback(async () => {
    const [ev, st, pg, pr, rs] = await Promise.all([
      supabase.from('board_events').select('id, page_id, kind, data').eq('board_id', boardId).gt('id', lastId.current).order('id').limit(1000),
      supabase.from('board_state').select('page_id, prompt_id, spotlight, timer_ends_at').eq('board_id', boardId).maybeSingle(),
      supabase.from('board_pages').select('id, position, background, image_path').eq('board_id', boardId).order('position'),
      supabase.from('board_prompts').select('id, question, status, created_at').eq('board_id', boardId).order('created_at'),
      withResponses ? supabase.from('board_responses').select('id, prompt_id, student_id, strokes, text_answer, submitted_at').eq('board_id', boardId) : Promise.resolve({ data: null }),
    ]);
    if (ev.data) mergeEvents(ev.data as BoardEvent[]);
    if (st.data) setState(st.data as BoardState);
    if (pg.data) setPages(pg.data as BoardPage[]);
    if (pr.data) setPrompts(pr.data as Prompt[]);
    if (rs.data) setResponses(rs.data as Response[]);
  }, [supabase, boardId, withResponses, mergeEvents]);

  useEffect(() => {
    const filter = `board_id=eq.${boardId}`;
    let channel = supabase
      .channel(`board-${boardId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'board_events', filter }, (p) => mergeEvents([p.new as BoardEvent]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_state', filter }, (p) => { if (p.new && 'board_id' in p.new) setState(p.new as BoardState); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_prompts', filter }, (p) => { if (p.new && 'id' in p.new) upsert(setPrompts)(p.new as Prompt); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_pages', filter }, () => { void poll(); });
    if (withResponses) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'board_responses', filter }, (p) => { if (p.new && 'id' in p.new) upsert(setResponses)(p.new as Response); });
    }
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'));
    const t = setInterval(() => { if (document.visibilityState === 'visible') void poll(); }, POLL_MS);
    return () => { clearInterval(t); void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, boardId, withResponses]);

  return { supabase, events, setEvents, mergeEvents, pages, setPages, state, setState, prompts, setPrompts, responses, live, refresh: poll };
}

/** Signed URLs for slide images in the private "boards" bucket, cached per path. */
export function useSlideUrls(supabase: ReturnType<typeof createClient>, pages: BoardPage[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = pages.filter((p) => p.background === 'image' && p.image_path && !urls[p.image_path]).map((p) => p.image_path!);
    if (!missing.length) return;
    void supabase.storage.from('boards').createSignedUrls(missing, 6 * 3600).then(({ data }) => {
      if (!data) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const d of data) if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
        return next;
      });
    });
  }, [supabase, pages, urls]);
  return urls;
}
