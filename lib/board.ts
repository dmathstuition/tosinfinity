/**
 * Class board: event model and canvas rendering, shared by the Owner's board, the
 * learner's live view, answer boards and replay. Coordinates are fractions of the
 * page (0..1) so the same board looks right on a projector and on a cheap phone.
 * Pages are 16:10.
 */
export const PAGE_RATIO = 10 / 16;

export type Pt = [number, number];
export type Kind = 'pen' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'protractor' | 'fraction' | 'erase' | 'clear';
export type Background = 'blank' | 'grid' | 'lined' | 'axes' | 'numberline' | 'image';

export type StrokeData = { points: Pt[]; color: string; width: number };
export type ShapeData = { from: Pt; to: Pt; color: string; width: number };
export type TextData = { at: Pt; text: string; color: string; size: number };
export type ProtractorData = { at: Pt; r: number };
export type FractionData = { at: Pt; w: number; parts: number; shaded: number; color: string };
export type EraseData = { ids: number[] };

export type BoardEvent = { id: number; page_id: string; kind: Kind; data: Record<string, unknown> };
export type BoardPage = { id: string; position: number; background: Background; image_path: string | null };

export const COLORS = ['#0f1b3d', '#d64545', '#1f6feb', '#1a7f37', '#e07b00', '#7c3aed'] as const;
export const WIDTHS = [0.003, 0.006, 0.012] as const;

const MAX_POINTS = 2000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/**
 * The events still visible on a page, in drawing order: a "clear" wipes everything
 * before it, an "erase" removes the listed events.
 */
export function visibleEvents(events: BoardEvent[], pageId: string): BoardEvent[] {
  let out: BoardEvent[] = [];
  for (const e of [...events].sort((a, b) => a.id - b.id)) {
    if (e.page_id !== pageId) continue;
    if (e.kind === 'clear') out = [];
    else if (e.kind === 'erase') {
      const ids = new Set(((e.data as EraseData).ids ?? []).filter((n) => typeof n === 'number'));
      out = out.filter((x) => !ids.has(x.id));
    } else out.push(e);
  }
  return out;
}

/** Validates and normalises event data before it is saved; returns null if unusable. */
export function sanitiseEvent(kind: Kind, data: Record<string, unknown>): Record<string, unknown> | null {
  const color = isColor(data.color) ? data.color : COLORS[0];
  const width = typeof data.width === 'number' ? Math.min(0.05, Math.max(0.001, data.width)) : WIDTHS[1];
  switch (kind) {
    case 'pen':
    case 'highlighter': {
      const pts = Array.isArray(data.points) ? data.points.filter(isPt).slice(0, MAX_POINTS) : [];
      if (!pts.length) return null;
      return { points: pts.map(([x, y]) => [round(clamp01(x)), round(clamp01(y))]), color, width };
    }
    case 'line':
    case 'arrow':
    case 'rect':
    case 'circle':
      if (!isPt(data.from) || !isPt(data.to)) return null;
      return { from: data.from.map((n) => round(clamp01(n))), to: data.to.map((n) => round(clamp01(n))), color, width };
    case 'text': {
      const text = typeof data.text === 'string' ? data.text.trim().slice(0, 300) : '';
      if (!text || !isPt(data.at)) return null;
      const size = typeof data.size === 'number' ? Math.min(0.12, Math.max(0.015, data.size)) : 0.035;
      return { at: data.at.map((n) => round(clamp01(n))), text, color, size };
    }
    case 'protractor':
      if (!isPt(data.at)) return null;
      return { at: data.at.map((n) => round(clamp01(n))), r: typeof data.r === 'number' ? Math.min(0.5, Math.max(0.05, data.r)) : 0.2 };
    case 'fraction': {
      if (!isPt(data.at)) return null;
      const parts = Math.round(Number(data.parts));
      const shaded = Math.round(Number(data.shaded));
      if (!(parts >= 1 && parts <= 24) || !(shaded >= 0 && shaded <= parts)) return null;
      return { at: data.at.map((n) => round(clamp01(n))), w: typeof data.w === 'number' ? Math.min(0.9, Math.max(0.1, data.w)) : 0.5, parts, shaded, color };
    }
    case 'erase': {
      const ids = Array.isArray(data.ids) ? data.ids.filter((n): n is number => Number.isInteger(n)).slice(0, 500) : [];
      return ids.length ? { ids } : null;
    }
    case 'clear':
      return {};
    default:
      return null;
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Distance from point p to segment ab, in page units. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** The topmost visible event under point p (for the eraser), or null. */
export function hitTest(events: BoardEvent[], p: Pt, tolerance = 0.015): BoardEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    const d = e.data as Record<string, unknown>;
    if (e.kind === 'pen' || e.kind === 'highlighter') {
      const pts = (d.points as Pt[]) ?? [];
      if (pts.length === 1 && Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]) < tolerance) return e;
      for (let j = 1; j < pts.length; j++) if (segDist(p, pts[j - 1]!, pts[j]!) < tolerance) return e;
    } else if (e.kind === 'line' || e.kind === 'arrow') {
      if (segDist(p, d.from as Pt, d.to as Pt) < tolerance) return e;
    } else if (e.kind === 'rect' || e.kind === 'circle' || e.kind === 'fraction' || e.kind === 'protractor' || e.kind === 'text') {
      const [x0, y0, x1, y1] = bounds(e);
      if (p[0] >= x0 - tolerance && p[0] <= x1 + tolerance && p[1] >= y0 - tolerance && p[1] <= y1 + tolerance) return e;
    }
  }
  return null;
}

