'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { defaultBillable } from '@/lib/billing';
import { notifyFamilies } from '@/lib/notify';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { formatDateTime, overlaps, zonedToUtc } from '@/lib/time';

const baseSchema = z.object({
  title: z.string().trim().min(2, 'Give the class a title').max(120),
  starts_local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Choose a date and start time'),
  duration_minutes: z.coerce.number().int().min(10, 'Duration must be at least 10 minutes').max(600),
  delivery: z.enum(['home', 'online'], { errorMap: () => ({ message: 'Choose home or online' }) }),
  venue: z.string().trim().max(200).optional(),
  meeting_url: z.string().trim().max(500).optional(),
  objectives: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
  programme_id: z.string().optional(),
});

function meetingUrl(raw: string | undefined): { ok: true; url: string | null } | { ok: false } {
  if (!raw) return { ok: true, url: null };
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' ? { ok: true, url: u.toString() } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function where(delivery: string, venue: string | null) {
  return delivery === 'online' ? 'Online. Join from your portal timetable.' : `Home tutoring${venue ? ` at ${venue}` : ''}.`;
}

export async function createClassAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { timezone } = await academyLocale();
  const parsed = baseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const d = parsed.data;
  const students = fd.getAll('students').map(String).filter(isUuid);
  if (students.length === 0) return fail('Select at least one student.');
  const link = meetingUrl(d.meeting_url);
  if (!link.ok) return fail('The meeting link must be a full https:// address.');
  const weeks = Math.min(26, Math.max(1, Number(str(fd, 'repeat_weeks')) || 1));

  const first = zonedToUtc(d.starts_local, timezone);
  if (!first) return fail('Choose a valid date and time.');
  // Weekly recurrence is computed in academy wall-clock time so it stays at the same
  // local hour across any daylight-saving change.
  const starts: Date[] = [];
  for (let w = 0; w < weeks; w++) {
    const local = new Date(`${d.starts_local.slice(0, 16)}:00Z`);
    local.setUTCDate(local.getUTCDate() + w * 7);
    const utc = zonedToUtc(local.toISOString().slice(0, 16), timezone);
    if (utc) starts.push(utc);
  }

  const windowStart = new Date(first.getTime() - 12 * 3600_000).toISOString();
  const windowEnd = new Date(starts[starts.length - 1]!.getTime() + 12 * 3600_000).toISOString();
  const { data: existing } = await supabase
    .from('classes')
    .select('title, starts_at, duration_minutes')
    .neq('status', 'cancelled')
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd);
  const clashes = starts.flatMap((s) =>
    (existing ?? []).filter((e) => overlaps(s, d.duration_minutes, new Date(e.starts_at), e.duration_minutes)).map((e) => `${e.title} (${formatDateTime(e.starts_at, timezone)})`),
  );
  if (clashes.length && fd.get('allow_conflicts') !== 'on') {
    return fail(`Scheduling conflict with: ${[...new Set(clashes)].slice(0, 4).join('; ')}. Change the time, or tick “Schedule anyway”.`);
  }

  const seriesId = weeks > 1 ? randomUUID() : null;
  const rows = starts.map((s) => ({
    series_id: seriesId, title: d.title, programme_id: d.programme_id && isUuid(d.programme_id) ? d.programme_id : null,
    starts_at: s.toISOString(), duration_minutes: d.duration_minutes, delivery: d.delivery,
    venue: d.venue || null, meeting_url: link.url, objectives: d.objectives || null, notes: d.notes || null,
  }));
  const { data: created, error } = await supabase.from('classes').insert(rows).select('id, starts_at');
  if (error) return fail(error.code === '23505' ? 'A class with this title already exists at that date and time.' : 'Could not schedule the class.');

  const { error: linkError } = await supabase.from('class_students').insert(created.flatMap((c) => students.map((s) => ({ class_id: c.id, student_id: s }))));
  if (linkError) {
    await supabase.from('classes').delete().in('id', created.map((c) => c.id));
    return fail('Could not add the students, so nothing was scheduled.');
  }
  await audit('class.created', 'class', created[0]!.id, { sessions: created.length });
  await notifyFamilies(supabase, students, {
    title: weeks > 1 ? `${weeks} classes scheduled` : 'Class scheduled',
    body: `${d.title}: ${formatDateTime(first, timezone)}`,
    path: '/timetable',
  });
  revalidatePath('/owner/classes');
  redirect(weeks > 1 ? '/owner/classes' : `/owner/classes/${created[0]!.id}`);
}

