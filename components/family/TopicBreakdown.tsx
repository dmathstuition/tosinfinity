import clsx from 'clsx';
import { createClient } from '@/lib/supabase/server';

type Row = { topic: string; correct: number; total: number };

/**
 * Quiz result topic by topic (for placement and aptitude tests). Shown only when the
 * tutor tagged questions with topics. RLS in get_topic_breakdown limits it to the
 * learner, their verified parents and the Owner.
 */
export async function TopicBreakdown({ submissionId }: { submissionId: string }) {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_topic_breakdown', { p_submission: submissionId });
  const rows = (data ?? []) as Row[];
  if (!rows.length || (rows.length === 1 && rows[0]!.topic === 'General')) return null;
  return (
    <div className="mt-3 rounded-xl bg-sunken p-3">
      <h3 className="mb-2 text-sm font-semibold">By topic</h3>
      <ul className="space-y-2">
        {rows.map((r) => {
          const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
          const label = pct >= 80 ? 'Strong' : pct >= 50 ? 'Developing' : 'Needs work';
          return (
            <li key={r.topic} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{r.topic}</span>
                <span className="tabular-nums text-ink/70">{r.correct}/{r.total} · {label}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                <div className={clsx('h-full rounded-full', pct >= 80 ? 'bg-ok' : pct >= 50 ? 'bg-gold' : 'bg-flame')} style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
