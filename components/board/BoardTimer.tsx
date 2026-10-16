'use client';

import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Countdown to `endsAt`, shown to everyone on the board. Hides itself 30 seconds after it ends. */
export function BoardTimer({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.ceil((new Date(endsAt).getTime() - now) / 1000);
  if (left < -30) return null;
  const s = Math.max(0, left);
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <span
      role="timer"
      aria-label={s ? `${text} left` : 'Time is up'}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${s === 0 ? 'bg-bad text-white' : s <= 10 ? 'bg-accent text-white' : 'bg-tile-sun text-ink'}`}
    >
      <Timer size={16} aria-hidden="true" /> {s ? text : 'Time is up'}
    </span>
  );
}
