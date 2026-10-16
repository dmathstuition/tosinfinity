'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { emailConfigured, sendEmail } from '@/lib/email';
import { familyRecipients, notifyFamilies } from '@/lib/notify';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { formatDateTime, zonedToUtc } from '@/lib/time';

const schema = z.object({
  title: z.string().trim().min(2, 'Give the assignment a title').max(160),
  instructions: z.string().trim().max(10000),
  kind: z.enum(['written', 'quiz', 'timed']),
  due_local: z.string().optional(),
  max_marks: z.coerce.number().positive('Total marks must be greater than zero').max(1000),
  time_limit_minutes: z.union([z.literal(''), z.coerce.number().int().min(1).max(600)]).optional(),
  programme_id: z.string().optional(),
});

/** One criterion per line: "Method shown | 4". */
function parseRubric(text: string): Array<{ criterion: string; marks: number }> {
  return text
    .split('\n')
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter((p) => p[0])
    .slice(0, 20)
    .map(([criterion, marks]) => ({ criterion: criterion!.slice(0, 200), marks: Math.max(0, Number(marks) || 0) }));
}

async function readForm(fd: FormData, timezone: string) {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;
  const due = d.due_local ? zonedToUtc(d.due_local, timezone) : null;
  if (d.due_local && !due) return { ok: false as const, error: 'Enter a valid due date.' };
  if (d.kind === 'timed' && !d.time_limit_minutes) return { ok: false as const, error: 'Timed practice needs a time limit.' };
  return {
    ok: true as const,
    students: fd.getAll('students').map(String).filter(isUuid),
    row: {
      title: d.title, instructions: d.instructions, kind: d.kind, due_at: due?.toISOString() ?? null, max_marks: d.max_marks,
      time_limit_minutes: d.kind === 'written' || !d.time_limit_minutes ? null : Number(d.time_limit_minutes),
      randomise: fd.get('randomise') === 'on', allow_resubmission: fd.get('allow_resubmission') === 'on',
      rubric: parseRubric(str(fd, 'rubric', 4000)),
      programme_id: d.programme_id && isUuid(d.programme_id) ? d.programme_id : null,
    },
  };
}

export async function createAssignmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const form = await readForm(fd, timezone);
  if (!form.ok) return fail(form.error);
  if (form.students.length === 0) return fail('Select at least one student.');
  // Always created as a draft: quizzes need questions before they can be published.
  const { data, error } = await supabase.from('assignments').insert({ ...form.row, published: false }).select('id').single();
  if (error) return fail('Could not create the assignment.');
  await supabase.from('assignment_students').insert(form.students.map((s) => ({ assignment_id: data.id, student_id: s })));
  redirect(`/owner/assignments/${data.id}`);
}

export async function updateAssignmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown assignment.');
  const form = await readForm(fd, timezone);
  if (!form.ok) return fail(form.error);
  if (form.students.length === 0) return fail('Select at least one student.');
  const { error } = await supabase.from('assignments').update(form.row).eq('id', id);
  if (error) return fail('Could not save the assignment.');
  await supabase.from('assignment_students').delete().eq('assignment_id', id).not('student_id', 'in', `(${form.students.join(',')})`);
  await supabase.from('assignment_students').upsert(form.students.map((s) => ({ assignment_id: id, student_id: s })), { onConflict: 'assignment_id,student_id', ignoreDuplicates: true });
  revalidatePath(`/owner/assignments/${id}`);
  return ok('Assignment saved.');
}

