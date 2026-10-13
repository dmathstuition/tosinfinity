'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ensureAuthUser, rollbackUsers, sendActivation } from '@/lib/accounts';
import { parseMoney } from '@/lib/billing';
import { publicEnv } from '@/lib/env';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { studentSchema, type StudentInput } from '@/lib/validation/student';

const NEED_ADMIN = 'Creating accounts needs SUPABASE_SERVICE_ROLE_KEY on the server. See README.md.';

/** Shared by "Add student" and CSV import. The caller has already verified the Owner. */
async function createStudent(
  supabase: Awaited<ReturnType<typeof ownerContext>>['supabase'],
  input: StudentInput,
): Promise<{ ok: true; id: string; code: string; emailed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  let user: { id: string; created: boolean } | null = null;
  try {
    user = await ensureAuthUser(admin, input.email);
    const { email, ...fields } = input;
    const { data: code, error } = await supabase.rpc('create_student_profile', { p_user: user.id, p_email: email, p_fields: fields });
    if (error) {
      await rollbackUsers(admin, [user]);
      return { ok: false, error: error.message.includes('already belongs') ? 'That email already belongs to an account.' : 'Could not create the student.' };
    }
    const mail = await sendActivation({ email, name: input.full_name, role: 'student', studentCode: String(code) });
    return { ok: true, id: user.id, code: String(code), emailed: mail.ok };
  } catch {
    if (user) await rollbackUsers(admin, [user]);
    return { ok: false, error: 'Could not create the student.' };
  }
}

export async function createStudentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  if (!adminConfigured()) return fail(NEED_ADMIN);
  const parsed = studentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const result = await createStudent(supabase, parsed.data);
  if (!result.ok) return fail(result.error);
  revalidatePath('/owner/students');
  redirect(`/owner/students/${result.id}?created=${result.emailed ? 'emailed' : 'noemail'}`);
}

export type ImportResult = { line: number; email: string; ok: boolean; message: string };

/** Rows are validated again here: the browser preview is a convenience, not a control. */
export async function importStudentsAction(rows: Array<{ line: number; data: Record<string, string> }>): Promise<{ error?: string; results: ImportResult[] }> {
  const { supabase, audit } = await ownerContext();
  if (!adminConfigured()) return { error: NEED_ADMIN, results: [] };
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'There are no rows to import.', results: [] };
  if (rows.length > 200) return { error: 'Import up to 200 students at a time.', results: [] };

  const results: ImportResult[] = [];
  for (const row of rows) {
    const parsed = studentSchema.safeParse(row.data);
    if (!parsed.success) {
      results.push({ line: row.line, email: row.data.email ?? '', ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid row' });
      continue;
    }
    const r = await createStudent(supabase, parsed.data);
    results.push({
      line: row.line,
      email: parsed.data.email,
      ok: r.ok,
      message: r.ok ? `Created ${r.code}${r.emailed ? '' : ' (activation email not sent)'}` : r.error,
    });
  }
  await audit('students.imported', 'profile', null, { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
  revalidatePath('/owner/students');
  return { results };
}

export async function updateStudentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown student.');
  // Email is the login and is changed separately; validate the rest with the shared schema.
  const parsed = studentSchema.omit({ email: true }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const d = parsed.data;
  const status = str(fd, 'status') === 'inactive' ? 'inactive' : 'active';
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: d.full_name, phone: d.phone || null, date_of_birth: d.date_of_birth || null, school_year: d.school_year || null,
      curriculum: d.curriculum || null, location: d.location || null, learning_needs: d.learning_needs || null,
      goals: d.goals || null, delivery: d.delivery || null, status,
    })
    .eq('id', id)
    .eq('role', 'student');
  if (error) return fail('Could not save the changes.');
  await audit('student.updated', 'profile', id, { status });
  revalidatePath(`/owner/students/${id}`);
  return ok('Student details saved.');
}

export async function updateBillingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { currency } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown student.');
  const mode = z.enum(['hourly', 'flat_monthly', 'flat_term', '']).safeParse(str(fd, 'billing_mode'));
  if (!mode.success) return fail('Choose a billing mode.');
  const hourlyRaw = str(fd, 'hourly_rate');
  const flatRaw = str(fd, 'flat_fee');
  const hourly = hourlyRaw ? parseMoney(hourlyRaw, currency) : null;
  const flat = flatRaw ? parseMoney(flatRaw, currency) : null;
  if ((hourlyRaw && hourly === null) || (flatRaw && flat === null)) return fail('Enter amounts as numbers, for example 5000 or 5000.50.');
  if (mode.data === 'hourly' && !hourly) return fail('Enter the agreed hourly rate.');
  if ((mode.data === 'flat_monthly' || mode.data === 'flat_term') && !flat) return fail('Enter the agreed flat fee.');
  const { error } = await supabase
    .from('profiles')
    .update({ billing_mode: mode.data || null, hourly_rate_minor: hourly, flat_fee_minor: flat, bill_absences: fd.get('bill_absences') === 'on' })
    .eq('id', id)
    .eq('role', 'student');
  if (error) return fail('Could not save billing settings.');
  await audit('student.billing_updated', 'profile', id, { mode: mode.data });
  revalidatePath(`/owner/students/${id}`);
  return ok('Billing settings saved.');
}

