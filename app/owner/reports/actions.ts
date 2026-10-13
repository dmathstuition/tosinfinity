'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyFamilies } from '@/lib/notify';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { buildReportFigures, EMPTY_NARRATIVE, type ReportContent } from '@/lib/reports';
import { formatDate } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function createReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const student = str(fd, 'student_id');
  const start = str(fd, 'period_start');
  const end = str(fd, 'period_end');
  if (!isUuid(student)) return fail('Choose a student.');
  if (!DATE.test(start) || !DATE.test(end) || end < start) return fail('Choose a valid reporting period.');
  const figures = await buildReportFigures(supabase, student, start, end, timezone);
  if (!figures) return fail('Could not gather the student’s records.');
  const { data, error } = await supabase
    .from('reports')
    .insert({ student_id: student, period_start: start, period_end: end, content: { ...figures, ...EMPTY_NARRATIVE } })
    .select('id')
    .single();
  if (error) return fail('Could not create the report.');
  redirect(`/owner/reports/${data.id}`);
}

export async function saveReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown report.');
  const { data: r } = await supabase.from('reports').select('student_id, period_start, period_end, content').eq('id', id).maybeSingle();
  if (!r) return fail('Unknown report.');

  let content = r.content as ReportContent;
  if (fd.get('refresh') === 'on') {
    const figures = await buildReportFigures(supabase, r.student_id, r.period_start, r.period_end, timezone);
    if (figures) content = { ...content, ...figures };
  }
  content = {
    ...content,
    student_class: str(fd, 'student_class', 60),
    subjects: str(fd, 'subjects', 500).split(',').map((s) => s.trim()).filter(Boolean),
    strengths: str(fd, 'strengths', 3000),
    improvements: str(fd, 'improvements', 3000),
    comments: str(fd, 'comments', 4000),
    targets: str(fd, 'targets', 3000).split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 12),
    next_steps: str(fd, 'next_steps', 3000),
  };
  const { error } = await supabase.from('reports').update({ content }).eq('id', id);
  if (error) return fail('Could not save the report.');
  revalidatePath(`/owner/reports/${id}`);
  return ok('Report saved.');
}

export async function setReportPublishedAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  const publish = str(fd, 'publish') === 'true';
  if (!isUuid(id)) return fail('Unknown report.');
  const { data: r } = await supabase
    .from('reports')
    .update({ status: publish ? 'published' : 'draft', published_at: publish ? new Date().toISOString() : null })
    .eq('id', id)
    .select('student_id, period_start, period_end')
    .maybeSingle();
  if (!r) return fail('Unknown report.');
  await audit(publish ? 'report.published' : 'report.unpublished', 'report', id);
  if (publish) {
    await notifyFamilies(supabase, [r.student_id], { title: 'New progress report', body: `${formatDate(r.period_start)} to ${formatDate(r.period_end)}`, path: '/reports' });
  }
  revalidatePath(`/owner/reports/${id}`);
  return ok(publish ? 'Published. The student and linked parents can now read it.' : 'Returned to draft. The family can no longer see it.');
}

export async function deleteReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown report.');
  await supabase.from('reports').delete().eq('id', id);
  await audit('report.deleted', 'report', id);
  redirect('/owner/reports');
}

/** Certificates exist only when the Owner explicitly issues one. */
export async function issueCertificateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const student = str(fd, 'student_id');
  const title = str(fd, 'title', 160);
  const issued = str(fd, 'issued_on');
  if (!isUuid(student)) return fail('Choose a student.');
  if (title.length < 3) return fail('Give the certificate a title.');
  const { data, error } = await supabase
    .from('certificates')
    .insert({ student_id: student, title, description: str(fd, 'description', 1000), ...(DATE.test(issued) ? { issued_on: issued } : {}) })
    .select('id')
    .single();
  if (error) return fail('Could not issue the certificate.');
  await audit('certificate.issued', 'certificate', data.id, { title });
  await notifyFamilies(supabase, [student], { title: 'Certificate issued', body: title, path: '/reports' });
  revalidatePath('/owner/reports');
  return ok('Certificate issued.');
}

export async function revokeCertificateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown certificate.');
  await supabase.from('certificates').delete().eq('id', id);
  await audit('certificate.revoked', 'certificate', id);
  revalidatePath('/owner/reports');
  return ok('Certificate withdrawn.');
}
