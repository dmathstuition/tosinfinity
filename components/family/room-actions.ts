'use server';

import { revalidatePath } from 'next/cache';
import { getSessionProfile } from '@/lib/auth';
import { rateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export type RoomState = { ok: boolean; message: string } | null;
const UUID = /^[0-9a-f-]{36}$/i;

function friendly(message: string): string {
  if (message.includes('already started')) return 'This lesson has already started, so the confirmation can no longer be changed.';
  if (message.includes('already answered')) return 'You have already answered this one.';
  if (message.includes('closed')) return 'This quick check has been closed.';
  if (message.includes('time is up')) return 'Time ran out for this quick check.';
  if (message.includes('question limit')) return 'You have reached the limit of questions for this lesson.';
  if (message.includes('once the lesson has started')) return 'You can do this once the lesson has started.';
  if (message.includes('not authorised')) return 'This lesson is not available to you.';
  return 'That did not work. Please try again.';
}

async function session(limitKey: string, max: number) {
  const profile = await getSessionProfile();
  if (!profile || profile.role === 'owner') return { error: 'Please sign in again.' } as const;
  if (!(await rateLimit(limitKey, profile.id, max, 600))) return { error: 'You are doing that very quickly. Please wait a moment.' } as const;
  return { profile, supabase: createClient() } as const;
}

/**
 * The database functions called here decide who may act: the learner must be in the
 * class, and a parent may only confirm attendance for a child linked to them.
 */
export async function rsvpAction(_prev: RoomState, formData: FormData): Promise<RoomState> {
  const s = await session('room-rsvp', 30);
  if ('error' in s) return { ok: false, message: s.error ?? '' };
  const classId = String(formData.get('class_id') ?? '');
  const studentId = String(formData.get('student_id') ?? '');
  const response = String(formData.get('response') ?? '');
  if (!UUID.test(classId) || !UUID.test(studentId)) return { ok: false, message: 'Unknown lesson.' };
  const { error } = await s.supabase.rpc('set_class_rsvp', {
    p_class: classId, p_student: studentId, p_response: response, p_note: String(formData.get('note') ?? '').slice(0, 300),
  });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath('/', 'layout');
  return { ok: true, message: response === 'attending' ? 'Thank you. Your tutor knows you are coming.' : 'Thank you for letting us know. Your tutor has been told.' };
}

export async function askQuestionAction(_prev: RoomState, formData: FormData): Promise<RoomState> {
  const s = await session('room-question', 15);
  if ('error' in s) return { ok: false, message: s.error ?? '' };
  const classId = String(formData.get('class_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 1000);
  if (!UUID.test(classId)) return { ok: false, message: 'Unknown lesson.' };
  if (body.length < 3) return { ok: false, message: 'Type your question first.' };
  const { error } = await s.supabase.rpc('ask_class_question', { p_class: classId, p_body: body });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath(`/portal/classes/${classId}`);
  return { ok: true, message: 'Sent to your tutor.' };
}

export async function answerPollAction(pollId: string, classId: string, choice: number): Promise<RoomState> {
  const s = await session('room-poll', 60);
  if ('error' in s) return { ok: false, message: s.error ?? '' };
  if (!UUID.test(pollId) || !UUID.test(classId) || !Number.isInteger(choice) || choice < 0 || choice > 10) return { ok: false, message: 'Choose an option.' };
  const { error } = await s.supabase.rpc('answer_class_poll', { p_poll: pollId, p_choice: choice });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath(`/portal/classes/${classId}`);
  return { ok: true, message: 'Answer recorded.' };
}

export async function feedbackAction(_prev: RoomState, formData: FormData): Promise<RoomState> {
  const s = await session('room-feedback', 20);
  if ('error' in s) return { ok: false, message: s.error ?? '' };
  const classId = String(formData.get('class_id') ?? '');
  const understanding = Number(formData.get('understanding'));
  if (!UUID.test(classId)) return { ok: false, message: 'Unknown lesson.' };
  if (![1, 2, 3, 4].includes(understanding)) return { ok: false, message: 'Choose how well you understood.' };
  const { error } = await s.supabase.rpc('submit_class_feedback', {
    p_class: classId, p_understanding: understanding, p_comment: String(formData.get('comment') ?? '').slice(0, 1000),
  });
  if (error) return { ok: false, message: friendly(error.message) };
  revalidatePath(`/portal/classes/${classId}`);
  return { ok: true, message: 'Thank you. Your tutor will see this.' };
}
