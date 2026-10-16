'use client';

import { useState } from 'react';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardTimer } from '@/components/board/BoardTimer';
import { type Background, type BoardEvent, type Pt, visibleEvents } from '@/lib/board';

const SAMPLE: BoardEvent[] = [
  { id: 1, page_id: 'p', kind: 'text', data: { at: [0.05, 0.1], text: 'Fractions: 3/4 of a bar', color: '#0f1b3d', size: 0.04 } },
  { id: 2, page_id: 'p', kind: 'fraction', data: { at: [0.05, 0.16], w: 0.5, parts: 4, shaded: 3, color: '#1f6feb' } },
  { id: 3, page_id: 'p', kind: 'protractor', data: { at: [0.75, 0.6], r: 0.18 } },
  { id: 4, page_id: 'p', kind: 'arrow', data: { from: [0.1, 0.5], to: [0.4, 0.38], color: '#d64545', width: 0.006 } },
  { id: 5, page_id: 'p', kind: 'rect', data: { from: [0.1, 0.6], to: [0.3, 0.8], color: '#1a7f37', width: 0.006 } },
  { id: 6, page_id: 'p', kind: 'circle', data: { from: [0.35, 0.6], to: [0.5, 0.8], color: '#7c3aed', width: 0.006 } },
  { id: 7, page_id: 'p', kind: 'highlighter', data: { points: [[0.05, 0.11], [0.45, 0.11]], color: '#e07b00', width: 0.006 } },
  { id: 8, page_id: 'p', kind: 'pen', data: { points: [[0.55, 0.2], [0.6, 0.3], [0.65, 0.2], [0.7, 0.3]], color: '#0f1b3d', width: 0.006 } },
];

export function BoardPreview() {
  const [bg, setBg] = useState<Background>('grid');
  const [mine, setMine] = useState<BoardEvent[]>([]);
  const [draft, setDraft] = useState<BoardEvent | null>(null);
  const [ends] = useState(() => new Date(Date.now() + 90_000).toISOString());
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['blank', 'grid', 'lined', 'axes', 'numberline'] as Background[]).map((b) => (
          <button key={b} type="button" onClick={() => setBg(b)} className={`rounded-xl px-3 py-2 text-sm ${bg === b ? 'bg-navy text-white' : 'bg-sunken'}`}>{b}</button>
        ))}
        <BoardTimer endsAt={ends} />
      </div>
      <BoardCanvas
        background={bg}
        events={visibleEvents([...SAMPLE, ...mine], 'p')}
        draft={draft}
        label="Sample board (draw with the mouse or a finger)"
        className="max-w-4xl"
        onDown={(p) => setDraft({ id: 0, page_id: 'p', kind: 'pen', data: { points: [p], color: '#d64545', width: 0.006 } })}
        onMove={(p) => setDraft((d) => (d ? { ...d, data: { ...d.data, points: [...(d.data.points as Pt[]), p] } } : d))}
        onUp={() => { if (draft) setMine((m) => [...m, { ...draft, id: 100 + m.length }]); setDraft(null); }}
      />
    </div>
  );
}
