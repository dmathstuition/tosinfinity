import type { SupabaseClient } from '@supabase/supabase-js';
import { formatMoney } from '@/lib/billing';
import type { WeeklyReportData } from '@/lib/email/templates';

type Body = Omit<WeeklyReportData, 'name' | 'forParent'>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** How a lesson in the past week is described in the report. */
export function attendanceLabel(status: string | null | undefined, cancelled = false): string {
  if (cancelled) return 'cancelled';
  switch (status) {
    case 'present': return 'attended';
    case 'late': return 'attended (late)';
    case 'absent': return 'missed';
    case 'excused': return 'excused';
    default: return 'not recorded yet';
  }
}

/** "12 – 18 Oct 2026" for the seven days ending on `end`, in the academy's time zone. */
export function weekLabel(end: Date, timeZone: string): string {
  const start = new Date(end.getTime() - 6 * 86400000);
  const d = (x: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone, ...o }).format(x);
  return `${d(start, { day: 'numeric', month: 'short' })} – ${d(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** True when there is nothing worth reporting: no lessons, no work, nothing coming up. */
export function isEmptyReport(r: Body): boolean {
  return !r.lessons.total && !r.handedIn.length && !r.marked.length && !r.overdue.length && !r.merits.length && !r.nextLessons.length && !r.dueSoon.length;
}

/**
 * One learner's last seven days and next seven days. Runs with the service role
 * inside the weekly job, scoped to this learner's own records.
 */
export async function collectWeeklyReport(admin: SupabaseClient, student: { id: string; full_name: string }, timeZone: string, now = new Date()): Promise<Body> {
  const from = new Date(now.getTime() - 7 * 86400000).toISOString();
  const until = new Date(now.getTime() + 7 * 86400000).toISOString();
  const t = (iso: string) => Date.parse(iso);
  const fromMs = now.getTime() - 7 * 86400000;
  const nowMs = now.getTime();
  const untilMs = now.getTime() + 7 * 86400000;
  const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const day = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  const [classes, attendance, assigned, submissions, behaviour, invoices] = await Promise.all([
    admin.from('class_students').select('class:classes!inner(id, title, starts_at, status)').eq('student_id', student.id).gte('class.starts_at', from).lt('class.starts_at', until),
    admin.from('attendance').select('class_id, status').eq('student_id', student.id),
    admin.from('assignment_students').select('assignment:assignments!inner(id, title, due_at, max_marks, published)').eq('student_id', student.id).eq('assignment.published', true),
    admin.from('submissions').select('assignment_id, submitted_at, graded_at, score, status').eq('student_id', student.id),
    admin.from('behaviour_notes').select('kind, category, points').eq('student_id', student.id).gte('created_at', from),
    admin.from('invoices').select('total_minor, paid_minor, currency').eq('student_id', student.id).in('status', ['unpaid', 'partially_paid', 'overdue']),
  ]);

  const att = new Map((attendance.data ?? []).map((a) => [a.class_id as string, a.status as string]));
  const cls = (classes.data ?? []).map((r) => one(r.class) as { id: string; title: string; starts_at: string; status: string } | null).filter((c): c is NonNullable<typeof c> => Boolean(c)).sort((a, b) => t(a.starts_at) - t(b.starts_at));
  const past = cls.filter((c) => t(c.starts_at) < nowMs);
  const held = past.filter((c) => c.status !== 'cancelled');
  const attended = held.filter((c) => ['present', 'late'].includes(att.get(c.id) ?? '')).length;

  const work = (assigned.data ?? []).map((r) => one(r.assignment) as { id: string; title: string; due_at: string | null; max_marks: number } | null).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const subs = submissions.data ?? [];
  const submitted = new Set(subs.map((s) => s.assignment_id as string));
  const title = (id: string) => work.find((w) => w.id === id)?.title ?? 'Assignment';
  const maxOf = (id: string) => Number(work.find((w) => w.id === id)?.max_marks ?? 0);

  const balanceMinor = (invoices.data ?? []).reduce((s, i) => s + Number(i.total_minor) - Number(i.paid_minor), 0);
  const currency = invoices.data?.[0]?.currency as string | undefined;

  return {
    studentName: student.full_name,
    weekLabel: weekLabel(now, timeZone),
    lessons: {
      attended,
      total: held.length,
      items: past.map((c) => ({ title: c.title, when: day(c.starts_at), status: attendanceLabel(att.get(c.id), c.status === 'cancelled') })),
    },
    handedIn: subs.filter((s) => t(s.submitted_at) >= fromMs).map((s) => title(s.assignment_id)),
    marked: subs
      .filter((s) => s.status === 'graded' && s.graded_at && t(s.graded_at) >= fromMs && s.score !== null)
      .map((s) => ({ title: title(s.assignment_id), score: `${Number(s.score)}/${maxOf(s.assignment_id)}` })),
    overdue: work.filter((w) => w.due_at && t(w.due_at) < nowMs && !submitted.has(w.id)).map((w) => w.title),
    merits: (behaviour.data ?? []).map((b) => ({ category: b.category as string, points: Number(b.points), kind: b.kind as 'merit' | 'concern' })),
    nextLessons: cls.filter((c) => t(c.starts_at) >= nowMs && c.status === 'scheduled').map((c) => ({ title: c.title, when: when(c.starts_at) })),
    dueSoon: work.filter((w) => w.due_at && t(w.due_at) >= nowMs && t(w.due_at) < untilMs && !submitted.has(w.id)).map((w) => ({ title: w.title, due: day(w.due_at!) })),
    balance: balanceMinor > 0 && currency ? formatMoney(balanceMinor, currency) : null,
  };
}