function bounds(e: BoardEvent): [number, number, number, number] {
  const d = e.data as Record<string, unknown>;
  if (e.kind === 'rect' || e.kind === 'circle') {
    const [a, b] = [d.from as Pt, d.to as Pt];
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }
  if (e.kind === 'protractor') {
    const { at, r } = d as unknown as ProtractorData;
    return [at[0] - r, at[1] - r / PAGE_RATIO, at[0] + r, at[1]];
  }
  if (e.kind === 'fraction') {
    const { at, w } = d as unknown as FractionData;
    return [at[0], at[1], at[0] + w, at[1] + 0.08];
  }
  const { at, text, size } = d as unknown as TextData;
  return [at[0], at[1] - size / PAGE_RATIO, at[0] + text.length * size * 0.55, at[1] + 0.01];
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background, image?: HTMLImageElement | null) {
  ctx.save();
  try {
    paintBackground(ctx, w, h, bg, image);
  } finally {
    ctx.restore();
  }
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background, image?: HTMLImageElement | null) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (bg === 'image' && image && image.complete && image.naturalWidth) {
    const s = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const iw = image.naturalWidth * s;
    const ih = image.naturalHeight * s;
    ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    return;
  }
  const step = w / 32;
  ctx.lineWidth = 1;
  if (bg === 'grid' || bg === 'axes') {
    ctx.strokeStyle = '#dfe5f0';
    ctx.beginPath();
    for (let x = step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  if (bg === 'lined') {
    ctx.strokeStyle = '#cfdcf2';
    ctx.beginPath();
    for (let y = step * 1.6; y < h; y += step * 1.6) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.strokeStyle = '#f0b4b4';
    ctx.beginPath(); ctx.moveTo(step * 2.5, 0); ctx.lineTo(step * 2.5, h); ctx.stroke();
  }
  if (bg === 'axes') {
    const cx = Math.round(w / 2 / step) * step;
    const cy = Math.round(h / 2 / step) * step;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = `${Math.max(9, step * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let i = -15; i <= 15; i++) {
      const x = cx + i * step;
      if (i !== 0 && x > 0 && x < w && i % 2 === 0) ctx.fillText(String(i), x, cy + step * 0.6);
    }
    ctx.textAlign = 'right';
    for (let i = -9; i <= 9; i++) {
      const y = cy - i * step;
      if (i !== 0 && y > 0 && y < h && i % 2 === 0) ctx.fillText(String(i), cx - step * 0.2, y + step * 0.15);
    }
  }
  if (bg === 'numberline') {
    const y = h / 2;
    const left = w * 0.05;
    const unit = (w * 0.9) / 20;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left - unit * 0.5, y); ctx.lineTo(left + unit * 20.5, y); ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = `${Math.max(10, unit * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let i = 0; i <= 20; i++) {
      const x = left + i * unit;
      ctx.beginPath(); ctx.moveTo(x, y - unit * 0.25); ctx.lineTo(x, y + unit * 0.25); ctx.stroke();
      ctx.fillText(String(i - 10), x, y + unit * 0.8);
    }
  }
}

export function drawEvent(ctx: CanvasRenderingContext2D, e: Pick<BoardEvent, 'kind' | 'data'>, w: number, h: number) {
  const d = e.data as Record<string, unknown>;
  const X = (n: number) => n * w;
  const Y = (n: number) => n * h;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const color = (d.color as string) ?? COLORS[0];
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, ((d.width as number) ?? WIDTHS[1]) * w);
  switch (e.kind) {
    case 'pen':
    case 'highlighter': {
      const pts = (d.points as Pt[]) ?? [];
      if (e.kind === 'highlighter') { ctx.globalAlpha = 0.35; ctx.lineWidth *= 4; }
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      if (pts.length === 1) ctx.lineTo(X(pts[0]![0]) + 0.1, Y(pts[0]![1]));
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      const [a, b] = [d.from as Pt, d.to as Pt];
      ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke();
      if (e.kind === 'arrow') {
        const ang = Math.atan2(Y(b[1]) - Y(a[1]), X(b[0]) - X(a[0]));
        const len = Math.max(10, ctx.lineWidth * 4);
        ctx.beginPath();
        ctx.moveTo(X(b[0]), Y(b[1]));
        ctx.lineTo(X(b[0]) - len * Math.cos(ang - 0.45), Y(b[1]) - len * Math.sin(ang - 0.45));
        ctx.moveTo(X(b[0]), Y(b[1]));
        ctx.lineTo(X(b[0]) - len * Math.cos(ang + 0.45), Y(b[1]) - len * Math.sin(ang + 0.45));
        ctx.stroke();
      }
      break;
    }
    case 'rect': {
      const [a, b] = [d.from as Pt, d.to as Pt];
      ctx.strokeRect(X(Math.min(a[0], b[0])), Y(Math.min(a[1], b[1])), Math.abs(X(b[0]) - X(a[0])), Math.abs(Y(b[1]) - Y(a[1])));
      break;
    }
    case 'circle': {
      const [a, b] = [d.from as Pt, d.to as Pt];
      ctx.beginPath();
      ctx.ellipse((X(a[0]) + X(b[0])) / 2, (Y(a[1]) + Y(b[1])) / 2, Math.abs(X(b[0]) - X(a[0])) / 2, Math.abs(Y(b[1]) - Y(a[1])) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      const { at, text, size } = d as unknown as TextData;
      ctx.font = `600 ${Math.max(10, size * w)}px system-ui, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillText(text, X(at[0]), Y(at[1]));
      break;
    }
    case 'protractor': {
      const { at, r } = d as unknown as ProtractorData;
      const cx = X(at[0]);
      const cy = Y(at[1]);
      const R = r * w;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(31,111,235,0.08)';
      ctx.strokeStyle = '#1f6feb';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f6feb';
      ctx.font = `${Math.max(8, R * 0.07)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (let deg = 0; deg <= 180; deg += 5) {
        const a = Math.PI + (deg * Math.PI) / 180;
        const inner = deg % 10 === 0 ? R * 0.9 : R * 0.95;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
        if (deg % 30 === 0) ctx.fillText(String(deg), cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8 + 3);
      }
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fraction': {
      const { at, w: fw, parts, shaded } = d as unknown as FractionData;
      const x0 = X(at[0]);
      const y0 = Y(at[1]);
      const bw = fw * w;
      const bh = 0.08 * h;
      const cell = bw / parts;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x0, y0, cell * shaded, bh);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y0, bw, bh);
      for (let i = 1; i < parts; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + bh); ctx.stroke(); }
      ctx.font = `600 ${Math.max(10, bh * 0.45)}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`${shaded}/${parts}`, x0 + bw + 8, y0 + bh / 2);
      break;
    }
  }
  ctx.restore();
}

/** Draw a whole page: background, then each visible event in order. */
export function renderPage(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Background, events: Pick<BoardEvent, 'kind' | 'data'>[], image?: HTMLImageElement | null) {
  drawBackground(ctx, w, h, bg, image);
  for (const e of events) drawEvent(ctx, e, w, h);
}

/** Answer-board strokes (an array of pen strokes) drawn as events. */
export function strokesToEvents(strokes: unknown): Pick<BoardEvent, 'kind' | 'data'>[] {
  if (!Array.isArray(strokes)) return [];
  return strokes
    .map((s) => sanitiseEvent('pen', (s ?? {}) as Record<string, unknown>))
    .filter((d): d is Record<string, unknown> => d !== null)
    .map((data) => ({ kind: 'pen' as const, data }));
}

/** First name and initial, as shown to the class. */
export function shortName(full: string): string {
  const [first = 'Learner', second] = full.trim().split(/\s+/);
  return second ? `${first} ${second[0]}.` : first;
}
