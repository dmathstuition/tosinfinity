'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type SubmitState = { ok: boolean; message: string } | null;
const UUID = /^[0-9a-f-]{36}$/i;

function friendly(message: string): string {
  if (message.includes('already been submitted')) return 'This work has already been handed in and resubmission is not allowed.';
  if (message.includes('not authorised')) return 'This assignment is not available to you.';
  if (message.includes('nothing to submit')) return 'Type your answer or upload a file before submitting.';
  return 'Your work could not be submitted. Please try again.';
}

/** Written work. The database function checks the assignment, the attempt rules and the file path. */
export async function submitWrittenAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const profile = await requireRole('student');
  const assignment = String(formData.get('assignment_id') ?? '');
  if (!UUID.test(assignment)) return { ok: false, message: 'Unknown assignment.' };
  if (!(await rateLimit('submit', profile.id, 20, 3600))) return { ok: false, message: 'Too many submissions. Please try again later.' };
  const body = String(formData.get('body') ?? '').trim().slice(0, 20000);
  const filePath = String(formData.get('file_path') ?? '').slice(0, 500);
  const { error } = await createClient().rpc('submit_written', { p_assignment: assignment, p_body: body, p_file_path: filePath || null });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath(`/portal/assignments/${assignment}`);
  return { ok: true, message: 'Submitted. Your tutor has been notified.' };
}

/** Quiz answers are marked inside the database; the browser never receives the correct answers. */
export async function submitQuizAction(assignment: string, answers: Record<string, number>): Promise<SubmitState> {
  const profile = await requireRole('student');
  if (!UUID.test(assignment)) return { ok: false, message: 'Unknown quiz.' };
  if (!(await rateLimit('submit', profile.id, 20, 3600))) return { ok: false, message: 'Too many submissions. Please try again later.' };
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers ?? {}).slice(0, 200)) {
    if (UUID.test(k) && Number.isInteger(v) && v >= 0 && v < 20) clean[k] = v;
  }
  const { error } = await createClient().rpc('submit_quiz', { p_assignment: assignment, p_answers: clean });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath(`/portal/assignments/${assignment}`);
  return { ok: true, message: 'Submitted.' };
}