export async function addNoteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  const body = str(fd, 'body', 4000);
  if (!isUuid(id) || !body) return fail('Write a note first.');
  const { error } = await supabase.from('student_notes').insert({ student_id: id, body });
  if (error) return fail('Could not save the note.');
  revalidatePath(`/owner/students/${id}`);
  return ok('Note added.');
}

export async function linkParentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  if (!adminConfigured()) return fail(NEED_ADMIN);
  const studentId = str(fd, 'id');
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, 'Enter the parent’s name').max(120),
      email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
      phone: z.string().trim().max(30),
      relationship: z.string().trim().max(40),
    })
    .safeParse(Object.fromEntries(fd));
  if (!isUuid(studentId)) return fail('Unknown student.');
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');

  const admin = createAdminClient();
  let user: { id: string; created: boolean } | null = null;
  try {
    user = await ensureAuthUser(admin, parsed.data.email);
    const { error } = await supabase.rpc('link_parent', {
      p_parent_user: user.id, p_student: studentId, p_full_name: parsed.data.full_name,
      p_email: parsed.data.email, p_phone: parsed.data.phone, p_relationship: parsed.data.relationship,
    });
    if (error) {
      await rollbackUsers(admin, [user]);
      return fail(error.message.includes('cannot be linked') ? 'That email belongs to a student or owner account and cannot be linked as a parent.' : 'Could not link the parent.');
    }
    let note = 'They already have an account and can now see this student.';
    if (user.created) {
      const mail = await sendActivation({ email: parsed.data.email, name: parsed.data.full_name, role: 'parent' });
      note = mail.ok ? 'An activation link has been emailed.' : 'The activation email could not be sent; use “Send activation link”.';
    }
    revalidatePath(`/owner/students/${studentId}`);
    return ok(`Parent linked. ${note}`);
  } catch {
    if (user) await rollbackUsers(admin, [user]);
    return fail('Could not link the parent.');
  }
}

export async function unlinkParentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const linkId = str(fd, 'link_id');
  const studentId = str(fd, 'id');
  if (!isUuid(linkId)) return fail('Unknown link.');
  const { error } = await supabase.from('parent_student_links').delete().eq('id', linkId);
  if (error) return fail('Could not remove the link.');
  await audit('parent.unlinked', 'profile', studentId, { link_id: linkId });
  revalidatePath(`/owner/students/${studentId}`);
  return ok('Parent access removed.');
}

export async function sendActivationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  if (!adminConfigured()) return fail(NEED_ADMIN);
  const id = str(fd, 'profile_id');
  if (!isUuid(id)) return fail('Unknown account.');
  const { data: p } = await supabase.from('profiles').select('email, full_name, role, student_code').eq('id', id).maybeSingle();
  if (!p || p.role === 'owner') return fail('Unknown account.');
  const mail = await sendActivation({ email: p.email, name: p.full_name, role: p.role, studentCode: p.student_code ?? undefined });
  return mail.ok ? ok(`A password link has been emailed to ${p.email}.`) : fail('The email could not be sent. Check the email settings in README.md.');
}

export async function enrolAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  const programme = str(fd, 'programme_id');
  if (!isUuid(id) || !isUuid(programme)) return fail('Choose a programme.');
  const { error } = await supabase.from('student_enrolments').insert({ student_id: id, programme_id: programme });
  if (error) return fail(error.code === '23505' ? 'The student is already enrolled on that programme.' : 'Could not enrol the student.');
  revalidatePath(`/owner/students/${id}`);
  return ok('Enrolled.');
}

export async function endEnrolmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const enrolment = str(fd, 'enrolment_id');
  if (!isUuid(enrolment)) return fail('Unknown enrolment.');
  await supabase.from('student_enrolments').update({ status: 'ended', ended_on: new Date().toISOString().slice(0, 10) }).eq('id', enrolment);
  revalidatePath(`/owner/students/${str(fd, 'id')}`);
  return ok('Enrolment ended.');
}

/** Read-only guardian link. Only the hash is stored; the link is shown to the Owner once. */
export async function createGuardianLinkAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  const days = Math.min(90, Math.max(1, Number(str(fd, 'days')) || 14));
  if (!isUuid(id)) return fail('Unknown student.');
  const token = randomBytes(32).toString('base64url');
  const { error } = await supabase.from('guardian_links').insert({
    student_id: id,
    token_hash: createHash('sha256').update(token).digest('hex'),
    label: str(fd, 'label', 80) || null,
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
  });
  if (error) return fail('Could not create the link.');
  await audit('guardian_link.created', 'profile', id, { days });
  revalidatePath(`/owner/students/${id}`);
  return ok(`Copy this link now; it will not be shown again. It expires in ${days} days: ${publicEnv.siteUrl}/guardian/${token}`);
}

export async function revokeGuardianLinkAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const linkId = str(fd, 'link_id');
  if (!isUuid(linkId)) return fail('Unknown link.');
  await supabase.from('guardian_links').update({ revoked_at: new Date().toISOString() }).eq('id', linkId);
  await audit('guardian_link.revoked', 'guardian_link', linkId);
  revalidatePath(`/owner/students/${str(fd, 'id')}`);
  return ok('Link revoked.');
}
