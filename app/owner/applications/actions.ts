'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ensureAuthUser, rollbackUsers, sendActivation } from '@/lib/accounts';
import { sendEmail } from '@/lib/email';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export async function saveNotesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown application.');
  const status = str(fd, 'status');
  const patch: Record<string, unknown> = { internal_notes: str(fd, 'internal_notes', 4000) || null };
  if (status === 'new' || status === 'in_review') patch.status = status;
  // Decided applications keep their status; only notes change.
  const { error } = await supabase.from('applications').update(patch).eq('id', id).in('status', ['new', 'in_review']);
  if (error) return fail('Could not save.');
  revalidatePath(`/owner/applications/${id}`);
  return ok('Saved.');
}

export async function rejectApplicationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  const reason = str(fd, 'reason', 1000);
  if (!isUuid(id)) return fail('Unknown application.');
  if (reason.length < 5) return fail('Please give a short reason. It is included in the email to the family.');
  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'rejected', rejection_reason: reason, decided_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['new', 'in_review'])
    .select('guardian_name, guardian_email, student_name')
    .maybeSingle();
  if (error || !data) return fail('This application has already been decided.');
  await audit('application.rejected', 'application', id);
  const mail = await sendEmail('applicationRejected', data.guardian_email, { guardianName: data.guardian_name, studentName: data.student_name, reason });
  revalidatePath('/owner/applications');
  return ok(mail.ok ? 'Application rejected and the family has been emailed.' : 'Application rejected. The email could not be sent, so please contact the family directly.');
}

/**
 * Approve: create logins, then one database transaction creates the student profile,
 * student ID, verified parent link and marks the application approved. If that
 * transaction fails, any login created here is removed, so nothing is left half-made.
 */
export async function approveApplicationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext(); // verifies Owner (+ second factor) before any privileged work
  if (!adminConfigured()) return fail('Approval needs SUPABASE_SERVICE_ROLE_KEY to create accounts. See README.md.');
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown application.');

  const studentEmail = emailSchema.safeParse(str(fd, 'student_email'));
  if (!studentEmail.success) return fail('Enter a valid email address for the student’s login.');
  const createParent = fd.get('create_parent') === 'on';

  const { data: app } = await supabase.from('applications').select('*').eq('id', id).maybeSingle();
  if (!app) return fail('Application not found.');
  if (app.status === 'approved') return fail('This application has already been approved.');
  if (createParent && studentEmail.data === String(app.guardian_email).toLowerCase()) {
    return fail('The student and the parent need different email addresses, because each has their own login.');
  }

  const admin = createAdminClient();
  const created: Array<{ id: string; created: boolean }> = [];
  try {
    const student = await ensureAuthUser(admin, studentEmail.data);
    created.push(student);
    const parent = createParent ? await ensureAuthUser(admin, app.guardian_email) : null;
    if (parent) created.push(parent);

    // Runs as the Owner's own session: the function re-checks is_owner() in the database.
    const { data: code, error } = await supabase.rpc('approve_application', {
      p_application: id,
      p_student_user: student.id,
      p_student_email: studentEmail.data,
      p_parent_user: parent?.id ?? null,
    });
    if (error) {
      await rollbackUsers(admin, created);
      return fail(friendly(error.message));
    }

    const results = await Promise.all([
      sendActivation({ email: studentEmail.data, name: app.student_name, role: 'student', studentCode: String(code) }),
      // An existing parent already has a password: they are linked, not re-invited.
      parent?.created ? sendActivation({ email: app.guardian_email, name: app.guardian_name, role: 'parent' }) : Promise.resolve({ ok: true as const }),
    ]);
    revalidatePath('/owner/applications');
    revalidatePath('/owner/students');
    const emailed = results.every((r) => r.ok);
    return ok(
      `Approved. Student ID ${code}.` +
        (emailed ? ' Activation links have been emailed.' : ' The activation email could not be sent: open the student’s profile and use “Send activation link” once email is configured.'),
    );
  } catch (e) {
    await rollbackUsers(admin, created);
    console.error('[approve] failed', e instanceof Error ? e.message : '');
    return fail('Approval could not be completed. Nothing was changed.');
  }
}

function friendly(message: string): string {
  if (message.includes('already approved')) return 'This application has already been approved.';
  if (message.includes('already has a profile')) return 'That student email already belongs to an existing account. Use a different email.';
  if (message.includes('non-parent')) return 'The guardian’s email belongs to a student or owner account, so it cannot be linked as a parent.';
  return 'Approval could not be completed. Nothing was changed.';
}

export async function markContactHandledAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown message.');
  await supabase.from('contact_messages').update({ handled_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/owner/applications');
  return ok('Marked as handled.');
}
