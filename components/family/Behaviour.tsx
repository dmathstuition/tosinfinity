import { Award, AlertCircle } from 'lucide-react';
import { LocalTime } from '@/components/portal/LocalTime';
import { behaviourBalance, type BehaviourNote } from '@/lib/behaviour';
import { createClient } from '@/lib/supabase/server';

/** Merits and concerns recorded by the tutor. RLS limits rows to the learner and their verified parents. */
export async function BehaviourList({ studentId, limit = 20, self = false }: { studentId: string; limit?: number; self?: boolean }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('behaviour_notes')
    .select('id, kind, category, note, points, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const notes = (data ?? []) as BehaviourNote[];
  if (!notes.length) return <p className="text-sm text-muted">{self ? 'Merits from your tutor will appear here.' : 'No merits or concerns have been recorded yet.'}</p>;
  const { merits, concerns } = behaviourBalance(notes);
  return (
    <>
      <p className="mb-3 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-full bg-tile-mint px-3 py-1">{merits} merit points</span>
        {concerns > 0 && <span className="rounded-full bg-tile-peach px-3 py-1">{concerns} concern points</span>}
      </p>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className={`flex items-start gap-3 rounded-2xl p-3 text-sm ${n.kind === 'merit' ? 'bg-tile-mint' : 'bg-tile-peach'}`}>
            {n.kind === 'merit'
              ? <Award size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              : <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0">
              <span className="font-semibold">{n.category}</span> <span className="text-ink/70">({n.kind === 'merit' ? '+' : '−'}{n.points})</span>
              {n.note && <span className="block text-ink/80">{n.note}</span>}
              <span className="block text-xs text-ink/60"><LocalTime iso={n.created_at} format="date" /></span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
