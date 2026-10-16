import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, Car, Download, HelpCircle, Home, MapPin, MonitorPlay, NotebookPen, PenLine, PlayCircle, Target, Trophy } from 'lucide-react';
import { FeedbackForm, PollAnswer, QuestionForm, RsvpForm } from '@/components/family/RoomForms';
import { AutoRefresh } from '@/components/portal/AutoRefresh';
import { LocalTime } from '@/components/portal/LocalTime';
import { Leaderboard, pollDeadline, PollResults, type LeaderRow, type PollView } from '@/components/portal/PollResults';
import { SectionHeading } from '@/components/portal/WelcomeBanner';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Optional: a self-hosted Jitsi server whose meetings may be shown inside the page. */
const EMBED_DOMAIN = process.env.NEXT_PUBLIC_JITSI_EMBED_DOMAIN ?? '';

/**
 * The lesson room. One page per class for everything a learner does around a lesson,
 * the same for home and online classes:
 *   before  – confirm attendance, see objectives and materials, ask a question
 *   during  – join (online), answer quick checks
 *   after   – recap, homework, recording, "how well did I understand"
 * `mode` "student" shows everything. "parent" shows the lesson, recap, their child's
 * questions and lets them confirm attendance; taking part in the lesson is the learner's.
 * RLS returns the class only if the viewer is in it (or is a verified parent of someone who is).
 */
