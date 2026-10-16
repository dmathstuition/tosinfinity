import clsx from 'clsx';
import { Check } from 'lucide-react';

export type PollView = {
  id: string; question: string; options: string[]; status: string;
  my_choice: number | null; correct_index: number | null; counts: number[] | null; answers: number | null;
  created_at?: string; time_limit_seconds?: number | null; points?: boolean;
};

/** When a timed quick check stops accepting answers, or null if it has no time limit. */
export function pollDeadline(p: PollView): string | null {
  if (!p.time_limit_seconds || !p.created_at) return null;
  return new Date(new Date(p.created_at).getTime() + p.time_limit_seconds * 1000).toISOString();
}

export type LeaderRow = { rank: number; display_name: string; points: number; is_me: boolean };

/**
 * Points table for quick checks the tutor ran with points on. First names and an
 * initial only, top ten, and the viewer's own row is highlighted.
 */
export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted">Points appear here once a quick check with points has closed.</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className={clsx('flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm', r.is_me ? 'bg-navy text-white' : 'bg-surface/80')}>
          <span className="flex items-center gap-2.5 font-medium">
            <span className={clsx('grid h-7 w-7 place-items-center rounded-full text-xs font-bold', r.rank === 1 ? 'bg-tile-sun text-ink' : r.is_me ? 'bg-white/20' : 'bg-sunken')}>{r.rank}</span>
            {r.display_name}{r.is_me && <span className="sr-only"> (you)</span>}
          </span>
          <span className="tabular-nums font-semibold">{r.points.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Result bars for a quick check. Used by the tutor (always) and by learners once the
 * check is closed. Totals are anonymous: nobody's individual choice is shown except
 * the viewer's own.
 */
export function PollResults({ poll }: { poll: PollView }) {
  const total = poll.answers ?? 0;
  return (
    <ul className="space-y-2">
      {poll.options.map((option, i) => {
        const n = poll.counts?.[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const correct = poll.correct_index === i;
        const mine = poll.my_choice === i;
        return (
          <li key={i} className="relative overflow-hidden rounded-xl bg-surface/80 px-3 py-2.5">
            <div aria-hidden="true" className={clsx('absolute inset-y-0 left-0 rounded-xl', correct ? 'bg-ok/25' : 'bg-royal/15')} style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {correct && <Check size={16} className="shrink-0 text-ok" aria-hidden="true" />}
                <span>{option}</span>
                {correct && <span className="sr-only">(correct answer)</span>}
                {mine && <span className="shrink-0 rounded-full bg-navy px-2 py-0.5 text-[0.65rem] font-bold text-white">Your answer</span>}
              </span>
              <span className="shrink-0 tabular-nums text-ink/70">{n} · {pct}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
