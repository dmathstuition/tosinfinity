import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, zonedToUtc } from '@/lib/time';

export type ReportContent = {
  student_name: string;
  student_class: string;
  subjects: string[];
  attendance: { total: number; present: number; late: number; absent: number; excused: number };
  assessments: Array<{ title: string; score: number; max: number; date: string }>;
  strengths: string;
  improvements: string;
  comments: string;
  targets: string[];
  next_steps: string;
};

export const EMPTY_NARRATIVE = { strengths: '', improvements: '', comments: '', targets: [] as string[], next_steps: '' };

/** Gathers the factual part of a report (attendance and marked work) for a period. */
export async function buildReportFigures(
  supabase: SupabaseClient, studentId: string, periodStart: string, periodEnd: string, timezone: string,
): Promise<Pick<ReportContent, 'student_name' | 'student_class' | 'subjects' | 'attendance' | 'assessments'> | null> {
  const from = zonedToUtc(`${periodStart}T00:00`, timezone)?.toISOString();
  const to = zonedToUtc(`${addDays(periodEnd, 1)}T00:00`, timezone)?.toISOString();
  if (!from || !to) return null;

  const [{ data: student }, { data: enrolments }, { data: attendance }, { data: submissions }] = await Promise.all([
    supabase.from('profiles').select('full_name, school_year').eq('id', studentId).eq('role', 'student').maybeSingle(),
    supabase.from('student_enrolments').select('programme:programmes(title)').eq('student_id', studentId).eq('status', 'active'),
    supabase.from('attendance').select('status, class:classes!inner(starts_at)').eq('student_id', studentId).gte('class.starts_at', from).lt('class.starts_at', to),
    supabase.from('submissions').select('score, graded_at, attempt, assignment_id, assignment:assignments(title, max_marks)').eq('student_id', studentId).eq('status', 'graded').gte('graded_at', from).lt('graded_at', to).order('graded_at'),
  ]);
  if (!student) return null;

  const count = (s: string) => (attendance ?? []).filter((a) => a.status === s).length;
  // Latest attempt per assignment only.
  const latest = new Map<string, NonNullable<typeof submissions>[number]>();
  for (const s of submissions ?? []) {
    const prev = latest.get(s.assignment_id);
    if (!prev || s.attempt > prev.attempt) latest.set(s.assignment_id, s);
  }
  return {
    student_name: student.full_name,
    student_class: student.school_year ?? '',
    subjects: (enrolments ?? []).map((e) => (Array.isArray(e.programme) ? e.programme[0] : e.programme)?.title).filter((t): t is string => Boolean(t)),
    attendance: { total: attendance?.length ?? 0, present: count('present'), late: count('late'), absent: count('absent'), excused: count('excused') },
    assessments: [...latest.values()].map((s) => {
      const a = Array.isArray(s.assignment) ? s.assignment[0] : s.assignment;
      return { title: a?.title ?? 'Assessment', score: Number(s.score), max: Number(a?.max_marks ?? 0), date: String(s.graded_at).slice(0, 10) };
    }),
  };
}
