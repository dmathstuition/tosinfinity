'use client';

import clsx from 'clsx';
import {
  ArrowUpRight, Circle, Dices, Eraser, Highlighter, ImagePlus, Minus, PenLine, Plus, Presentation, Ruler, Square, Trash2, Type, Undo2,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  type Background, type BoardEvent, COLORS, hitTest, type Kind, type Pt, sanitiseEvent, shortName, strokesToEvents, visibleEvents, WIDTHS,
} from '@/lib/board';
import { BoardCanvas } from './BoardCanvas';
import { BoardTimer } from './BoardTimer';
import { type LiveInitial, useLiveBoard, useSlideUrls } from './useLiveBoard';

type Tool = 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'protractor' | 'fraction' | 'eraser';
const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'pen', label: 'Pen', icon: <PenLine size={18} /> },
  { id: 'highlighter', label: 'Highlighter', icon: <Highlighter size={18} /> },
  { id: 'line', label: 'Line', icon: <Minus size={18} /> },
  { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight size={18} /> },
  { id: 'rect', label: 'Rectangle', icon: <Square size={18} /> },
  { id: 'circle', label: 'Circle', icon: <Circle size={18} /> },
  { id: 'text', label: 'Text', icon: <Type size={18} /> },
  { id: 'protractor', label: 'Protractor', icon: <Ruler size={18} /> },
  { id: 'fraction', label: 'Fraction bar', icon: <span className="text-xs font-bold">½</span> },
  { id: 'eraser', label: 'Eraser (tap a mark)', icon: <Eraser size={18} /> },
];
const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: 'blank', label: 'Blank' }, { id: 'grid', label: 'Squared' }, { id: 'lined', label: 'Lined' },
  { id: 'axes', label: 'Graph axes' }, { id: 'numberline', label: 'Number line' },
];
const SLIDE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type Member = { id: string; name: string };

/**
 * The Owner's board. Everything drawn is saved as it happens and appears on every
 * learner's screen in the class. The page shown here is the page learners see.
 */
