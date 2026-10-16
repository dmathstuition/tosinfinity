'use client';

import { useEffect, useRef, useState } from 'react';
import { type Background, type BoardEvent, PAGE_RATIO, type Pt, renderPage } from '@/lib/board';

type Props = {
  background: Background;
  imageUrl?: string | null;
  events: Pick<BoardEvent, 'kind' | 'data'>[];
  /** The shape being drawn right now (not yet saved). */
  draft?: Pick<BoardEvent, 'kind' | 'data'> | null;
  label: string;
  className?: string;
  onDown?: (p: Pt) => void;
  onMove?: (p: Pt) => void;
  onUp?: (p: Pt) => void;
};

/** A 16:10 board page. Pointer handlers receive positions as fractions of the page. */
export function BoardCanvas({ background, imageUrl, events, draft, label, className, onDown, onMove, onUp }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSize({ w, h: Math.round(w * PAGE_RATIO) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!imageUrl) return setImage(null);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderPage(ctx, size.w, size.h, background, draft ? [...events, draft] : events, image);
  }, [size, background, events, draft, image]);

  const at = (e: React.PointerEvent): Pt => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const interactive = Boolean(onDown);

  return (
    <div ref={wrap} className={className}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        style={{ width: size.w, height: size.h, touchAction: interactive ? 'none' : 'auto' }}
        className="block rounded-2xl bg-white shadow-card ring-1 ring-line"
        onPointerDown={interactive ? (e) => { drawing.current = true; canvas.current?.setPointerCapture(e.pointerId); onDown?.(at(e)); } : undefined}
        onPointerMove={interactive ? (e) => { if (drawing.current) onMove?.(at(e)); } : undefined}
        onPointerUp={interactive ? (e) => { if (!drawing.current) return; drawing.current = false; onUp?.(at(e)); } : undefined}
        onPointerCancel={interactive ? (e) => { if (!drawing.current) return; drawing.current = false; onUp?.(at(e)); } : undefined}
      />
    </div>
  );
}