export async function LessonRoom({ classId, studentId, studentName, mode, backHref }: { classId: string; studentId: string; studentName: string; mode: 'student' | 'parent'; backHref: string }) {
  if (!UUID.test(classId)) notFound();
  const supabase = createClient();
  const { data: c } = await supabase
    .from('classes')
    .select('id, title, starts_at, duration_minutes, delivery, venue, meeting_url, objectives, notes, status, recap, homework, recording_url, tutor_en_route_at')
    .eq('id', classId)
    .maybeSingle();
  if (!c) notFound();
  // The class may be visible because of a sibling; make sure THIS learner is in it.
  const { data: member } = await supabase.from('class_students').select('student_id').eq('class_id', classId).eq('student_id', studentId).maybeSingle();
  if (!member) notFound();

  const student = mode === 'student';
  const [{ data: rsvp }, { data: questions }, pollsResult, { data: feedback }, { data: attached }, { data: board }] = await Promise.all([
    supabase.from('class_rsvps').select('response, note').eq('class_id', classId).eq('student_id', studentId).maybeSingle(),
    supabase.from('class_questions').select('id, body, answer, created_at').eq('class_id', classId).eq('student_id', studentId).order('created_at', { ascending: false }),
    student ? supabase.rpc('get_class_polls', { p_class: classId }) : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('class_feedback').select('understanding, comment').eq('class_id', classId).eq('student_id', studentId).maybeSingle(),
    supabase.from('class_materials').select('material:materials(id, title, path, bucket)').eq('class_id', classId),
    supabase.from('boards').select('id').eq('class_id', classId).maybeSingle(),
  ]);

  const start = new Date(c.starts_at).getTime();
  const end = start + c.duration_minutes * 60000;
  const now = Date.now();
  const upcoming = c.status === 'scheduled' && now < start;
  const started = now >= start;
  const joinOpen = c.status === 'scheduled' && now >= start - 15 * 60000 && now <= end + 15 * 60000;
  const home = c.delivery === 'home';
  const polls = ((pollsResult.data ?? []) as PollView[]);
  const openPolls = polls.filter((p) => p.status === 'open' && p.my_choice === null);
  const otherPolls = polls.filter((p) => !(p.status === 'open' && p.my_choice === null));
  const leaders = student && polls.some((p) => p.points && p.status === 'closed')
    ? (((await supabase.rpc('get_class_leaderboard', { p_class: classId })).data ?? []) as LeaderRow[])
    : [];
  const materials = (attached ?? []).map((a) => one(a.material)).filter((m): m is { id: string; title: string; path: string; bucket: string } => Boolean(m));
  let embedUrl: string | null = null;
  if (student && joinOpen && c.meeting_url && EMBED_DOMAIN) {
    try {
      const u = new URL(c.meeting_url);
      if (u.host === EMBED_DOMAIN) embedUrl = `${u.origin}${u.pathname}#userInfo.displayName=${encodeURIComponent(JSON.stringify(studentName))}&config.prejoinConfig.enabled=true`;
    } catch {
      embedUrl = null;
    }
  }
  const who = student ? 'you' : studentName.split(' ')[0];

  return (
    <>
      {/* Keeps quick checks and answers arriving while the lesson is on. */}
      {student && c.status === 'scheduled' && now > start - 30 * 60000 && now < end + 60 * 60000 && <AutoRefresh seconds={5} />}
      <p className="mb-3 text-sm"><Link href={backHref} className="text-link hover:underline">← Timetable</Link></p>

      {/* Header tile */}
      <section className={`tile mb-4 ${home ? 'bg-tile-peach' : 'bg-tile-sky'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-3 py-1 text-xs font-semibold shadow-xs">
              {home ? <Home size={14} aria-hidden="true" /> : <MonitorPlay size={14} aria-hidden="true" />} {home ? 'Home lesson' : 'Online lesson'}
            </p>
            <h1 className="mt-3 text-[1.7rem] font-semibold leading-tight sm:text-[2.1rem]">{c.title}</h1>
            <p className="mt-1 text-ink/75"><LocalTime iso={c.starts_at} /> · {c.duration_minutes} minutes</p>
            {home && c.venue && <p className="mt-2 flex items-start gap-1.5 text-sm text-ink/75"><MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> {c.venue}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone={c.status === 'completed' ? 'green' : c.status === 'cancelled' ? 'red' : 'blue'}>{c.status}</Badge>
            {!home && c.meeting_url && c.status === 'scheduled' && !embedUrl && (
              joinOpen
                ? <ButtonLink href={c.meeting_url} external size="lg">Join class</ButtonLink>
                : upcoming && <span className="max-w-[14rem] text-right text-sm text-ink/70">The Join button appears 15 minutes before the start.</span>
            )}
          </div>
        </div>
        {home && c.tutor_en_route_at && c.status === 'scheduled' && now < end && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface/85 px-4 py-3 text-sm font-semibold shadow-xs" role="status">
            <Car size={18} aria-hidden="true" className="text-accent" /> Your tutor set off at <LocalTime iso={c.tutor_en_route_at} format="time" /> and is on the way.
          </p>
        )}
      </section>
      {c.status === 'cancelled' && <div className="mb-4"><Alert tone="warning">This lesson was cancelled.</Alert></div>}

      {embedUrl && (
        <section aria-label="Online classroom" className="card mb-4 overflow-hidden p-0">
          <iframe src={embedUrl} title={`Online classroom for ${c.title}`} allow="camera; microphone; fullscreen; display-capture; autoplay" className="aspect-video w-full" />
          <p className="px-4 py-2 text-xs text-muted">Trouble with the video? <a className="text-link underline" href={c.meeting_url!} target="_blank" rel="noopener noreferrer">Open the class in a new tab</a>.</p>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          {/* Quick checks waiting for an answer come first: they are time-sensitive. */}
          {openPolls.map((p) => (
            <section key={p.id} className="tile bg-tile-sun" aria-label="Quick check">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-accent">Quick check from your tutor</p>
              <PollAnswer pollId={p.id} classId={c.id} question={p.question} options={p.options} deadline={pollDeadline(p)} points={Boolean(p.points)} />
            </section>
          ))}

          {(c.objectives || c.notes) && (
            <Card>
              {c.objectives && (
                <>
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><Target size={18} aria-hidden="true" className="text-link" /> What this lesson is about</h2>
                  <p className="mt-2 whitespace-pre-line">{c.objectives}</p>
                </>
              )}
              {c.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted">{c.notes}</p>}
            </Card>
          )}

          {(c.recap || c.homework || c.recording_url) && (
            <section className="card p-5 sm:p-6" aria-label="After the lesson">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><NotebookPen size={18} aria-hidden="true" className="text-link" /> After the lesson</h2>
              {c.recap && (
                <div className="mt-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted">What we covered</h3>
                  <p className="mt-1 whitespace-pre-line">{c.recap}</p>
                </div>
              )}
              {c.homework && (
                <div className="mt-4 rounded-2xl bg-tile-sun p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Homework</h3>
                  <p className="mt-1 whitespace-pre-line">{c.homework}</p>
                </div>
              )}
              {c.recording_url && (
                <p className="mt-4"><ButtonLink href={c.recording_url} external variant="outline" size="sm"><PlayCircle size={16} aria-hidden="true" /> Watch the recording</ButtonLink></p>
              )}
            </section>
          )}

          {student && otherPolls.length > 0 && (
            <Card>
              <SectionHeading title="Quick checks" count={otherPolls.length} />
              <ul className="space-y-4">
                {otherPolls.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-sunken p-4">
                    <p className="mb-3 font-semibold">{p.question}</p>
                    {p.status === 'closed'
                      ? <PollResults poll={p} />
                      : <p className="text-sm text-muted">You answered “{p.options[p.my_choice ?? 0]}”. The answer appears when your tutor closes this check.</p>}
                    {p.status === 'closed' && p.my_choice === null && <p className="mt-2 text-xs text-muted">You did not answer this one.</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><HelpCircle size={18} aria-hidden="true" className="text-link" /> {student ? 'Ask your tutor' : `${who}’s questions`}</h2>
            {student && c.status !== 'cancelled' && <div className="mt-3"><QuestionForm classId={c.id} /></div>}
            {questions?.length ? (
              <ul className="mt-4 space-y-3">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-2xl bg-sunken p-4">
                    <p className="font-medium">{q.body}</p>
                    {q.answer
                      ? <p className="mt-2 whitespace-pre-line rounded-xl bg-tile-mint p-3 text-sm"><span className="font-semibold">Tutor: </span>{q.answer}</p>
                      : <p className="mt-1 text-sm text-muted">Waiting for an answer.</p>}
                  </li>
                ))}
              </ul>
            ) : !student && <p className="mt-2 text-sm text-muted">No questions have been asked about this lesson.</p>}
          </Card>
        </div>

        <aside className="space-y-4" aria-label="Attendance, materials and check-in">
          {student && board && c.status !== 'cancelled' && (
            <section className="tile bg-tile-sky" aria-label="Class board">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><PenLine size={18} aria-hidden="true" /> Class board</h2>
              <p className="mb-3 mt-1 text-sm text-ink/75">Watch what your tutor writes, live, and answer on your own mini board when asked. Works in the classroom on a phone too.</p>
              <ButtonLink href={`/portal/classes/${c.id}/board`} size="sm">Open the board</ButtonLink>
            </section>
          )}
          {leaders.length > 0 && (
            <Card>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Trophy size={18} aria-hidden="true" className="text-accent" /> Quick-check points</h2>
              <Leaderboard rows={leaders} />
            </Card>
          )}
          {upcoming && (
            <section className="tile bg-tile-mint" aria-label="Confirm attendance">
              <h2 className="text-lg font-semibold">{student ? 'Will you be there?' : `Will ${who} be there?`}</h2>
              <p className="mb-3 mt-1 text-sm text-ink/75">Letting your tutor know helps them plan{home ? ' the journey' : ' the lesson'}.</p>
              <RsvpForm classId={c.id} studentId={studentId} current={(rsvp?.response as 'attending' | 'not_attending' | undefined) ?? null} note={rsvp?.note ?? null} />
            </section>
          )}
          {!upcoming && rsvp && (
            <Card><p className="text-sm text-muted">Attendance was confirmed as: <span className="font-semibold text-ink">{rsvp.response === 'attending' ? 'coming' : 'unable to attend'}</span>.</p></Card>
          )}

          <Card>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen size={18} aria-hidden="true" className="text-link" /> Materials for this lesson</h2>
            {materials.length ? (
              <ul className="mt-3 space-y-2">
                {materials.map((m) => (
                  <li key={m.id}>
                    <a
                      href={m.bucket === 'materials' ? `/api/files?bucket=materials&path=${encodeURIComponent(m.path)}` : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/handouts/${encodeURIComponent(m.path)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl bg-sunken px-3 py-2 text-sm font-medium hover:bg-tile-sky"
                    >
                      <span className="min-w-0 truncate">{m.title}</span>
                      <Download size={16} aria-hidden="true" className="shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Nothing has been attached to this lesson yet.</p>}
          </Card>

          {student && started && c.status !== 'cancelled' && (
            <section className="tile bg-tile-lilac" aria-label="How well did you understand">
              <h2 className="text-lg font-semibold">How well did you understand?</h2>
              <p className="mb-3 mt-1 text-sm text-ink/75">Be honest. It helps your tutor plan the next lesson.</p>
              <FeedbackForm classId={c.id} current={feedback?.understanding ?? null} comment={feedback?.comment ?? null} />
            </section>
          )}
          {!student && feedback && (
            <Card>
              <h2 className="text-lg font-semibold">{who}’s check-in</h2>
              <p className="mt-1 text-sm">Understanding: <span className="font-semibold">{['', 'Lost', 'Unsure', 'Mostly there', 'Confident'][feedback.understanding]}</span></p>
              {feedback.comment && <p className="mt-1 text-sm text-muted">“{feedback.comment}”</p>}
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
