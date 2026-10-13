import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { defaultBillable } from '@/lib/billing';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { formatDateTime, utcToZonedInput } from '@/lib/time';
import { cancelClassAction, saveAttendanceAction, updateClassAction } from '../actions';
import { ClassFields } from '../ClassFields';

export const metadata = { title: 'Class' };
const STATUSES = ['present', 'late', 'absent', 'excused'] as const;

export default async function ClassPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data: c } = await supabase.from('classes').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();

  const [{ data: roster }, { data: attendance }, { data: students }, { data: programmes }] = await Promise.all([
    supabase.from('class_students').select('student_id, student:profiles(id, full_name, student_code, bill_absences)').eq('class_id', c.id),
    supabase.from('attendance').select('*').eq('class_id', c.id),
    supabase.from('profiles').select('id, full_name, student_code').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('programmes').select('id, title').order('sort_order'),
  ]);
  const members = (roster ?? []).map((r) => (Array.isArray(r.student) ? r.student[0] : r.student)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const recorded = new Map((attendance ?? []).map((a) => [a.student_id, a]));
  const cancelled = c.status === 'cancelled';

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/classes" className="text-link hover:underline">← Classes</Link></p>
      <PageHeader
        title={c.title}
        description={`${formatDateTime(c.starts_at, timezone)} (${timezone}) · ${c.duration_minutes} min · ${c.delivery === 'home' ? 'Home tutoring' : 'Online'}`}
        actions={
          <>
            <Badge tone={c.status === 'completed' ? 'green' : cancelled ? 'red' : 'blue'}>{c.status}</Badge>
            <ButtonLink href={`/owner/classes/${c.id}/room`} size="sm">Lesson room</ButtonLink>
            {c.meeting_url && !cancelled && <ButtonLink href={c.meeting_url} external variant="outline" size="sm">Open meeting</ButtonLink>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Attendance register</h2>
          {cancelled ? (
            <div className="mt-3"><Alert tone="warning">This class was cancelled, so there is no register.</Alert></div>
          ) : members.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Add students to this class to take a register.</p>
          ) : (
            <>
              <p className="mb-4 mt-1 text-sm text-muted">
                Saving marks the class as completed. Lesson minutes feed hourly invoices only when “Billable” is ticked.
                Excused lessons are never billed, and an absence is billed only if that student’s billing policy allows it.
              </p>
              <ActionForm action={saveAttendanceAction} submitLabel="Save register" hidden={{ id: c.id }}>
                <ul className="space-y-4">
                  {members.map((s) => {
                    const a = recorded.get(s.id);
                    const status = a?.status ?? 'present';
                    return (
                      <li key={s.id} className="rounded-xl border border-line p-3">
                        <fieldset>
                          <legend className="font-medium">{s.full_name} <span className="text-sm font-normal text-muted">{s.student_code}</span></legend>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {STATUSES.map((st) => (
                              <label key={st} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm capitalize has-[:checked]:border-royal has-[:checked]:bg-royal/10">
                                <input type="radio" name={`status_${s.id}`} value={st} defaultChecked={status === st} required className="accent-[rgb(var(--royal))]" />
                                {st}
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 grid grid-cols-[7rem_1fr] items-end gap-3">
                            <div>
                              <label htmlFor={`minutes_${s.id}`} className="label">Minutes taught</label>
                              <input id={`minutes_${s.id}`} name={`minutes_${s.id}`} type="number" min={0} max={600} defaultValue={a?.actual_minutes ?? c.duration_minutes} className="field" />
                            </div>
                            <div>
                              <label htmlFor={`note_${s.id}`} className="label">Note</label>
                              <input id={`note_${s.id}`} name={`note_${s.id}`} defaultValue={a?.note ?? ''} maxLength={300} className="field" />
                            </div>
                          </div>
                          <label className="mt-3 flex items-center gap-2 text-sm">
                            <input type="checkbox" name={`billable_${s.id}`} defaultChecked={a ? a.billable : defaultBillable('present', s.bill_absences)} className="h-5 w-5 accent-[rgb(var(--royal))]" />
                            Billable
                            {!s.bill_absences && <span className="text-xs text-muted">(ignored if marked absent)</span>}
                          </label>
                        </fieldset>
                      </li>
                    );
                  })}
                </ul>
              </ActionForm>
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <ActionForm action={updateClassAction} submitLabel="Save changes" variant="secondary" hidden={{ id: c.id }}>
              <ClassFields
                values={{ ...c, starts_local: utcToZonedInput(c.starts_at, timezone) }}
                students={students ?? []}
                selected={members.map((m) => m.id)}
                programmes={programmes ?? []}
                timezone={timezone}
              />
            </ActionForm>
            <p className="mt-3 text-xs text-muted">Changing the date or time notifies the affected families.</p>
          </Card>
          {c.status === 'scheduled' && (
            <Card>
              <h2 className="text-lg font-semibold">Cancel class</h2>
              <p className="mb-3 mt-1 text-sm text-muted">Families are notified. The class stays on record as cancelled.</p>
              <ActionForm action={cancelClassAction} submitLabel="Cancel this class" variant="danger" size="sm" hidden={{ id: c.id }} confirm="Cancel this class and notify the families?" />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
