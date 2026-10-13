import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emailConfigured, sendEmail } from '@/lib/email';
import type { TemplateData, TemplateName } from '@/lib/email/templates';
import { pushConfigured, sendPush } from '@/lib/push';

type Recipient = { id: string; full_name: string; email: string };

/** A student plus every verified parent. Runs as the Owner (RLS permits the read). */
export async function familyRecipients(supabase: SupabaseClient, studentIds: string[]): Promise<Map<string, Recipient[]>> {
  const map = new Map<string, Recipient[]>();
  if (studentIds.length === 0) return map;
  const [{ data: students }, { data: links }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').in('id', studentIds).eq('status', 'active'),
    supabase
      .from('parent_student_links')
      .select('student_id, parent:profiles!parent_student_links_parent_id_fkey(id, full_name, email, status)')
      .in('student_id', studentIds)
      .not('verified_at', 'is', null),
  ]);
  for (const s of students ?? []) map.set(s.id, [s]);
  for (const l of links ?? []) {
    const p = Array.isArray(l.parent) ? l.parent[0] : l.parent;
    if (p && p.status === 'active') map.get(l.student_id)?.push({ id: p.id, full_name: p.full_name, email: p.email });
  }
  return map;
}

/**
 * In-app notification for each family, plus an optional email. Emails are sent in
 * small batches and failures never interrupt the Owner's action.
 */
export async function notifyFamilies<T extends TemplateName>(
  supabase: SupabaseClient,
  studentIds: string[],
  note: { title: string; body: string; path: string },
  email?: { template: T; data: (recipient: Recipient) => TemplateData[T] },
): Promise<void> {
  const unique = [...new Set(studentIds)];
  await Promise.all(
    unique.map((id) => supabase.rpc('owner_notify_family', { p_student: id, p_title: note.title, p_body: note.body, p_path: note.path })),
  );
  const wantsEmail = Boolean(email) && emailConfigured();
  if (!wantsEmail && !pushConfigured()) return;
  const recipients = await familyRecipients(supabase, unique);
  // Device notifications for those who opted in. The portal the link opens depends on the role.
  for (const [studentId, people] of recipients) {
    await sendPush([studentId], { title: note.title, body: note.body, href: '/portal' + note.path });
    await sendPush(people.filter((r) => r.id !== studentId).map((r) => r.id), { title: note.title, body: note.body, href: '/parent' + note.path });
  }
  if (!email || !wantsEmail) return;
  const seen = new Set<string>();
  const queue = [...recipients.values()].flat().filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
  for (let i = 0; i < queue.length; i += 5) {
    await Promise.all(queue.slice(i, i + 5).map((r) => sendEmail(email.template, r.email, email.data(r))));
  }
}