export async function updateClassAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const parsed = baseSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const d = parsed.data;
  const link = meetingUrl(d.meeting_url);
  if (!link.ok) return fail('The meeting link must be a full https:// address.');
  const starts = zonedToUtc(d.starts_local, timezone);
  if (!starts) return fail('Choose a valid date and time.');
  const students = fd.getAll('students').map(String).filter(isUuid);
  if (students.length === 0) return fail('Select at least one student.');

  const { data: before } = await supabase.from('classes').select('starts_at, status').eq('id', id).maybeSingle();
  if (!before) return fail('Unknown class.');
  const moved = new Date(before.starts_at).getTime() !== starts.getTime();

  if (moved) {
    const { data: near } = await supabase
      .from('classes').select('id, title, starts_at, duration_minutes').neq('status', 'cancelled').neq('id', id)
      .gte('starts_at', new Date(starts.getTime() - 12 * 3600_000).toISOString())
      .lte('starts_at', new Date(starts.getTime() + 12 * 3600_000).toISOString());
    const clash = (near ?? []).find((e) => overlaps(starts, d.duration_minutes, new Date(e.starts_at), e.duration_minutes));
    if (clash && fd.get('allow_conflicts') !== 'on') {
      return fail(`Scheduling conflict with ${clash.title} (${formatDateTime(clash.starts_at, timezone)}). Change the time, or tick “Schedule anyway”.`);
    }
  }

  const { error } = await supabase
    .from('classes')
    .update({
      title: d.title, starts_at: starts.toISOString(), duration_minutes: d.duration_minutes, delivery: d.delivery,
      venue: d.venue || null, meeting_url: link.url, objectives: d.objectives || null, notes: d.notes || null,
      programme_id: d.programme_id && isUuid(d.programme_id) ? d.programme_id : null,
    })
    .eq('id', id);
  if (error) return fail(error.code === '23505' ? 'Another class with this title already exists at that time.' : 'Could not save the class.');

  // Replace the participant list; attendance already recorded for removed students is kept.
  await supabase.from('class_students').delete().eq('class_id', id).not('student_id', 'in', `(${students.join(',')})`);
  await supabase.from('class_students').upsert(students.map((s) => ({ class_id: id, student_id: s })), { onConflict: 'class_id,student_id', ignoreDuplicates: true });

  if (moved && before.status === 'scheduled') {
    const when = formatDateTime(starts, timezone);
    await audit('class.rescheduled', 'class', id, { from: before.starts_at, to: starts.toISOString() });
    await notifyFamilies(
      supabase, students,
      { title: 'Class rescheduled', body: `${d.title} is now ${when}`, path: '/timetable' },
      { template: 'upcomingClass', data: (r) => ({ name: r.full_name, title: `${d.title} (rescheduled)`, when: `${when} (${timezone} time)`, where: where(d.delivery, d.venue || null) }) },
    );
  }
  revalidatePath(`/owner/classes/${id}`);
  revalidatePath('/owner/classes');
  return ok(moved ? 'Class rescheduled. Affected families have been notified.' : 'Class saved.');
}

export async function cancelClassAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const { data: c } = await supabase
    .from('classes').update({ status: 'cancelled' }).eq('id', id).eq('status', 'scheduled').select('title, starts_at').maybeSingle();
  if (!c) return fail('Only a scheduled class can be cancelled.');
  const { data: students } = await supabase.from('class_students').select('student_id').eq('class_id', id);
  await audit('class.cancelled', 'class', id);
  await notifyFamilies(supabase, (students ?? []).map((s) => s.student_id), {
    title: 'Class cancelled', body: `${c.title} on ${formatDateTime(c.starts_at, timezone)} has been cancelled.`, path: '/timetable',
  });
  revalidatePath('/owner/classes');
  revalidatePath(`/owner/classes/${id}`);
  return ok('Class cancelled and families notified.');
}

const STATUSES = ['present', 'absent', 'late', 'excused'] as const;

/** Saves the register for every listed student and marks the class completed. */
export async function saveAttendanceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const { data: cls } = await supabase.from('classes').select('duration_minutes, status').eq('id', id).maybeSingle();
  if (!cls || cls.status === 'cancelled') return fail('This class cannot take a register.');
  const { data: roster } = await supabase.from('class_students').select('student_id, student:profiles(bill_absences)').eq('class_id', id);
  if (!roster?.length) return fail('This class has no students.');

  const rows = [];
  for (const r of roster) {
    const status = STATUSES.find((s) => s === str(fd, `status_${r.student_id}`));
    if (!status) return fail('Choose an attendance status for every student.');
    const attended = status === 'present' || status === 'late';
    const minutesRaw = Number(str(fd, `minutes_${r.student_id}`));
    const minutes = Number.isFinite(minutesRaw) ? Math.min(600, Math.max(0, Math.round(minutesRaw))) : cls.duration_minutes;
    const profile = Array.isArray(r.student) ? r.student[0] : r.student;
    // The Owner's explicit tick decides. With no tick, an absence is billable only when
    // that student's "bill absences" policy is on; excused lessons are never billable.
    const ticked = fd.get(`billable_${r.student_id}`) === 'on';
    const billable = status === 'excused' ? false : attended ? ticked : ticked && defaultBillable('absent', Boolean(profile?.bill_absences));
    rows.push({
      class_id: id, student_id: r.student_id, status,
      actual_minutes: attended || billable ? minutes : 0,
      billable, note: str(fd, `note_${r.student_id}`, 300) || null, recorded_at: new Date().toISOString(),
    });
  }
  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'class_id,student_id' });
  if (error) return fail('Could not save the register.');
  await supabase.from('classes').update({ status: 'completed' }).eq('id', id);
  await audit('attendance.recorded', 'class', id, { students: rows.length });
  revalidatePath(`/owner/classes/${id}`);
  revalidatePath('/owner');
  return ok('Register saved and class marked as completed.');
}
