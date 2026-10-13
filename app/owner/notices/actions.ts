'use server';

import { revalidatePath } from 'next/cache';
import { emailConfigured, sendEmail } from '@/lib/email';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';

const AUDIENCES = ['everyone', 'all_students', 'all_parents', 'selected'] as const;

export async function publishNoticeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const title = str(fd, 'title', 160);
  const body = str(fd, 'body', 5000);
  const audience = AUDIENCES.find((a) => a === str(fd, 'audience'));
  if (title.length < 3) return fail('Give the announcement a title.');
  if (body.length < 3) return fail('Write the announcement.');
  if (!audience) return fail('Choose who should receive it.');

  // Resolve recipients. "Selected" covers chosen students and/or chosen families
  // (choosing a student with "include parents" adds their verified parents).
  let query = supabase.from('profiles').select('id, full_name, email, role').eq('status', 'active');
  if (audience === 'all_students') query = query.eq('role', 'student');
  else if (audience === 'all_parents') query = query.eq('role', 'parent');
  else if (audience === 'everyone') query = query.in('role', ['student', 'parent']);
  else {
    const chosen = fd.getAll('recipients').map(String).filter(isUuid);
    if (chosen.length === 0) return fail('Select at least one recipient.');
    const ids = new Set(chosen);
    if (fd.get('include_parents') === 'on') {
      const { data: links } = await supabase.from('parent_student_links').select('parent_id').in('student_id', chosen).not('verified_at', 'is', null);
      for (const l of links ?? []) ids.add(l.parent_id);
    }
    query = query.in('id', [...ids]).in('role', ['student', 'parent']);
  }
  const { data: recipients } = await query;
  if (!recipients?.length) return fail('There is nobody in that audience yet.');

  const { data: notice, error } = await supabase
    .from('notices')
    .insert({ title, body, audience, published_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) return fail('Could not publish the announcement.');
  if (audience === 'selected') {
    await supabase.from('notice_recipients').insert(recipients.map((r) => ({ notice_id: notice.id, profile_id: r.id })));
  }
  await supabase.from('notifications').insert(
    recipients.map((r) => ({ user_id: r.id, title: 'Announcement', body: title, href: `${r.role === 'student' ? '/portal' : '/parent'}/notices` })),
  );

  let emailed = 0;
  if (fd.get('send_email') === 'on' && emailConfigured()) {
    // Small batches with a pause keep within provider sending limits.
    for (let i = 0; i < recipients.length; i += 8) {
      const results = await Promise.all(recipients.slice(i, i + 8).map((r) => sendEmail('newAnnouncement', r.email, { name: r.full_name, title })));
      emailed += results.filter((r) => r.ok).length;
      if (i + 8 < recipients.length) await new Promise((res) => setTimeout(res, 1100));
    }
  }
  await audit('notice.published', 'notice', notice.id, { audience, recipients: recipients.length, emailed });
  revalidatePath('/owner/notices');
  const emailNote = fd.get('send_email') === 'on' ? (emailConfigured() ? ` Emailed ${emailed}.` : ' Email is not configured, so no emails were sent.') : '';
  return ok(`Published to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}.${emailNote}`);
}

export async function deleteNoticeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown announcement.');
  await supabase.from('notices').delete().eq('id', id);
  await audit('notice.deleted', 'notice', id);
  revalidatePath('/owner/notices');
  return ok('Announcement removed.');
}
