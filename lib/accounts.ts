import 'server-only';
import { createPasswordLink } from '@/lib/auth-links';
import { sendEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Account provisioning. CALLERS MUST HAVE VERIFIED THE OWNER (requireOwner) FIRST:
 * these helpers use the service role to create logins.
 *
 * No password is ever generated or emailed. New users receive a single-use link
 * and choose their own password.
 */
type Admin = ReturnType<typeof createAdminClient>;

/** Returns the login for an email, creating it if needed. `created` tells the caller whether to roll back on failure. */
export async function ensureAuthUser(admin: Admin, email: string): Promise<{ id: string; created: boolean }> {
  const normalised = email.trim().toLowerCase();
  const { data: existing } = await admin.rpc('auth_user_id_by_email', { p_email: normalised });
  if (typeof existing === 'string') return { id: existing, created: false };
  const { data, error } = await admin.auth.admin.createUser({ email: normalised, email_confirm: true });
  if (error || !data.user) throw new Error('Could not create the login for ' + normalised);
  return { id: data.user.id, created: true };
}

/** Remove logins created during a workflow that then failed, so nothing is left half-made. */
export async function rollbackUsers(admin: Admin, users: Array<{ id: string; created: boolean }>) {
  for (const u of users) if (u.created) await admin.auth.admin.deleteUser(u.id).catch(() => {});
}

export async function sendActivation(args: { email: string; name: string; role: 'student' | 'parent'; studentCode?: string }) {
  const link = await createPasswordLink(args.email);
  if (!link) return { ok: false as const, error: 'Could not create an activation link.' };
  const childNames = args.role === 'parent' ? await linkedChildNames(args.email) : undefined;
  const result = await sendEmail('accountActivation', args.email, {
    name: args.name, link, role: args.role, studentCode: args.studentCode, email: args.email, childNames,
  });
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? 'Email was not sent.' };
}

/** First names of the learners a parent (by email) is linked to, for the welcome email. */
async function linkedChildNames(email: string): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data: parent } = await admin.from('profiles').select('id').eq('email', email).eq('role', 'parent').maybeSingle();
    if (!parent) return [];
    const { data } = await admin.from('parent_student_links').select('student:profiles!parent_student_links_student_id_fkey(full_name)').eq('parent_id', parent.id);
    return (data ?? []).map((r) => (Array.isArray(r.student) ? r.student[0] : r.student)?.full_name?.split(' ')[0]).filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}