export async function setPublishedAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  const publish = str(fd, 'publish') === 'true';
  if (!isUuid(id)) return fail('Unknown assignment.');
  const { data: a } = await supabase.from('assignments').select('title, kind, due_at, published').eq('id', id).maybeSingle();
  if (!a) return fail('Unknown assignment.');
  if (publish && a.kind !== 'written') {
    const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('assignment_id', id);
    if (!count) return fail('Add at least one question before publishing.');
  }
  await supabase.from('assignments').update({ published: publish }).eq('id', id);
  if (publish && !a.published) {
    const { data: students } = await supabase.from('assignment_students').select('student_id').eq('assignment_id', id);
    const due = a.due_at ? formatDateTime(a.due_at, timezone) : 'no due date';
    await notifyFamilies(
      supabase, (students ?? []).map((s) => s.student_id),
      { title: 'New assignment', body: `${a.title} (due ${due})`, path: '/assignments' },
      { template: 'assignmentDue', data: (r) => ({ name: r.full_name, title: a.title, due }) },
    );
  }
  revalidatePath(`/owner/assignments/${id}`);
  return ok(publish ? 'Published. Students can now see it.' : 'Unpublished. Students can no longer see it.');
}

export async function addQuestionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown assignment.');
  const prompt = str(fd, 'prompt', 2000);
  const options = str(fd, 'options', 4000).split('\n').map((o) => o.trim()).filter(Boolean).slice(0, 8);
  const correct = Number(str(fd, 'correct'));
  const marks = Number(str(fd, 'marks')) || 1;
  const topic = str(fd, 'topic', 80);
  if (prompt.length < 3) return fail('Write the question.');
  if (options.length < 2) return fail('Give at least two answer options, one per line.');
  if (!Number.isInteger(correct) || correct < 1 || correct > options.length) return fail(`The correct option must be a number from 1 to ${options.length}.`);
  if (marks <= 0 || marks > 100) return fail('Marks must be between 1 and 100.');
  const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('assignment_id', id);
  const { error } = await supabase.from('quiz_questions').insert({ assignment_id: id, position: (count ?? 0) + 1, prompt, options, correct_index: correct - 1, marks, topic: topic || null });
  if (error) return fail('Could not add the question.');
  revalidatePath(`/owner/assignments/${id}`);
  return ok('Question added.');
}

export async function deleteQuestionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const q = str(fd, 'question_id');
  if (!isUuid(q)) return fail('Unknown question.');
  await supabase.from('quiz_questions').delete().eq('id', q);
  revalidatePath(`/owner/assignments/${str(fd, 'id')}`);
  return ok('Question removed.');
}

export async function gradeSubmissionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'submission_id');
  if (!isUuid(id)) return fail('Unknown submission.');
  const score = Number(str(fd, 'score'));
  const { data: sub } = await supabase.from('submissions').select('score, status, student_id, assignment:assignments(id, title, max_marks)').eq('id', id).maybeSingle();
  const a = sub ? (Array.isArray(sub.assignment) ? sub.assignment[0] : sub.assignment) : null;
  if (!sub || !a) return fail('Unknown submission.');
  if (!Number.isFinite(score) || score < 0 || score > Number(a.max_marks)) return fail(`Enter a mark between 0 and ${Number(a.max_marks)}.`);

  const { error } = await supabase
    .from('submissions')
    .update({ score, feedback: str(fd, 'feedback', 5000) || null, status: 'graded', graded_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return fail('Could not save the mark.');
  // Every mark, and every change to a mark, is recorded.
  await audit(sub.status === 'graded' ? 'grade.changed' : 'grade.recorded', 'submission', id, { from: sub.score, to: score });
  if (sub.status === 'graded') {
    await notifyFamilies(supabase, [sub.student_id], { title: 'Mark updated', body: a.title, path: '/assignments' });
  } else if (emailConfigured()) {
    // First mark: the database trigger raises the in-app notification; this adds the email.
    const recipients = (await familyRecipients(supabase, [sub.student_id])).get(sub.student_id) ?? [];
    await Promise.all(recipients.map((r) => sendEmail('assignmentGraded', r.email, { name: r.full_name, title: a.title })));
  }
  revalidatePath(`/owner/assignments/${a.id}`);
  return ok('Mark and feedback saved.');
}

export async function deleteAssignmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown assignment.');
  const { count } = await supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', id);
  if (count) return fail('This assignment has submissions, so it cannot be deleted. Unpublish it instead.');
  await supabase.from('assignments').delete().eq('id', id);
  await audit('assignment.deleted', 'assignment', id);
  redirect('/owner/assignments');
}