export function OwnerBoard({ boardId, members, initial }: { boardId: string; members: Member[]; initial: LiveInitial }) {
  const b = useLiveBoard(boardId, initial, true);
  const { supabase } = b;
  const urls = useSlideUrls(supabase, b.pages);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(WIDTHS[1]);
  const [draft, setDraft] = useState<Pick<BoardEvent, 'kind' | 'data'> | null>(null);
  const [bg, setBg] = useState<Background>('grid');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const start = useRef<Pt | null>(null);
  const mine = useRef<number[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const pageId = b.state.page_id ?? b.pages[0]?.id ?? null;
  const page = b.pages.find((p) => p.id === pageId) ?? null;
  const pageIndex = page ? b.pages.indexOf(page) : -1;
  const visible = useMemo(() => (pageId ? visibleEvents(b.events, pageId) : []), [b.events, pageId]);
  const prompt = b.prompts.find((p) => p.id === b.state.prompt_id && p.status === 'open') ?? null;
  const answers = prompt ? b.responses.filter((r) => r.prompt_id === prompt.id) : [];

  const fail = (m: string) => { setError(m); setTimeout(() => setError(''), 5000); };

  async function save(kind: Kind, data: Record<string, unknown>) {
    if (!pageId) return;
    const clean = sanitiseEvent(kind, data);
    if (!clean) return;
    const { data: row, error: e } = await supabase.from('board_events').insert({ board_id: boardId, page_id: pageId, kind, data: clean }).select('id, page_id, kind, data').single();
    if (e || !row) return fail('Could not save that. Check your connection.');
    if (kind !== 'erase' && kind !== 'clear') mine.current.push(row.id as number);
    b.mergeEvents([row as BoardEvent]);
  }

  async function setStateFields(fields: Record<string, unknown>) {
    b.setState((s) => ({ ...s, ...fields }));
    const { error: e } = await supabase.from('board_state').upsert({ board_id: boardId, ...fields, updated_at: new Date().toISOString() });
    if (e) fail('Could not update the class screen.');
  }

  // Drawing ------------------------------------------------------------------
  const onDown = (p: Pt) => {
    if (tool === 'eraser') {
      const hit = hitTest(visible, p);
      if (hit) void save('erase', { ids: [hit.id] });
      return;
    }
    if (tool === 'text') {
      const text = window.prompt('Text to write on the board');
      if (text?.trim()) void save('text', { at: p, text, color, size: width >= WIDTHS[2] ? 0.06 : width <= WIDTHS[0] ? 0.025 : 0.04 });
      return;
    }
    if (tool === 'protractor') return void save('protractor', { at: p, r: 0.22 });
    if (tool === 'fraction') {
      const v = window.prompt('Fraction to show, e.g. 3/4', '1/2');
      const m = v?.match(/^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/);
      if (m) void save('fraction', { at: p, w: 0.5, parts: Number(m[2]), shaded: Number(m[1]), color });
      else if (v) fail('Write the fraction like 3/4 (up to 24 parts).');
      return;
    }
    start.current = p;
    setDraft(tool === 'pen' || tool === 'highlighter' ? { kind: tool, data: { points: [p], color, width } } : { kind: tool, data: { from: p, to: p, color, width } });
  };
  const onMove = (p: Pt) => {
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === 'pen' || d.kind === 'highlighter') {
        const pts = (d.data.points as Pt[]);
        const last = pts[pts.length - 1]!;
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return d;
        return { ...d, data: { ...d.data, points: [...pts, p] } };
      }
      return { ...d, data: { ...d.data, to: p } };
    });
  };
  const onUp = () => {
    if (draft) void save(draft.kind, draft.data);
    setDraft(null);
    start.current = null;
  };

  const undo = () => {
    const visibleIds = new Set(visible.map((e) => e.id));
    for (let i = mine.current.length - 1; i >= 0; i--) {
      const id = mine.current[i]!;
      mine.current.splice(i, 1);
      if (visibleIds.has(id)) return void save('erase', { ids: [id] });
    }
  };

  // Pages --------------------------------------------------------------------
  async function addPage(background: Background, imagePath: string | null = null, id?: string) {
    const position = (b.pages.at(-1)?.position ?? 0) + 1;
    const { data: row, error: e } = await supabase.from('board_pages').insert({ ...(id ? { id } : {}), board_id: boardId, position, background, image_path: imagePath }).select('id, position, background, image_path').single();
    if (e || !row) return fail('Could not add the page.');
    b.setPages((ps) => [...ps, row as typeof ps[number]]);
    await setStateFields({ page_id: row.id });
  }

  async function uploadSlides(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 40)) {
        if (!SLIDE_TYPES.includes(file.type)) { fail(`${file.name}: use PNG, JPG or WebP images.`); continue; }
        if (file.size > 5 * 1024 * 1024) { fail(`${file.name} is larger than 5 MB.`); continue; }
        const id = crypto.randomUUID();
        const path = `${boardId}/${id}.${file.type.split('/')[1]}`;
        const { error: e } = await supabase.storage.from('boards').upload(path, file, { contentType: file.type, upsert: false });
        if (e) { fail(`Could not upload ${file.name}.`); continue; }
        await addPage('image', path, id);
      }
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  // Answer boards --------------------------------------------------------------
  async function ask() {
    const q = question.trim();
    if (!q) return fail('Write the question first.');
    if (prompt) await supabase.from('board_prompts').update({ status: 'closed' }).eq('id', prompt.id);
    const { data: row, error: e } = await supabase.from('board_prompts').insert({ board_id: boardId, question: q.slice(0, 500) }).select('id, question, status, created_at').single();
    if (e || !row) return fail('Could not send the question.');
    b.setPrompts((ps) => [...ps.map((p) => ({ ...p, status: 'closed' as const })), row as typeof ps[number]]);
    setQuestion('');
    await setStateFields({ prompt_id: row.id, spotlight: null });
  }
  async function closePrompt() {
    if (!prompt) return;
    await supabase.from('board_prompts').update({ status: 'closed' }).eq('id', prompt.id);
    b.setPrompts((ps) => ps.map((p) => (p.id === prompt.id ? { ...p, status: 'closed' as const } : p)));
    await setStateFields({ prompt_id: null });
  }

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Learner';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card flex flex-wrap items-center gap-2 p-3" role="toolbar" aria-label="Board tools">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTool(t.id)} aria-pressed={tool === t.id} title={t.label} aria-label={t.label}
            className={clsx('tap grid h-10 w-10 place-items-center rounded-xl', tool === t.id ? 'bg-navy text-white' : 'bg-sunken hover:bg-tile-sky')}>
            {t.icon}
          </button>
        ))}
        <span className="mx-1 h-8 w-px bg-line" aria-hidden="true" />
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Colour ${c}`}
            className={clsx('tap h-8 w-8 rounded-full ring-offset-2', color === c && 'ring-2 ring-navy')} style={{ background: c }} />
        ))}
        <span className="mx-1 h-8 w-px bg-line" aria-hidden="true" />
        {WIDTHS.map((w, i) => (
          <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} aria-label={['Thin', 'Medium', 'Thick'][i]}
            className={clsx('tap grid h-10 w-10 place-items-center rounded-xl', width === w ? 'bg-navy text-white' : 'bg-sunken')}>
            <span className="rounded-full bg-current" style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
          </button>
        ))}
        <span className="mx-1 h-8 w-px bg-line" aria-hidden="true" />
        <button type="button" onClick={undo} aria-label="Undo" title="Undo" className="tap grid h-10 w-10 place-items-center rounded-xl bg-sunken"><Undo2 size={18} /></button>
        <button type="button" onClick={() => { if (window.confirm('Clear this page for everyone?')) void save('clear', {}); }} aria-label="Clear page" title="Clear page" className="tap grid h-10 w-10 place-items-center rounded-xl bg-sunken"><Trash2 size={18} /></button>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className={clsx('h-2.5 w-2.5 rounded-full', b.live ? 'bg-ok' : 'bg-gold')} aria-hidden="true" /> {b.live ? 'Live' : 'Syncing every few seconds'}
        </span>
      </div>
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          {page ? (
            <div className="relative">
              <BoardCanvas
                background={page.background}
                imageUrl={page.image_path ? urls[page.image_path] : null}
                events={visible}
                draft={draft}
                label={`Board page ${pageIndex + 1}`}
                onDown={onDown}
                onMove={onMove}
                onUp={onUp}
              />
              <div className="pointer-events-none absolute right-3 top-3"><BoardTimer endsAt={b.state.timer_ends_at} /></div>
              {picked && (
                <button type="button" onClick={() => setPicked(null)} className="absolute inset-x-0 top-1/3 mx-auto w-fit rounded-3xl bg-navy px-8 py-5 text-3xl font-bold text-white shadow-float">
                  {picked}
                </button>
              )}
            </div>
          ) : <p className="card p-6 text-muted">Add a page to start.</p>}

          {/* Pages */}
          <div className="card flex flex-wrap items-center gap-2 p-3" aria-label="Pages">
            {b.pages.map((p, i) => (
              <button key={p.id} type="button" onClick={() => void setStateFields({ page_id: p.id })} aria-current={p.id === pageId ? 'page' : undefined}
                className={clsx('tap h-10 min-w-10 rounded-xl px-3 text-sm font-semibold', p.id === pageId ? 'bg-navy text-white' : 'bg-sunken')}>
                {i + 1}{p.background === 'image' ? ' 🖼' : ''}
              </button>
            ))}
            <span className="mx-1 h-8 w-px bg-line" aria-hidden="true" />
            <label className="sr-only" htmlFor="new_bg">Background for a new page</label>
            <select id="new_bg" value={bg} onChange={(e) => setBg(e.target.value as Background)} className="field h-10 w-auto py-1 text-sm">
              {BACKGROUNDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline" onClick={() => void addPage(bg)}><Plus size={16} aria-hidden="true" /> Page</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={16} aria-hidden="true" /> {busy ? 'Uploading…' : 'Slides'}</Button>
            <input ref={fileInput} type="file" accept={SLIDE_TYPES.join(',')} multiple className="hidden" onChange={(e) => void uploadSlides(e.target.files)} />
          </div>
          <p className="text-xs text-muted">Slides: export your PowerPoint or PDF pages as images (PowerPoint: File → Export → PNG) and upload them together; each image becomes a page you can write on.</p>
        </div>

        <aside className="space-y-4" aria-label="Class tools">
          {/* Answer boards */}
          <section className="tile bg-tile-lilac">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Presentation size={18} aria-hidden="true" /> Answer boards</h2>
            <p className="mt-1 text-sm text-ink/75">Ask a question; every learner answers on their own mini board and you see them all here.</p>
            <div className="mt-3 flex gap-2">
              <label htmlFor="ask" className="sr-only">Question for answer boards</label>
              <input id="ask" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="e.g. Draw 3/4 of a rectangle" className="field" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void ask(); } }} />
              <Button type="button" size="sm" onClick={() => void ask()}>Ask</Button>
            </div>
            {prompt && (
              <div className="mt-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{prompt.question}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void closePrompt()}>Close</Button>
                </div>
                <p className="mt-1 text-xs text-ink/70">{answers.length} of {members.length} answered</p>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {answers.map((r) => {
                    const name = nameOf(r.student_id);
                    const shown = b.state.spotlight?.name === shortName(name);
                    return (
                      <li key={r.id} className={clsx('rounded-xl bg-surface p-1.5', shown && 'ring-2 ring-accent')}>
                        <BoardCanvas background="blank" events={strokesToEvents(r.strokes)} label={`${name}'s answer`} />
                        <p className="mt-1 truncate px-1 text-xs font-semibold">{name}</p>
                        {r.text_answer && <p className="px-1 text-xs">{r.text_answer}</p>}
                        <button type="button" className="mt-1 w-full rounded-lg bg-sunken px-2 py-1 text-xs font-semibold"
                          onClick={() => void setStateFields({ spotlight: shown ? null : { name: shortName(name), strokes: r.strokes, text: r.text_answer } })}>
                          {shown ? 'Hide from class' : 'Show to class'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {/* Timer and name picker */}
          <section className="card p-4">
            <h2 className="text-base font-semibold">Timer</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {[30, 60, 120, 300].map((s) => (
                <Button key={s} type="button" size="sm" variant="outline" onClick={() => void setStateFields({ timer_ends_at: new Date(Date.now() + s * 1000).toISOString() })}>
                  {s < 60 ? `${s}s` : `${s / 60} min`}
                </Button>
              ))}
              {b.state.timer_ends_at && <Button type="button" size="sm" variant="ghost" onClick={() => void setStateFields({ timer_ends_at: null })}>Stop</Button>}
            </div>
            <h2 className="mt-4 text-base font-semibold">Pick a learner</h2>
            <p className="text-xs text-muted">Shown on your screen only.</p>
            <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={!members.length}
              onClick={() => setPicked(members[Math.floor(Math.random() * members.length)]?.name ?? null)}>
              <Dices size={16} aria-hidden="true" /> Random name
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
