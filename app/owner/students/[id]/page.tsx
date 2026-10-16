import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocalTime } from '@/components/portal/LocalTime';
import { StudentFields } from '@/components/portal/StudentFields';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader, Stat } from '@/components/ui/primitives';
import { formatMoney, minorUnits } from '@/lib/billing';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { behaviourBalance, CONCERN_CATEGORIES, MERIT_CATEGORIES } from '@/lib/behaviour';
import { formatDate } from '@/lib/time';
import {
  addBehaviourAction, addNoteAction, createGuardianLinkAction, deleteBehaviourAction, endEnrolmentAction, enrolAction, linkParentAction, revokeGuardianLinkAction,
  sendActivationAction, unlinkParentAction, updateBillingAction, updateStudentAction,
} from '../actions';

export const metadata = { title: 'Student' };

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function StudentPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { currency, timezone } = await academyLocale();
  const id = params.id;

  const { data: s } = await supabase.from('profiles').select('*').eq('id', id).eq('role', 'student').maybeSingle();
  if (!s) notFound();

  const nowIso = new Date().toISOString();
  const [links, enrolments, programmes, notes, upcoming, attendance, results, reports, invoices, materials, guardianLinks, behaviour] = await Promise.all([
    supabase.from('parent_student_links').select('id, relationship, verified_at, parent:profiles!parent_student_links_parent_id_fkey(id, full_name, email, phone)').eq('student_id', id),
    supabase.from('student_enrolments').select('id, status, started_on, ended_on, programme:programmes(title)').eq('student_id', id).order('started_on', { ascending: false }),
    supabase.from('programmes').select('id, title').order('sort_order'),
    supabase.from('student_notes').select('id, body, created_at').eq('student_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('class_students').select('class:classes!inner(id, title, starts_at, delivery, status)').eq('student_id', id).gte('class.starts_at', nowIso).eq('class.status', 'scheduled').limit(6),
    supabase.from('attendance').select('status, actual_minutes, class:classes(title, starts_at)').eq('student_id', id).order('recorded_at', { ascending: false }).limit(200),
    supabase.from('submissions').select('id, score, status, submitted_at, assignment:assignments(id, title, max_marks)').eq('student_id', id).order('submitted_at', { ascending: false }).limit(12),
    supabase.from('reports').select('id, period_start, period_end, status').eq('student_id', id).order('period_end', { ascending: false }).limit(6),
    supabase.from('invoices').select('id, number, total_minor, paid_minor, currency, status, due_date').eq('student_id', id).order('created_at', { ascending: false }).limit(6),
    supabase.from('material_students').select('material:materials(id, title)').eq('student_id', id).limit(10),
    supabase.from('guardian_links').select('id, label, expires_at, revoked_at, created_at').eq('student_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('behaviour_notes').select('id, kind, category, note, points, created_at').eq('student_id', id).order('created_at', { ascending: false }).limit(30),
  ]);
  const conduct = behaviourBalance(behaviour.data ?? []);

  const att = attendance.data ?? [];
  const attended = att.filter((a) => a.status === 'present' || a.status === 'late').length;
  const graded = (results.data ?? []).filter((r) => r.status === 'graded' && r.score !== null);
  const pct = (r: (typeof graded)[number]) => {
    const a = one(r.assignment);
    return a ? (Number(r.score) / Number(a.max_marks)) * 100 : 0;
  };
  const average = graded.length ? Math.round(graded.reduce((sum, r) => sum + pct(r), 0) / graded.length) : null;
  const unit = minorUnits(currency);

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/students" className="text-link hover:underline">← Students</Link></p>
      <PageHeader
        title={s.full_name}
        description={`${s.student_code} · ${s.email}`}
        actions={
          <>
            <Badge tone={s.status === 'active' ? 'green' : 'neutral'}>{s.status}</Badge>
            <ButtonLink href={`/owner/messages/new?to=${id}`} variant="outline" size="sm">Message</ButtonLink>
            <ButtonLink href={`/owner/reports?student=${id}`} variant="outline" size="sm">New report</ButtonLink>
            <ButtonLink href={`/owner/billing/new?student=${id}`} variant="outline" size="sm">New invoice</ButtonLink>
          </>
        }
      />
      {searchParams.created === 'emailed' && <div className="mb-5"><Alert tone="success">Student created. An activation link has been emailed to {s.email}.</Alert></div>}
      {searchParams.created === 'noemail' && <div className="mb-5"><Alert tone="warning">Student created, but the activation email could not be sent. Configure email, then use “Send activation link” below.</Alert></div>}

      <section aria-label="Progress summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Attendance" value={att.length ? `${Math.round((attended / att.length) * 100)}%` : '—'} hint={`${attended} of ${att.length} lessons`} />
        <Stat label="Average result" value={average === null ? '—' : `${average}%`} hint={`${graded.length} marked`} />
        <Stat label="Upcoming classes" value={upcoming.data?.length ?? 0} />
        <Stat label="Open invoices" value={(invoices.data ?? []).filter((i) => ['unpaid', 'partially_paid', 'overdue'].includes(i.status)).length} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Student information</h2>
            <ActionForm action={updateStudentAction} submitLabel="Save details" variant="secondary" hidden={{ id }}>
              <StudentFields values={s} />
              <div className="max-w-xs">
                <label htmlFor="status" className="label">Account status</label>
                <select id="status" name="status" defaultValue={s.status} className="field" aria-describedby="status-hint">
                  <option value="active">Active</option><option value="inactive">Inactive (cannot sign in to the portal)</option>
                </select>
                <p id="status-hint" className="mt-1 text-xs text-muted">Records are kept when a student is made inactive.</p>
              </div>
            </ActionForm>
            <div className="mt-5 border-t border-line pt-4">
              <ActionForm action={sendActivationAction} submitLabel="Send activation / password link" variant="outline" size="sm" hidden={{ profile_id: id }} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Progress trend</h2>
            {graded.length ? (
              <ul className="mt-4 space-y-3">
                {graded.slice(0, 8).reverse().map((r) => {
                  const a = one(r.assignment);
                  const p = Math.round(pct(r));
                  return (
                    <li key={r.id}>
                      <div className="flex justify-between gap-3 text-sm">
                        <Link href={`/owner/assignments/${a?.id}`} className="truncate hover:underline">{a?.title}</Link>
                        <span className="shrink-0 tabular-nums">{Number(r.score)}/{Number(a?.max_marks)} ({p}%)</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-line" role="img" aria-label={`${p} percent`}>
                        <div className="h-2 rounded-full bg-royal" style={{ width: `${Math.min(100, p)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No marked work yet.</p>}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Timetable and attendance</h2>
            <h3 className="mt-3 text-sm font-semibold text-muted">Upcoming</h3>
            {upcoming.data?.length ? (
              <ul className="divide-y divide-line">
                {upcoming.data.map((row) => {
                  const c = one(row.class);
                  return c ? (
                    <li key={c.id} className="flex justify-between gap-3 py-2 text-sm">
                      <Link href={`/owner/classes/${c.id}`} className="hover:underline">{c.title}</Link>
                      <span className="text-muted"><LocalTime iso={c.starts_at} fallbackZone={timezone} /></span>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : <p className="text-sm text-muted">No upcoming classes.</p>}
            <h3 className="mt-4 text-sm font-semibold text-muted">Recent attendance</h3>
            {att.length ? (
              <ul className="divide-y divide-line">
                {att.slice(0, 8).map((a, i) => {
                  const c = one(a.class);
                  return (
                    <li key={i} className="flex justify-between gap-3 py-2 text-sm">
                      <span>{c?.title} <span className="text-muted">· {c ? formatDate(c.starts_at) : ''}</span></span>
                      <Badge tone={a.status === 'present' ? 'green' : a.status === 'absent' ? 'red' : 'gold'}>{a.status}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">No attendance recorded yet.</p>}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Teaching notes</h2>
            <p className="mb-3 text-sm text-muted">Private to you. Never shown to the student or parents.</p>
            <ActionForm action={addNoteAction} submitLabel="Add note" variant="secondary" size="sm" hidden={{ id }} resetOnSuccess>
              <div>
                <label htmlFor="body" className="sr-only">New note</label>
                <textarea id="body" name="body" rows={3} required className="field" />
              </div>
            </ActionForm>
            <ul className="mt-4 space-y-3">
              {(notes.data ?? []).map((n) => (
                <li key={n.id} className="rounded-xl bg-cloud p-3 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Billing</h2>
            <p className="mb-4 text-sm text-muted">Amounts in {currency}. Agreed privately with the family.</p>
            <ActionForm action={updateBillingAction} submitLabel="Save billing" variant="secondary" size="sm" hidden={{ id }}>
              <div>
                <label htmlFor="billing_mode" className="label">Billing mode</label>
                <select id="billing_mode" name="billing_mode" defaultValue={s.billing_mode ?? ''} className="field">
                  <option value="">Not billed automatically</option>
                  <option value="hourly">Hourly (lesson time × rate)</option>
                  <option value="flat_monthly">Flat monthly tuition</option>
                  <option value="flat_term">Flat term tuition</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hourly_rate" className="label">Hourly rate</label>
                  <input id="hourly_rate" name="hourly_rate" inputMode="decimal" defaultValue={s.hourly_rate_minor != null ? Number(s.hourly_rate_minor) / unit : ''} className="field" />
                </div>
                <div>
                  <label htmlFor="flat_fee" className="label">Flat fee</label>
                  <input id="flat_fee" name="flat_fee" inputMode="decimal" defaultValue={s.flat_fee_minor != null ? Number(s.flat_fee_minor) / unit : ''} className="field" />
                </div>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="bill_absences" defaultChecked={s.bill_absences} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
                <span>Bill unexcused absences by default. Leave off so an absence is never charged unless you tick it on the register.</span>
              </label>
            </ActionForm>
            <h3 className="mt-5 text-sm font-semibold text-muted">Recent invoices</h3>
            {invoices.data?.length ? (
              <ul className="divide-y divide-line">
                {invoices.data.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/owner/billing/${i.id}`} className="text-link hover:underline">{i.number}</Link>
                    <span className="tabular-nums">{formatMoney(Number(i.total_minor), i.currency)}</span>
                    <Badge tone={i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : 'gold'}>{i.status.replace('_', ' ')}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No invoices yet.</p>}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Parents and guardians</h2>
            <ul className="mt-2 divide-y divide-line">
              {(links.data ?? []).map((l) => {
                const p = one(l.parent);
                return (
                  <li key={l.id} className="py-3 text-sm">
                    <p className="font-medium">{p?.full_name} <span className="font-normal text-muted">({l.relationship})</span></p>
                    <p className="break-all text-muted">{p?.email}{p?.phone ? ` · ${p.phone}` : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p && <ActionForm action={sendActivationAction} submitLabel="Send password link" variant="outline" size="sm" hidden={{ profile_id: p.id }} />}
                      <ActionForm action={unlinkParentAction} submitLabel="Remove access" variant="outline" size="sm" hidden={{ id, link_id: l.id }} confirm="Remove this parent’s access to the student?" />
                    </div>
                  </li>
                );
              })}
            </ul>
            {!links.data?.length && <p className="text-sm text-muted">No parent is linked yet.</p>}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-link">Link a parent</summary>
              <p className="my-2 text-xs text-muted">Linking here is your approval of the relationship. The parent will see this student only.</p>
              <ActionForm action={linkParentAction} submitLabel="Link parent" variant="secondary" size="sm" hidden={{ id }} resetOnSuccess>
                <div><label htmlFor="p_name" className="label">Full name</label><input id="p_name" name="full_name" required className="field" /></div>
                <div><label htmlFor="p_email" className="label">Email</label><input id="p_email" name="email" type="email" required className="field" /></div>
                <div><label htmlFor="p_phone" className="label">Phone</label><input id="p_phone" name="phone" type="tel" className="field" /></div>
                <div><label htmlFor="p_rel" className="label">Relationship</label><input id="p_rel" name="relationship" placeholder="mother, father, guardian" className="field" /></div>
              </ActionForm>
            </details>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Enrolment history</h2>
            <ul className="mt-2 divide-y divide-line">
              {(enrolments.data ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{one(e.programme)?.title}<br /><span className="text-muted">{formatDate(e.started_on)}{e.ended_on ? ` to ${formatDate(e.ended_on)}` : ''}</span></span>
                  {e.status === 'active'
                    ? <ActionForm action={endEnrolmentAction} submitLabel="End" variant="outline" size="sm" hidden={{ id, enrolment_id: e.id }} confirm="End this enrolment?" />
                    : <Badge>{e.status}</Badge>}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <ActionForm action={enrolAction} submitLabel="Enrol" variant="secondary" size="sm" hidden={{ id }}>
                <div>
                  <label htmlFor="programme_id" className="label">Add programme</label>
                  <select id="programme_id" name="programme_id" className="field" required defaultValue="">
                    <option value="" disabled>Select…</option>
                    {(programmes.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </ActionForm>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Reports and materials</h2>
            <h3 className="mt-2 text-sm font-semibold text-muted">Reports</h3>
            {reports.data?.length ? (
              <ul className="divide-y divide-line">
                {reports.data.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 py-2 text-sm">
                    <Link href={`/owner/reports/${r.id}`} className="text-link hover:underline">{formatDate(r.period_start)} to {formatDate(r.period_end)}</Link>
                    <Badge tone={r.status === 'published' ? 'green' : 'neutral'}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No reports yet.</p>}
            <h3 className="mt-4 text-sm font-semibold text-muted">Shared materials</h3>
            {materials.data?.length ? (
              <ul className="list-disc pl-5 text-sm">{materials.data.map((m, i) => <li key={i}>{one(m.material)?.title}</li>)}</ul>
            ) : <p className="text-sm text-muted">Nothing shared directly. <Link className="text-link underline" href="/owner/resources">Open resources</Link></p>}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Behaviour</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Merits and concerns. Unlike private notes, {s.full_name.split(' ')[0]} and their parents see these and are notified.</p>
            <p className="mb-3 flex flex-wrap gap-2 text-sm">
              <Badge tone="green">{conduct.merits} merit points</Badge>
              <Badge tone={conduct.concerns ? 'orange' : 'neutral'}>{conduct.concerns} concern points</Badge>
            </p>
            <ActionForm action={addBehaviourAction} submitLabel="Record" size="sm" hidden={{ id }} resetOnSuccess>
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <div>
                  <label htmlFor="b_kind" className="label">Type</label>
                  <select id="b_kind" name="kind" className="field" defaultValue="merit"><option value="merit">Merit</option><option value="concern">Concern</option></select>
                </div>
                <div><label htmlFor="b_points" className="label">Points</label><input id="b_points" name="points" type="number" min={1} max={10} defaultValue={1} className="field" /></div>
              </div>
              <div>
                <label htmlFor="b_category" className="label">Category</label>
                <input id="b_category" name="category" list="b_categories" required maxLength={60} className="field" placeholder="e.g. Great effort" />
                <datalist id="b_categories">{[...MERIT_CATEGORIES, ...CONCERN_CATEGORIES].map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label htmlFor="b_note" className="label">Note for the family (optional)</label><textarea id="b_note" name="note" rows={2} maxLength={1000} className="field" /></div>
            </ActionForm>
            {(behaviour.data ?? []).length > 0 && (
              <ul className="mt-4 divide-y divide-line">
                {(behaviour.data ?? []).map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <Badge tone={b.kind === 'merit' ? 'green' : 'orange'}>{b.kind === 'merit' ? '+' : '−'}{b.points}</Badge> <span className="font-medium">{b.category}</span>
                      {b.note && <span className="block text-muted">{b.note}</span>}
                      <span className="block text-xs text-muted">{formatDate(b.created_at)}</span>
                    </span>
                    <ActionForm action={deleteBehaviourAction} submitLabel="Remove" variant="outline" size="sm" hidden={{ id, note_id: b.id }} confirm="Remove this entry?" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Read-only guardian link</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Optional. Shares upcoming classes, attendance and published report summaries with someone who has no account. Never shows invoices, notes or messages.</p>
            <ul className="mb-3 divide-y divide-line">
              {(guardianLinks.data ?? []).map((g) => {
                const live = !g.revoked_at && new Date(g.expires_at) > new Date();
                return (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{g.label || 'Guardian link'}<br /><span className="text-muted">{g.revoked_at ? 'Revoked' : `Expires ${formatDate(g.expires_at)}`}</span></span>
                    {live ? <ActionForm action={revokeGuardianLinkAction} submitLabel="Revoke" variant="outline" size="sm" hidden={{ id, link_id: g.id }} /> : <Badge>{g.revoked_at ? 'revoked' : 'expired'}</Badge>}
                  </li>
                );
              })}
            </ul>
            <ActionForm action={createGuardianLinkAction} submitLabel="Create link" variant="outline" size="sm" hidden={{ id }}>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div><label htmlFor="g_label" className="label">For</label><input id="g_label" name="label" placeholder="e.g. Grandmother" className="field" /></div>
                <div><label htmlFor="g_days" className="label">Days valid</label><input id="g_days" name="days" type="number" min={1} max={90} defaultValue={14} className="field" /></div>
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
