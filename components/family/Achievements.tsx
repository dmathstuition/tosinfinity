import { Award, Flame } from 'lucide-react';
import { one } from '@/lib/family';
import { createClient } from '@/lib/supabase/server';

/**
 * Light encouragement only: an attendance streak and a few badges, all worked out
 * from the student's real records. Nothing is stored and nothing is competitive.
 */
export async function Achievements({ studentId }: { studentId: string }) {
  const supabase = createClient();
  const [{ data: attendance }, { data: submissions }, { count: asked }, { count: answered }, { count: checkIns }] = await Promise.all([
    supabase.from('attendance').select('status, class:classes(starts_at)').eq('student_id', studentId).limit(300),
    supabase.from('submissions').select('assignment_id, score, status, assignment:assignments(max_marks)').eq('student_id', studentId).limit(300),
    supabase.from('class_questions').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('class_poll_answers').select('poll_id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('class_feedback').select('class_id', { count: 'exact', head: true }).eq('student_id', studentId),
  ]);

  const ordered = (attendance ?? [])
    .map((a) => ({ status: a.status, at: one(a.class)?.starts_at ?? '' }))
    .sort((x, y) => y.at.localeCompare(x.at));
  let streak = 0;
  for (const a of ordered) {
    if (a.status === 'present' || a.status === 'late') streak += 1;
    else if (a.status === 'excused') continue; // an excused lesson does not break a streak
    else break;
  }
  const completed = new Set((submissions ?? []).map((s) => s.assignment_id)).size;
  const best = Math.max(0, ...(submissions ?? []).filter((s) => s.status === 'graded').map((s) => {
    const max = Number(one(s.assignment)?.max_marks ?? 0);
    return max ? (Number(s.score) / max) * 100 : 0;
  }));

  const badges = [
    { earned: completed >= 1, label: 'First piece of work handed in' },
    { earned: completed >= 10, label: '10 pieces of work completed' },
    { earned: streak >= 5, label: '5 lessons attended in a row' },
    { earned: best >= 80, label: 'Scored 80% or more' },
    // Taking part counts, whether or not the answer was right.
    { earned: (asked ?? 0) >= 1, label: 'Asked a question in a lesson' },
    { earned: (answered ?? 0) >= 5, label: 'Answered 5 quick checks' },
    { earned: (checkIns ?? 0) >= 3, label: 'Checked in after 3 lessons' },
  ].filter((b) => b.earned);
  if (streak < 2 && badges.length === 0) return null;

  return (
    <section aria-label="Achievements" className="card p-5">
      <h2 className="text-lg font-semibold">Achievements</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {streak >= 2 && (
          <span className="inline-flex items-center gap-2 rounded-full bg-flame/15 px-4 py-2 text-sm font-semibold">
            <Flame size={18} className="text-flame" aria-hidden="true" /> {streak} lessons attended in a row
          </span>
        )}
        {badges.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-4 py-2 text-sm font-medium">
            <Award size={18} className="text-[rgb(var(--heading))]" aria-hidden="true" /> {b.label}
          </span>
        ))}
      </div>
    </section>
  );
}
