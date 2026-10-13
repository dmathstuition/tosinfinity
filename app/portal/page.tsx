import Link from 'next/link';
import clsx from 'clsx';
import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Clock, GraduationCap, MessageSquare, TrendingUp } from 'lucide-react';
import { Achievements } from '@/components/family/Achievements';
import { InvoiceList, MaterialList, UpcomingClasses } from '@/components/family/views';
import { LocalTime } from '@/components/portal/LocalTime';
import { ActionTile, SectionHeading, WelcomeBanner } from '@/components/portal/WelcomeBanner';
import { MiniBars, Ring } from '@/components/ui/MiniBars';
import { Badge, Card, Stat } from '@/components/ui/primitives';
import { one, studentContext } from '@/lib/family';

export const metadata = { title: 'Dashboard' };

const WORK_TILES = ['bg-tile-sun', 'bg-tile-sky', 'bg-tile-lilac', 'bg-tile-mint'];
const KIND = { written: 'Written', quiz: 'Quiz', timed: 'Timed practice' } as const;

type Assignment = { id: string; title: string; kind: string; due_at: string | null; max_marks: number };
type Submission = { assignment_id: string; attempt: number; status: string; score: number | null; feedback: string | null; submitted_at: string };

export default async function StudentDashboard() {
  const { profile, supabase } = await studentContext();
  // Every query below runs as this student; RLS returns only their own records.
  const [{ count: unread }, attendance, assigned, submissions, enrolments] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', profile.id),
    supabase.from('attendance').select('status').eq('student_id', profile.id).limit(500),
    supabase.from('assignment_students').select('assignment:assignments!inner(id, title, kind, due_at, max_marks)').eq('student_id', profile.id),
    supabase.from('submissions').select('assignment_id, attempt, status, score, feedback, submitted_at').eq('student_id', profile.id).order('attempt', { ascending: false }),
    supabase.from('student_enrolments').select('programme:programmes(title)').eq('student_id', profile.id).eq('status', 'active'),
  ]);

  const att = attendance.data ?? [];
  const attended = att.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendancePct = att.length ? (attended / att.length) * 100 : null;

  const work = (assigned.data ?? []).map((r) => one(r.assignment) as Assignment | null).filter((a): a is Assignment => Boolean(a));
  const latest = new Map<string, Submission>();
  for (const s of (submissions.data ?? []) as Submission[]) if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
  const todo = work.filter((a) => !latest.has(a.id)).sort((x, y) => (x.due_at ?? '9').localeCompare(y.due_at ?? '9'));
  const graded = work
    .flatMap((a) => {
      const s = latest.get(a.id);
      return s && s.status === 'graded' && s.score !== null ? [{ a, s, pct: Number(a.max_marks) ? (Number(s.score) / Number(a.max_marks)) * 100 : 0 }] : [];
    })
    .sort((x, y) => x.s.submitted_at.localeCompare(y.s.submitted_at));
  const average = graded.length ? Math.round(graded.reduce((sum, x) => sum + x.pct, 0) / graded.length) : null;
  const programmes = (enrolments.data ?? []).map((e) => one(e.programme)?.title).filter((t): t is string => Boolean(t));
  const recent = graded.slice(-3).reverse();
  const chart = graded.slice(-8);

  return (
    <>
      <WelcomeBanner eyebrow={profile.student_code ? `Student ID ${profile.student_code}` : 'Student portal'} title={`Hello, ${profile.full_name.split(' ')[0]}`}>
        {programmes.length > 0 && (
          <ul aria-label="Your programmes" className="mb-4 flex flex-wrap gap-2">
            {programmes.map((p) => (
              <li key={p} className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold shadow-xs">
                <GraduationCap size={16} aria-hidden="true" className="text-link" /> {p}
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Shortcuts" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <ActionTile href="/portal/timetable" label="Timetable" icon={CalendarDays} index={0} />
          <ActionTile href="/portal/assignments" label="Assignments" icon={ClipboardList} index={1} />
          <ActionTile href="/portal/materials" label="Materials" icon={BookOpen} index={3} />
          <ActionTile href="/portal/messages" label="Messages" icon={MessageSquare} index={4} />
        </nav>
      </WelcomeBanner>

      {(unread ?? 0) > 0 && (
        <Link href="/portal/messages" className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-tile-peach px-4 py-3 text-sm font-semibold hover:shadow-card">
          You have {unread} unread message{unread === 1 ? '' : 's'} from your tutor.
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Stat label="Work handed in" value={work.length - todo.length} suffix={`/ ${work.length}`} icon={CheckCircle2} tone="royal" />
            <Stat label="Lessons attended" value={attended} suffix={`/ ${att.length}`} icon={Clock} tone="lilac" />
            <div className="col-span-2 lg:col-span-1">
              <Stat label="Average mark" value={average === null ? '—' : average} suffix={average === null ? undefined : '%'} icon={TrendingUp} tone="red" hint={`${graded.length} piece${graded.length === 1 ? '' : 's'} marked`} />
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section aria-label="Work to do" className="card p-5">
              <SectionHeading title="Work to do" count={todo.length} href="/portal/assignments" link="All" />
              {todo.length ? (
                <ul className="space-y-3">
                  {todo.slice(0, 3).map((a, i) => {
                    const overdue = a.due_at && new Date(a.due_at) < new Date();
                    return (
                      <li key={a.id}>
                        <Link href={`/portal/assignments/${a.id}`} className={clsx('group block rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card', WORK_TILES[i % WORK_TILES.length])}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-surface/85 px-2.5 py-1 text-xs font-semibold shadow-xs">{KIND[a.kind as keyof typeof KIND]}</span>
                            {overdue ? <Badge tone="red">Overdue</Badge> : <span className="text-xs font-semibold text-ink/70">{Number(a.max_marks)} marks</span>}
                          </div>
                          <p className="mt-3 font-heading text-lg font-semibold leading-snug" style={{ color: 'rgb(var(--heading))' }}>{a.title}</p>
                          <p className="mt-1 text-sm text-ink/70">{a.due_at ? <>Due <LocalTime iso={a.due_at} /></> : 'No due date'}</p>
                          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Start <ArrowUpRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="rounded-2xl bg-tile-mint px-4 py-8 text-center text-sm font-medium">All set work has been handed in.</p>}
            </section>

            <div className="space-y-4">
              <section aria-labelledby="marks-h" className="tile bg-tile-sky">
                <h2 id="marks-h" className="mb-3 text-lg font-semibold">Your marks</h2>
                <MiniBars
                  data={chart.map((x, i) => ({ label: String(graded.length - chart.length + i + 1), value: Math.round(x.pct) }))}
                  format={(n) => `${n}%`}
                  highlight={chart.length - 1}
                  label="Your marks as percentages, oldest to most recent"
                  emptyText="Marked work will appear here."
                />
              </section>
              <section aria-label="Attendance" className="tile flex items-center gap-4 bg-tile-sun">
                <Ring percent={attendancePct} label="Attendance" />
                <div>
                  <h2 className="text-lg font-semibold">Attendance</h2>
                  <p className="text-sm text-ink/70">{att.length ? `${attended} of ${att.length} lessons attended.` : 'No lessons recorded yet.'}</p>
                  <Link href="/portal/timetable" className="mt-1 inline-block text-sm font-semibold text-link underline-offset-4 hover:underline">See record ›</Link>
                </div>
              </section>
            </div>
          </div>

          <section aria-label="Recent marks and feedback" className="card p-5 sm:p-6">
            <SectionHeading title="Recent marks and feedback" href="/portal/assignments" link="All results" />
            {recent.length ? (
              <ul className="space-y-3">
                {recent.map((x) => (
                  <li key={x.a.id} className="rounded-2xl bg-sunken p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/portal/assignments/${x.a.id}`} className="font-semibold hover:underline">{x.a.title}</Link>
                      <Badge tone="green">{Number(x.s.score)} / {Number(x.a.max_marks)}</Badge>
                    </div>
                    {x.s.feedback && <p className="mt-2 whitespace-pre-line text-sm text-ink/80"><span className="font-semibold">Tutor feedback: </span>{x.s.feedback}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Your marks and your tutor’s feedback will appear here.</p>}
          </section>
        </div>

        <aside aria-label="Classes and more" className="space-y-4">
          <section aria-label="Next classes">
            <SectionHeading title="Next classes" href="/portal/timetable" link="Timetable" />
            <UpcomingClasses studentId={profile.id} limit={3} canJoin roomBase="/portal/classes" />
          </section>
          <Achievements studentId={profile.id} />
          <Card>
            <SectionHeading title="Shared resources" href="/portal/materials" link="All" />
            <MaterialList limit={3} />
          </Card>
          <section aria-label="Invoices">
            <SectionHeading title="Invoices" href="/portal/invoices" link="All" />
            <InvoiceList studentId={profile.id} base="/portal" limit={2} />
          </section>
        </aside>
      </div>
    </>
  );
}
