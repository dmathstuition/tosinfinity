import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Car, CheckCircle2, HelpCircle, MapPin, MonitorPlay, XCircle } from 'lucide-react';
import { AutoRefresh } from '@/components/portal/AutoRefresh';
import { LocalTime } from '@/components/portal/LocalTime';
import { PollResults, type PollView } from '@/components/portal/PollResults';
import { SectionHeading } from '@/components/portal/WelcomeBanner';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { formatDateTime } from '@/lib/time';
import {
  answerQuestionAction, attachMaterialAction, closePollAction, createMeetingRoomAction, createPollAction, deletePollAction,
  detachMaterialAction, saveRecapAction, tutorOnTheWayAction,
} from '../../room-actions';

export const metadata = { title: 'Lesson room' };

const UNDERSTANDING = ['', 'Lost', 'Unsure', 'Mostly there', 'Confident'];
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function OwnerRoomPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data: c } = await supabase.from('classes').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();

  const [{ data: roster }, { data: rsvps }, { data: questions }, { data: polls }, { data: feedback }, { data: attached }, { data: library }] = await Promise.all([
    supabase.from('class_students').select('student_id, student:profiles(full_name)').eq('class_id', c.id),
    supabase.from('class_rsvps').select('student_id, response, note, updated_at').eq('class_id', c.id),
    supabase.from('class_questions').select('id, body, answer, created_at, student:profiles(full_name)').eq('class_id', c.id).order('created_at', { ascending: false }),
    supabase.rpc('get_class_polls', { p_class: c.id }),
    supabase.from('class_feedback').select('understanding, comment, student:profiles(full_name)').eq('class_id', c.id),
    supabase.from('class_materials').select('material:materials(id, title)').eq('class_id', c.id),
    supabase.from('materials').select('id, title').eq('bucket', 'materials').order('created_at', { ascending: false }).limit(100),
  ]);

  const rsvpBy = new Map((rsvps ?? []).map((r) => [r.student_id, r]));
  const members = (roster ?? []).map((r) => ({ id: r.student_id, name: one(r.student)?.full_name ?? 'Student' }));
  const pollList = ((polls ?? []) as PollView[]);
  const attachedList = (attached ?? []).map((a) => one(a.material)).filter((m): m is { id: string; title: string } => Boolean(m));
  const attachedIds = new Set(attachedList.map((m) => m.id));
  const unanswered = (questions ?? []).filter((q) => !q.answer).length;
  const home = c.delivery === 'home';
  const scheduled = c.status === 'scheduled';
  const mapUrl = c.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.venue)}` : null;

  return (
    <>
      <AutoRefresh seconds={10} />
      <p className="mb-3 text-sm"><Link href={`/owner/classes/${c.id}`} className="text-link hover:underline">← Class details and register</Link></p>
      <PageHeader
        title={`Lesson room: ${c.title}`}
        description={`${formatDateTime(c.starts_at, timezone)} · ${c.duration_minutes} min · ${home ? 'Home tutoring' : 'Online'}. This page updates by itself every few seconds.`}
        actions={<Badge tone={c.status === 'completed' ? 'green' : c.status === 'cancelled' ? 'red' : 'blue'}>{c.status}</Badge>}
      />
      {c.status === 'cancelled' && <div className="mb-4"><Alert tone="warning">This class was cancelled.</Alert></div>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          {/* Where the lesson happens */}
          <section className={`tile ${home ? 'bg-tile-peach' : 'bg-tile-sky'}`} aria-label="Where the lesson happens">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {home ? <MapPin size={18} aria-hidden="true" /> : <MonitorPlay size={18} aria-hidden="true" />} {home ? 'Home lesson' : 'Online lesson'}
                </h2>
                {home ? (
                  <p className="mt-1 text-sm text-ink/75">{c.venue || 'No venue has been entered for this lesson.'}</p>
                ) : (
                  <p className="mt-1 break-all text-sm text-ink/75">{c.meeting_url || 'No meeting link yet. Create a room, or paste a Google Meet or Zoom link on the class details page.'}</p>
                )}
                {home && c.tutor_en_route_at && <p className="mt-2 text-sm font-medium">Family told you were on your way at <LocalTime iso={c.tutor_en_route_at} format="time" fallbackZone={timezone} />.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {home && mapUrl && <ButtonLink href={mapUrl} external variant="outline" size="sm">Open in Maps</ButtonLink>}
                {!home && c.meeting_url && <ButtonLink href={c.meeting_url} external size="sm">Start lesson</ButtonLink>}
              </div>
            </div>
            {scheduled && (
              <div className="mt-4 flex flex-wrap gap-3 border-t border-ink/10 pt-4">
                {home
                  ? <ActionForm action={tutorOnTheWayAction} submitLabel="Tell the family I am on my way" variant="secondary" size="sm" hidden={{ id: c.id }} />
                  : !c.meeting_url && <ActionForm action={createMeetingRoomAction} submitLabel="Create online room" variant="secondary" size="sm" hidden={{ id: c.id }} />}
                {home && <span className="flex items-center gap-1.5 text-xs text-ink/65"><Car size={14} aria-hidden="true" /> Sends a notification to the learner and parents.</span>}
              </div>
            )}
          </section>

          {/* Quick checks */}
          <Card>
            <SectionHeading title="Quick checks" count={pollList.length} />
            <p className="-mt-2 mb-4 text-sm text-muted">Ask one question during the lesson. Learners answer on their own device; they see the answer and totals when you close it.</p>
            {scheduled || c.status === 'completed' ? (
              <details className="mb-4 rounded-2xl bg-sunken p-4" open={pollList.length === 0}>
                <summary className="text-sm font-semibold text-link">Open a new quick check</summary>
                <div className="mt-3">
                  <ActionForm action={createPollAction} submitLabel="Open quick check" size="sm" hidden={{ id: c.id }} resetOnSuccess>
                    <div><label htmlFor="question" className="label">Question</label><input id="question" name="question" required maxLength={500} className="field" /></div>
                    <div><label htmlFor="options" className="label">Options (one per line, up to 6)</label><textarea id="options" name="options" rows={3} required className="field" placeholder={'0.34\n0.75\n0.43'} /></div>
                    <div className="max-w-xs">
                      <label htmlFor="correct" className="label">Correct option number</label>
                      <input id="correct" name="correct" type="number" min={1} max={6} className="field" aria-describedby="correct-hint" />
                      <p id="correct-hint" className="mt-1 text-xs text-muted">Leave blank for an opinion or “how are we doing?” question.</p>
                    </div>
                  </ActionForm>
                </div>
              </details>
            ) : null}
            <ul className="space-y-4">
              {pollList.map((p) => (
                <li key={p.id} className={`rounded-2xl p-4 ${p.status === 'open' ? 'bg-tile-sun' : 'bg-sunken'}`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{p.question}</p>
                    <Badge tone={p.status === 'open' ? 'orange' : 'neutral'}>{p.status === 'open' ? `Open · ${p.answers ?? 0} of ${members.length} answered` : `Closed · ${p.answers ?? 0} answered`}</Badge>
                  </div>
                  <PollResults poll={p} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status === 'open' && <ActionForm action={closePollAction} submitLabel="Close and reveal" variant="secondary" size="sm" hidden={{ id: c.id, poll_id: p.id }} />}
                    <ActionForm action={deletePollAction} submitLabel="Delete" variant="outline" size="sm" hidden={{ id: c.id, poll_id: p.id }} confirm="Delete this quick check and its answers?" />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Questions */}
          <Card>
            <SectionHeading title="Questions from learners" count={unanswered} />
            {questions?.length ? (
              <ul className="space-y-4">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-2xl bg-sunken p-4">
                    <p className="flex items-start gap-2 font-medium"><HelpCircle size={18} className="mt-0.5 shrink-0 text-link" aria-hidden="true" /> {q.body}</p>
                    <p className="mt-1 text-xs text-muted">{one(q.student)?.full_name} · <LocalTime iso={q.created_at} fallbackZone={timezone} /></p>
                    {q.answer && <p className="mt-3 whitespace-pre-line rounded-xl bg-tile-mint p-3 text-sm"><span className="font-semibold">Your answer: </span>{q.answer}</p>}
                    <div className="mt-3">
                      <ActionForm action={answerQuestionAction} submitLabel={q.answer ? 'Update answer' : 'Send answer'} variant="secondary" size="sm" hidden={{ id: c.id, question_id: q.id }}>
                        <div>
                          <label htmlFor={`a-${q.id}`} className="sr-only">Answer</label>
                          <textarea id={`a-${q.id}`} name="answer" rows={2} required defaultValue={q.answer ?? ''} className="field" placeholder="Write your answer…" />
                        </div>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No questions yet. Learners can ask before, during or after the lesson; only you and that learner’s family see each question.</p>}
          </Card>

          {/* Recap */}
          <Card>
            <SectionHeading title="Lesson recap and homework" />
            <ActionForm action={saveRecapAction} submitLabel="Save recap" hidden={{ id: c.id }}>
              <div><label htmlFor="recap" className="label">What we covered</label><textarea id="recap" name="recap" rows={4} defaultValue={c.recap ?? ''} className="field" /></div>
              <div><label htmlFor="homework" className="label">Homework or practice before next time</label><textarea id="homework" name="homework" rows={3} defaultValue={c.homework ?? ''} className="field" /></div>
              <div>
                <label htmlFor="recording_url" className="label">Recording link (optional)</label>
                <input id="recording_url" name="recording_url" type="url" defaultValue={c.recording_url ?? ''} placeholder="https://…" className="field" aria-describedby="rec-hint" />
                <p id="rec-hint" className="mt-1 text-xs text-muted">Paste a link to a recording you have stored elsewhere. Only learners in this class can see it here.</p>
              </div>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="notify" defaultChecked className="h-5 w-5" /> Notify the learners and parents</label>
            </ActionForm>
          </Card>
        </div>

        {/* Right column */}
        <aside className="space-y-4" aria-label="Attendance, understanding and materials">
          <Card>
            <SectionHeading title="Who is coming" />
            {members.length ? (
              <ul className="space-y-2">
                {members.map((m) => {
                  const r = rsvpBy.get(m.id);
                  return (
                    <li key={m.id} className="rounded-2xl bg-sunken px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/owner/students/${m.id}`} className="min-w-0 truncate text-sm font-semibold hover:underline">{m.name}</Link>
                        {r?.response === 'attending' && <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ok"><CheckCircle2 size={16} aria-hidden="true" /> Coming</span>}
                        {r?.response === 'not_attending' && <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-bad"><XCircle size={16} aria-hidden="true" /> Cannot attend</span>}
                        {!r && <span className="shrink-0 text-sm text-muted">No reply yet</span>}
                      </div>
                      {r?.note && <p className="mt-1 text-xs text-muted">“{r.note}”</p>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">No students are in this class yet.</p>}
            <p className="mt-3 text-xs text-muted">Confirmations are a courtesy from the family. The register on the class page is still the attendance record.</p>
          </Card>

          <Card>
            <SectionHeading title="How well they understood" count={feedback?.length ?? 0} />
            {feedback?.length ? (
              <ul className="space-y-2">
                {feedback.map((f, i) => (
                  <li key={i} className={`rounded-2xl px-3 py-2.5 ${f.understanding <= 2 ? 'bg-tile-rose' : 'bg-tile-mint'}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold">{one(f.student)?.full_name}</span>
                      <span className="shrink-0 font-semibold">{UNDERSTANDING[f.understanding]} ({f.understanding}/4)</span>
                    </div>
                    {f.comment && <p className="mt-1 text-sm text-ink/80">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Learners can rate their understanding once the lesson has started.</p>}
          </Card>

          <Card>
            <SectionHeading title="Materials for this lesson" count={attachedList.length} />
            <ul className="mb-3 space-y-2">
              {attachedList.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-2xl bg-sunken px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{m.title}</span>
                  <ActionForm action={detachMaterialAction} submitLabel="Remove" variant="outline" size="sm" hidden={{ id: c.id, material_id: m.id }} />
                </li>
              ))}
            </ul>
            {(library ?? []).some((m) => !attachedIds.has(m.id)) ? (
              <ActionForm action={attachMaterialAction} submitLabel="Attach" variant="secondary" size="sm" hidden={{ id: c.id }}>
                <div>
                  <label htmlFor="material_id" className="label">Add from your resources</label>
                  <select id="material_id" name="material_id" required defaultValue="" className="field">
                    <option value="" disabled>Select…</option>
                    {(library ?? []).filter((m) => !attachedIds.has(m.id)).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              </ActionForm>
            ) : <p className="text-sm text-muted">Upload files under <Link href="/owner/resources" className="text-link underline">Resources</Link>, then attach them here.</p>}
          </Card>
        </aside>
      </div>
    </>
  );
}
