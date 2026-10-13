import Link from 'next/link';
import { Download, Home, Video } from 'lucide-react';
import { LocalTime } from '@/components/portal/LocalTime';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, type BadgeTone, Card, EmptyState, Stat } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/billing';
import { publicEnv } from '@/lib/env';
import { one } from '@/lib/family';
import { formatBytes } from '@/lib/files';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/time';

/**
 * Read-only views shared by the Student and Parent portals. Each takes the student
 * whose records to show and runs under the viewer's own session, so the database
 * (RLS) returns rows only if the viewer is that student or a verified parent.
 */
type Base = { studentId: string; base: '/portal' | '/parent'; q?: string };

const INVOICE_TONE: Record<string, BadgeTone> = { paid: 'green', overdue: 'red', partially_paid: 'gold', unpaid: 'orange', cancelled: 'neutral' };

function joinWindow(startsAt: string, minutes: number) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  return now >= start - 15 * 60000 && now <= start + minutes * 60000;
}

export async function UpcomingClasses({ studentId, limit = 20, canJoin, roomBase }: { studentId: string; limit?: number; canJoin?: boolean; roomBase?: string }) {
  const supabase = createClient();
  const { data: rsvps } = await supabase.from('class_rsvps').select('class_id, response').eq('student_id', studentId);
  const rsvpBy = new Map((rsvps ?? []).map((r) => [r.class_id, r.response]));
  const { data } = await supabase
    .from('class_students')
    .select('class:classes!inner(id, title, starts_at, duration_minutes, delivery, venue, meeting_url, objectives, status)')
    .eq('student_id', studentId)
    .eq('class.status', 'scheduled')
    .gte('class.starts_at', new Date(Date.now() - 3 * 3600_000).toISOString())
    .limit(limit);
  const classes = (data ?? []).map((r) => one(r.class)).filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => new Date(c.starts_at).getTime() + c.duration_minutes * 60000 > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  if (classes.length === 0) return <EmptyState title="No upcoming classes">When a class is scheduled it will appear here.</EmptyState>;
  return (
    <ul className="space-y-3">
      {classes.map((c) => {
        const open = joinWindow(c.starts_at, c.duration_minutes);
        return (
          <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              {roomBase
                ? <Link href={`${roomBase}/${c.id}`} className="font-semibold text-link hover:underline">{c.title}</Link>
                : <p className="font-semibold">{c.title}</p>}
              <p className="text-sm text-muted"><LocalTime iso={c.starts_at} /> · {c.duration_minutes} min</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm">
                {c.delivery === 'online' ? <Video size={16} aria-hidden="true" className="text-link" /> : <Home size={16} aria-hidden="true" className="text-orange" />}
                {c.delivery === 'online' ? 'Online class' : `Home tutoring${c.venue ? ` · ${c.venue}` : ''}`}
              </p>
              {c.objectives && <p className="mt-1 text-sm text-muted">Objectives: {c.objectives}</p>}
              {roomBase && (
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  {rsvpBy.get(c.id) === 'attending' && <Badge tone="green">Confirmed</Badge>}
                  {rsvpBy.get(c.id) === 'not_attending' && <Badge tone="red">Cannot attend</Badge>}
                  {!rsvpBy.has(c.id) && <Badge tone="orange">Please confirm</Badge>}
                  <Link href={`${roomBase}/${c.id}`} className="text-sm font-semibold text-link underline-offset-4 hover:underline">Open lesson room ›</Link>
                </p>
              )}
            </div>
            {canJoin && c.delivery === 'online' && c.meeting_url && (
              open
                ? <ButtonLink href={c.meeting_url} external>Join class</ButtonLink>
                : <span className="text-sm text-muted">Join opens 15 minutes before the start</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export async function AttendanceSummary({ studentId, detailed }: { studentId: string; detailed?: boolean }) {
  const { data } = await createClient()
    .from('attendance')
    .select('status, actual_minutes, note, class:classes(title, starts_at)')
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(detailed ? 60 : 200);
  const rows = data ?? [];
  const n = (s: string) => rows.filter((r) => r.status === s).length;
  const attended = n('present') + n('late');
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={rows.length ? `${Math.round((attended / rows.length) * 100)}%` : '—'} hint={`${attended} of ${rows.length} lessons`} tone="royal" />
        <Stat label="Present" value={n('present')} tone="green" />
        <Stat label="Late" value={n('late')} tone="gold" />
        <Stat label="Absent / excused" value={`${n('absent')} / ${n('excused')}`} tone="red" />
      </div>
      {detailed && (
        rows.length ? (
          <ul className="card mt-4 divide-y divide-line p-0">
            {rows.map((r, i) => {
              const c = one(r.class);
              return (
                <li key={i} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span>{c?.title}<br /><span className="text-muted">{c ? <LocalTime iso={c.starts_at} format="date" /> : ''}</span></span>
                  <Badge tone={r.status === 'present' ? 'green' : r.status === 'absent' ? 'red' : 'gold'}>{r.status}</Badge>
                </li>
              );
            })}
          </ul>
        ) : <div className="mt-4"><EmptyState title="No attendance recorded yet" /></div>
      )}
    </>
  );
}

/** Published assignments for a student with their latest attempt. `linkBase` set → titles link to the work page. */
export async function AssignmentList({ studentId, linkBase, only }: { studentId: string; linkBase?: string; only?: 'outstanding' | 'graded' }) {
  const supabase = createClient();
  const [{ data: assigned }, { data: subs }] = await Promise.all([
    supabase.from('assignment_students').select('assignment:assignments!inner(id, title, kind, due_at, max_marks, allow_resubmission)').eq('student_id', studentId),
    supabase.from('submissions').select('assignment_id, attempt, status, score, feedback, submitted_at').eq('student_id', studentId).order('attempt', { ascending: false }),
  ]);
  const latest = new Map<string, NonNullable<typeof subs>[number]>();
  for (const s of subs ?? []) if (!latest.has(s.assignment_id)) latest.set(s.assignment_id, s);
  let items = (assigned ?? []).map((r) => one(r.assignment)).filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({ a, s: latest.get(a.id) }))
    .sort((x, y) => (x.a.due_at ?? '9').localeCompare(y.a.due_at ?? '9'));
  if (only === 'outstanding') items = items.filter((i) => !i.s);
  if (only === 'graded') items = items.filter((i) => i.s?.status === 'graded').sort((x, y) => (y.s!.submitted_at).localeCompare(x.s!.submitted_at));
  if (items.length === 0) {
    return <EmptyState title={only === 'outstanding' ? 'Nothing outstanding' : only === 'graded' ? 'No marked work yet' : 'No assignments yet'}>{only === 'outstanding' ? 'All set work has been handed in.' : 'Work set by your tutor will appear here.'}</EmptyState>;
  }
  return (
    <ul className="space-y-3">
      {items.map(({ a, s }) => {
        const overdue = !s && a.due_at && new Date(a.due_at) < new Date();
        const title = linkBase ? <Link href={`${linkBase}/${a.id}`} className="font-semibold text-link hover:underline">{a.title}</Link> : <span className="font-semibold">{a.title}</span>;
        return (
          <li key={a.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {title}
                <p className="text-sm text-muted">
                  {a.kind === 'written' ? 'Written' : a.kind === 'quiz' ? 'Quiz' : 'Timed practice'}
                  {a.due_at ? <> · due <LocalTime iso={a.due_at} /></> : ''}
                </p>
              </div>
              {s?.status === 'graded' ? <Badge tone="green">{Number(s.score)} / {Number(a.max_marks)}</Badge>
                : s ? <Badge tone="blue">Submitted</Badge>
                : overdue ? <Badge tone="red">Overdue</Badge> : <Badge tone="orange">To do</Badge>}
            </div>
            {s?.status === 'graded' && s.feedback && <p className="mt-2 whitespace-pre-line rounded-lg bg-cloud p-3 text-sm"><span className="font-semibold">Tutor feedback: </span>{s.feedback}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export async function ProgressBars({ studentId }: { studentId: string }) {
  const { data } = await createClient()
    .from('submissions')
    .select('id, score, submitted_at, assignment:assignments(title, max_marks)')
    .eq('student_id', studentId).eq('status', 'graded').order('submitted_at', { ascending: false }).limit(8);
  const rows = (data ?? []).reverse();
  if (rows.length === 0) return <p className="text-sm text-muted">Marked work will build a progress trend here.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const a = one(r.assignment);
        const pct = a && Number(a.max_marks) ? Math.round((Number(r.score) / Number(a.max_marks)) * 100) : 0;
        return (
          <li key={r.id}>
            <div className="flex justify-between gap-3 text-sm"><span className="truncate">{a?.title}</span><span className="shrink-0 tabular-nums">{pct}%</span></div>
            <div className="mt-1 h-2 rounded-full bg-line" role="img" aria-label={`${pct} percent`}><div className="h-2 rounded-full bg-royal" style={{ width: `${Math.min(100, pct)}%` }} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export async function MaterialList({ limit = 50 }: { limit?: number }) {
  // RLS returns public handouts plus private materials shared with this viewer's student(s).
  const { data } = await createClient().from('materials').select('id, title, description, bucket, path, size_bytes, created_at').order('created_at', { ascending: false }).limit(limit);
  if (!data?.length) return <EmptyState title="No materials yet">Worksheets and notes shared by your tutor will appear here.</EmptyState>;
  return (
    <ul className="space-y-3">
      {data.map((m) => {
        const href = m.bucket === 'handouts'
          ? `${publicEnv.supabaseUrl}/storage/v1/object/public/handouts/${encodeURIComponent(m.path)}`
          : `/api/files?bucket=materials&path=${encodeURIComponent(m.path)}`;
        return (
          <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{m.title}</p>
              {m.description && <p className="text-sm text-muted">{m.description}</p>}
              <p className="text-xs text-muted">{formatDate(m.created_at)} · {formatBytes(m.size_bytes)}</p>
            </div>
            <ButtonLink href={href} external variant="outline" size="sm"><Download size={16} aria-hidden="true" /> Open</ButtonLink>
          </li>
        );
      })}
    </ul>
  );
}

export async function ReportList({ studentId, base }: Base) {
  const supabase = createClient();
  const [{ data: reports }, { data: certificates }] = await Promise.all([
    supabase.from('reports').select('id, period_start, period_end, published_at, content').eq('student_id', studentId).eq('status', 'published').order('period_end', { ascending: false }),
    supabase.from('certificates').select('id, title, issued_on').eq('student_id', studentId).order('issued_on', { ascending: false }),
  ]);
  const targets = ((reports?.[0]?.content as { targets?: string[] } | undefined)?.targets ?? []).filter(Boolean);
  return (
    <div className="space-y-6">
      {targets.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold">Current learning targets</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">{targets.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Card>
      )}
      <section aria-labelledby="reports-h">
        <h2 id="reports-h" className="mb-3 text-lg font-semibold">Progress reports</h2>
        {reports?.length ? (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-semibold">{formatDate(r.period_start)} to {formatDate(r.period_end)}</p><p className="text-sm text-muted">Published {r.published_at ? formatDate(r.published_at) : ''}</p></div>
                <ButtonLink href={`${base}/reports/${r.id}`} variant="outline" size="sm">Open report</ButtonLink>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No reports yet">Published progress reports will appear here.</EmptyState>}
      </section>
      {certificates && certificates.length > 0 && (
        <section aria-labelledby="certs-h">
          <h2 id="certs-h" className="mb-3 text-lg font-semibold">Certificates</h2>
          <ul className="space-y-3">
            {certificates.map((c) => (
              <li key={c.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-semibold">{c.title}</p><p className="text-sm text-muted">{formatDate(c.issued_on)}</p></div>
                <ButtonLink href={`${base}/certificates/${c.id}`} variant="outline" size="sm">View certificate</ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export async function InvoiceList({ studentId, base, limit }: Base & { limit?: number }) {
  const { data } = await createClient()
    .from('invoices')
    .select('id, number, total_minor, paid_minor, currency, status, due_date, period_start, period_end')
    .eq('student_id', studentId).order('created_at', { ascending: false }).limit(limit ?? 60);
  if (!data?.length) return <EmptyState title="No invoices yet">Invoices and receipts will appear here.</EmptyState>;
  return (
    <ul className="space-y-3">
      {data.map((i) => {
        const balance = Number(i.total_minor) - Number(i.paid_minor);
        return (
          <li key={i.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link href={`${base}/invoices/${i.id}`} className="font-semibold text-link hover:underline">{i.number}</Link>
              <p className="text-sm text-muted">{formatDate(i.period_start)} to {formatDate(i.period_end)}{i.due_date ? ` · due ${formatDate(i.due_date)}` : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">{formatMoney(Number(i.total_minor), i.currency)}{balance > 0 && i.status !== 'cancelled' && Number(i.paid_minor) > 0 ? <span className="text-sm text-muted"> ({formatMoney(balance, i.currency)} due)</span> : null}</span>
              <Badge tone={INVOICE_TONE[i.status]}>{i.status.replace('_', ' ')}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export async function NoticeList() {
  // RLS returns only notices addressed to this viewer.
  const { data } = await createClient().from('notices').select('id, title, body, published_at').order('published_at', { ascending: false }).limit(40);
  if (!data?.length) return <EmptyState title="No announcements">Notices from the academy will appear here.</EmptyState>;
  return (
    <ul className="space-y-4">
      {data.map((n) => (
        <li key={n.id}>
          <Card>
            <h2 className="text-lg font-semibold">{n.title}</h2>
            <p className="text-xs text-muted">{n.published_at ? formatDate(n.published_at) : ''}</p>
            <p className="mt-3 whitespace-pre-line text-sm">{n.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Lessons that have happened, newest first, with a marker when a recap or homework is waiting. */
export async function PastLessons({ studentId, roomBase, limit = 12 }: { studentId: string; roomBase: string; limit?: number }) {
  const { data } = await createClient()
    .from('class_students')
    .select('class:classes!inner(id, title, starts_at, delivery, status, recap_at, homework)')
    .eq('student_id', studentId)
    .neq('class.status', 'cancelled')
    .lt('class.starts_at', new Date().toISOString())
    .limit(60);
  const lessons = (data ?? []).map((r) => one(r.class)).filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, limit);
  if (lessons.length === 0) return <EmptyState title="No past lessons yet">After each lesson, the recap and any homework appear here.</EmptyState>;
  return (
    <ul className="space-y-3">
      {lessons.map((c) => (
        <li key={c.id}>
          <Link href={`${roomBase}/${c.id}`} className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="min-w-0">
              <span className="block font-semibold">{c.title}</span>
              <span className="block text-sm text-muted"><LocalTime iso={c.starts_at} format="date" /> · {c.delivery === 'online' ? 'Online' : 'Home'}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {c.homework && <Badge tone="gold">Homework</Badge>}
              {c.recap_at ? <Badge tone="green">Recap ready</Badge> : <Badge>No recap yet</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
