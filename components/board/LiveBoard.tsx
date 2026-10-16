'use client';

import clsx from 'clsx';
import { Eraser, History, Send, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { type BoardEvent, COLORS, type Pt, strokesToEvents, visibleEvents, WIDTHS } from '@/lib/board';
import { BoardCanvas } from './BoardCanvas';
import { BoardTimer } from './BoardTimer';
import { type LiveInitial, useLiveBoard, useSlideUrls } from './useLiveBoard';

type Stroke = { points: Pt[]; color: string; width: number };

/**
 * What a learner sees: the tutor's current page, live. When the tutor asks an
 * answer-board question, the learner answers on their own mini board. After the
 * lesson, "Replay" steps back through how the board was written.
 */
export function LiveBoard({ boardId, studentId, initial }: { boardId: string; studentId: string; initial: LiveInitial }) {
  const b = useLiveBoard(boardId, initial, true);
  const urls = useSlideUrls(b.supabase, b.pages);
  const [replay, setReplay] = useState<number | null>(null);

  const pageId = b.state.page_id ?? b.pages[0]?.id ?? null;
  const page = b.pages.find((p) => p.id === pageId) ?? null;
  const pageEvents = useMemo(() => b.events.filter((e) => e.page_id === pageId), [b.events, pageId]);
  const shown = useMemo(() => {
    if (!pageId) return [];
    return visibleEvents(replay === null ? b.events : pageEvents.slice(0, replay), pageId);
  }, [b.events, pageEvents, pageId, replay]);

  const prompt = b.prompts.find((p) => p.id === b.state.prompt_id && p.status === 'open') ?? null;
  const mine = prompt ? b.responses.find((r) => r.prompt_id === prompt.id && r.student_id === studentId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className={clsx('h-2.5 w-2.5 rounded-full', b.live ? 'bg-ok' : 'bg-gold')} aria-hidden="true" /> {b.live ? 'Live' : 'Updating every few seconds'}
        </span>
        {page && <span className="text-xs text-muted">Page {b.pages.indexOf(page) + 1} of {b.pages.length}</span>}
        <BoardTimer endsAt={b.state.timer_ends_at} />
        {pageEvents.length > 0 && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setReplay((r) => (r === null ? 0 : null))} aria-pressed={replay !== null}>
            <History size={16} aria-hidden="true" /> {replay === null ? 'Replay' : 'Back to live'}
          </Button>
        )}
      </div>

      {page ? (
        <BoardCanvas background={page.background} imageUrl={page.image_path ? urls[page.image_path] : null} events={shown as BoardEvent[]} label={`Class board, page ${b.pages.indexOf(page) + 1}`} />
      ) : <p className="card p-6 text-muted">Your tutor has not started the board yet. It will appear here by itself.</p>}

      {replay !== null && (
        <div className="card p-4">
          <label htmlFor="replay" className="label">Replay this page: step {replay} of {pageEvents.length}</label>
          <input id="replay" type="range" min={0} max={pageEvents.length} value={replay} onChange={(e) => setReplay(Number(e.target.value))} className="w-full" />
        </div>
      )}

      {b.state.spotlight && (
        <section className="tile bg-tile-sun" aria-label="Answer shown to the class">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Shown by your tutor</p>
          <p className="mt-1 font-semibold">{b.state.spotlight.name}’s answer</p>
          <div className="mt-2 max-w-md"><BoardCanvas background="blank" events={strokesToEvents(b.state.spotlight.strokes)} label={`${b.state.spotlight.name}'s answer`} /></div>
          {b.state.spotlight.text && <p className="mt-2">{b.state.spotlight.text}</p>}
        </section>
      )}

      {prompt && <AnswerBoard key={prompt.id} promptId={prompt.id} question={prompt.question} sent={Boolean(mine)} supabase={b.supabase} onSent={() => void b.refresh()} />}
    </div>
  );
}

function AnswerBoard({ promptId, question, sent, supabase, onSent }: { promptId: string; question: string; sent: boolean; supabase: ReturnType<typeof useLiveBoard>['supabase']; onSent: () => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(sent ? 'Answer sent. You can change it and send again until your tutor closes the question.' : '');

  const events = useMemo(() => strokesToEvents(draft ? [...strokes, draft] : strokes), [strokes, draft]);

  async function send() {
    if (!strokes.length && !text.trim()) return setMessage('Draw or write your answer first.');
    setPending(true);
    const { error } = await supabase.rpc('submit_board_response', { p_prompt: promptId, p_strokes: strokes, p_text: text.trim() || null });
    setPending(false);
    if (error) return setMessage(error.message.includes('closed') ? 'Your tutor has closed this question.' : 'Could not send. Check your connection and try again.');
    setMessage('Answer sent. You can change it and send again until your tutor closes the question.');
    onSent();
  }

  return (
    <section className="tile bg-tile-lilac" aria-label="Your answer board">
      <p className="text-xs font-bold uppercase tracking-wider">Answer on your board</p>
      <h2 className="mt-1 text-lg font-semibold">{question}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {COLORS.slice(0, 4).map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Colour ${c}`}
            className={clsx('tap h-8 w-8 rounded-full ring-offset-2', color === c && 'ring-2 ring-navy')} style={{ background: c }} />
        ))}
        <button type="button" onClick={() => setStrokes((s) => s.slice(0, -1))} aria-label="Undo" className="tap grid h-10 w-10 place-items-center rounded-xl bg-surface"><Undo2 size={18} /></button>
        <button type="button" onClick={() => setStrokes([])} aria-label="Clear my board" className="tap grid h-10 w-10 place-items-center rounded-xl bg-surface"><Eraser size={18} /></button>
      </div>
      <div className="mt-3 max-w-xl">
        <BoardCanvas
          background="blank"
          events={events}
          label="Your answer board"
          onDown={(p) => setDraft({ points: [p], color, width: WIDTHS[1] })}
          onMove={(p) => setDraft((d) => {
            if (!d) return d;
            const last = d.points[d.points.length - 1]!;
            return Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004 ? d : { ...d, points: [...d.points, p] };
          })}
          onUp={() => { setDraft((d) => { if (d) setStrokes((s) => [...s, d].slice(-200)); return null; }); }}
        />
      </div>
      <label htmlFor={`text-${promptId}`} className="label mt-3">Or type your answer (optional)</label>
      <input id={`text-${promptId}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} className="field max-w-xl" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={pending} onClick={() => void send()}><Send size={16} aria-hidden="true" /> {pending ? 'Sending…' : sent ? 'Send again' : 'Send answer'}</Button>
        <p role="status" className="text-sm font-medium">{message}</p>
      </div>
    </section>
  );
}
