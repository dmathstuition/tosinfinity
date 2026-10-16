'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { optionalEnv } from '@/lib/env';
import { notifyFamilies } from '@/lib/notify';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';

const path = (id: string) => `/owner/classes/${id}/room`;

async function classStudents(supabase: Awaited<ReturnType<typeof ownerContext>>['supabase'], id: string): Promise<string[]> {
  const { data } = await supabase.from('class_students').select('student_id').eq('class_id', id);
  return (data ?? []).map((r) => r.student_id);
}

/**
 * Creates an online room link for the class on the configured Jitsi server.
 * The room name is random and unguessable; only people given the link can find it.
 */
export async function createMeetingRoomAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const domain = (optionalEnv('JITSI_DOMAIN') ?? 'meet.jit.si').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const url = `https://${domain}/Tosinfinity-${randomBytes(9).toString('hex')}`;
  const { error } = await supabase.from('classes').update({ meeting_url: url, delivery: 'online' }).eq('id', id).eq('status', 'scheduled');
  if (error) return fail('Could not create the room.');
  revalidatePath(path(id));
  revalidatePath(`/owner/classes/${id}`);
  return ok('Online room created. Learners will see a Join button 15 minutes before the start.');
}

/** Home lessons: lets the family know the tutor has set off. */
export async function tutorOnTheWayAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const { data: c } = await supabase.from('classes').update({ tutor_en_route_at: new Date().toISOString() }).eq('id', id).eq('status', 'scheduled').select('title').maybeSingle();
  if (!c) return fail('This class is not scheduled.');
  await notifyFamilies(supabase, await classStudents(supabase, id), { title: 'Your tutor is on the way', body: c.title, path: `/classes/${id}` });
  revalidatePath(path(id));
  return ok('The family has been told you are on your way.');
}

export async function createPollAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const question = str(fd, 'question', 500);
  const options = str(fd, 'options', 2000).split('\n').map((o) => o.trim().slice(0, 200)).filter(Boolean).slice(0, 6);
  const correctRaw = str(fd, 'correct');
  if (question.length < 3) return fail('Write the question.');
  if (options.length < 2) return fail('Give at least two options, one per line.');
  let correct: number | null = null;
  if (correctRaw) {
    const n = Number(correctRaw);
    if (!Number.isInteger(n) || n < 1 || n > options.length) return fail(`The correct option must be a number from 1 to ${options.length}, or left blank for an opinion question.`);
    correct = n - 1;
  }
  const limitRaw = str(fd, 'time_limit');
  let timeLimit: number | null = null;
  if (limitRaw) {
    timeLimit = Number(limitRaw);
    if (!Number.isInteger(timeLimit) || timeLimit < 5 || timeLimit > 600) return fail('The time limit must be between 5 and 600 seconds, or left blank.');
  }
  const points = fd.get('points') === 'on';
  if (points && correct === null) return fail('Points need a correct option. Enter the number of the correct option.');
  const { error } = await supabase.from('class_polls').insert({ class_id: id, question, options, correct_index: correct, time_limit_seconds: timeLimit, points });
  if (error) return fail('Could not open the quick check.');
  await notifyFamilies(supabase, await classStudents(supabase, id), { title: 'Quick check open', body: question.slice(0, 120), path: `/classes/${id}` });
  revalidatePath(path(id));
  return ok('Quick check opened. Learners can answer now.');
}

export async function closePollAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const poll = str(fd, 'poll_id');
  if (!isUuid(poll)) return fail('Unknown quick check.');
  await supabase.from('class_polls').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', poll);
  revalidatePath(path(str(fd, 'id')));
  return ok('Closed. Learners can now see the answer and the totals.');
}

export async function deletePollAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const poll = str(fd, 'poll_id');
  if (!isUuid(poll)) return fail('Unknown quick check.');
  await supabase.from('class_polls').delete().eq('id', poll);
  revalidatePath(path(str(fd, 'id')));
  return ok('Removed.');
}

export async function answerQuestionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const q = str(fd, 'question_id');
  const answer = str(fd, 'answer', 3000);
  if (!isUuid(q)) return fail('Unknown question.');
  if (answer.length < 2) return fail('Write an answer.');
  // The database notifies the learner and their parents when the answer is saved.
  const { error } = await supabase.from('class_questions').update({ answer, answered_at: new Date().toISOString() }).eq('id', q);
  if (error) return fail('Could not save the answer.');
  revalidatePath(path(str(fd, 'id')));
  return ok('Answer sent.');
}

export async function saveRecapAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown class.');
  const recording = str(fd, 'recording_url', 500);
  if (recording) {
    try {
      if (new URL(recording).protocol !== 'https:') throw new Error('not https');
    } catch {
      return fail('The recording link must be a full https:// address.');
    }
  }
  const recap = str(fd, 'recap', 5000);
  const homework = str(fd, 'homework', 3000);
  const { data: c, error } = await supabase
    .from('classes')
    .update({ recap: recap || null, homework: homework || null, recording_url: recording || null, recap_at: recap || homework || recording ? new Date().toISOString() : null })
    .eq('id', id)
    .select('title')
    .maybeSingle();
  if (error || !c) return fail('Could not save the recap.');
  if (fd.get('notify') === 'on' && (recap || homework || recording)) {
    await notifyFamilies(supabase, await classStudents(supabase, id), { title: 'Lesson recap posted', body: c.title, path: `/classes/${id}` });
  }
  revalidatePath(path(id));
  return ok(fd.get('notify') === 'on' ? 'Recap saved and families notified.' : 'Recap saved.');
}

export async function attachMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  const material = str(fd, 'material_id');
  if (!isUuid(id) || !isUuid(material)) return fail('Choose a resource.');
  const { error } = await supabase.from('class_materials').upsert({ class_id: id, material_id: material }, { onConflict: 'class_id,material_id', ignoreDuplicates: true });
  if (error) return fail('Could not attach the resource.');
  revalidatePath(path(id));
  return ok('Attached. Learners in this class can open it.');
}

export async function detachMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  const material = str(fd, 'material_id');
  if (!isUuid(id) || !isUuid(material)) return fail('Unknown resource.');
  await supabase.from('class_materials').delete().eq('class_id', id).eq('material_id', material);
  revalidatePath(path(id));
  return ok('Removed from this lesson.');
}
