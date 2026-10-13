import clsx from 'clsx';
import { Check } from 'lucide-react';

export type PollView = {
  id: string; question: string; options: string[]; status: string;
  my_choice: number | null; correct_index: number | null; counts: number[] | null; answers: number | null;
};

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
