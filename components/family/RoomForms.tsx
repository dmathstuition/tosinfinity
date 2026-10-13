'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import clsx from 'clsx';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { answerPollAction, askQuestionAction, feedbackAction, rsvpAction, type RoomState } from './room-actions';

function Note({ state }: { state: RoomState }) {
  if (!state) return null;
  return <p role={state.ok ? 'status' : 'alert'} className={clsx('text-sm font-medium', state.ok ? 'text-ok' : 'text-bad')}>{state.message}</p>;
}

/** "I'll be there" / "I can't make it". Used by the learner, or by a parent for their child. */
export function RsvpForm({ classId, studentId, current, note }: { classId: string; studentId: string; current: 'attending' | 'not_attending' | null; note: string | null }) {
  const [state, action] = useFormState(rsvpAction, null);
  const [declining, setDeclining] = useState(current === 'not_attending');
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit" name="response" value="attending"
          aria-pressed={current === 'attending'}
          className={clsx('flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors', current === 'attending' ? 'bg-ok text-white' : 'bg-surface/85 shadow-xs hover:bg-tile-mint')}
        >
          <CheckCircle2 size={18} aria-hidden="true" /> I’ll be there
        </button>
        <button
          type="button" onClick={() => setDeclining(true)}
          aria-pressed={current === 'not_attending'} aria-expanded={declining}
          className={clsx('flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors', current === 'not_attending' ? 'bg-bad text-white' : 'bg-surface/85 shadow-xs hover:bg-tile-rose')}
        >
          <XCircle size={18} aria-hidden="true" /> I can’t make it
        </button>
      </div>
      {declining && (
        <div className="grid gap-2 rounded-2xl bg-surface/85 p-3">
          <label htmlFor={`rsvp-note-${classId}`} className="label !mb-0">Reason (optional)</label>
          <input id={`rsvp-note-${classId}`} name="note" maxLength={300} defaultValue={note ?? ''} className="field" placeholder="For example: school trip that day" />
          <div><Button type="submit" name="response" value="not_attending" variant="outline" size="sm">Tell my tutor I can’t make it</Button></div>
        </div>
      )}
      <Note state={state} />
    </form>
  );
}

function Send({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="secondary" size="sm" disabled={pending}>{pending ? 'Sending…' : label}</Button>;
}

export function QuestionForm({ classId }: { classId: string }) {
  const [state, action] = useFormState(askQuestionAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="class_id" value={classId} />
      <label htmlFor="room-question" className="sr-only">Your question</label>
      <textarea id="room-question" name="body" rows={2} maxLength={1000} required className="field" placeholder="Ask about anything from this lesson…" aria-describedby="room-question-hint" />
      <p id="room-question-hint" className="text-xs text-muted">Only you, your parents and your tutor can see your questions.</p>
      <div className="flex flex-wrap items-center gap-3"><Send label="Ask my tutor" /><Note state={state} /></div>
    </form>
  );
}

/** One open quick check. The answer is final once sent, like putting a hand up in class. */
export function PollAnswer({ pollId, classId, question, options }: { pollId: string; classId: string; question: string; options: string[] }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const submit = () => {
    if (choice === null) return setMessage('Choose an option first.');
    start(async () => {
      const res = await answerPollAction(pollId, classId, choice);
      if (res?.ok) router.refresh();
      else setMessage(res?.message ?? 'That did not work.');
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <fieldset>
        <legend className="font-heading text-lg font-semibold" style={{ color: 'rgb(var(--heading))' }}>{question}</legend>
        <div className="mt-3 grid gap-2">
          {options.map((o, i) => (
            <label key={i} className="flex min-h-[48px] items-center gap-3 rounded-xl bg-surface/85 px-3 py-2 shadow-xs has-[:checked]:bg-navy has-[:checked]:text-white">
              <input type="radio" name={`poll-${pollId}`} checked={choice === i} onChange={() => setChoice(i)} className="h-5 w-5" />
              <span className="text-sm font-medium">{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Sending…' : 'Send my answer'}</Button>
        <p role="alert" className="text-sm font-medium text-bad">{message}</p>
      </div>
    </form>
  );
}

const LEVELS = [
  { value: 4, label: 'Confident', hint: 'I could explain it to someone else' },
  { value: 3, label: 'Mostly there', hint: 'I get most of it' },
  { value: 2, label: 'Unsure', hint: 'I need more practice' },
  { value: 1, label: 'Lost', hint: 'I need this explained again' },
];

export function FeedbackForm({ classId, current, comment }: { classId: string; current: number | null; comment: string | null }) {
  const [state, action] = useFormState(feedbackAction, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="class_id" value={classId} />
      <fieldset>
        <legend className="sr-only">How well did you understand this lesson?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <label key={l.value} className="flex min-h-[56px] items-center gap-3 rounded-xl bg-surface/85 px-3 py-2 shadow-xs has-[:checked]:bg-navy has-[:checked]:text-white">
              <input type="radio" name="understanding" value={l.value} defaultChecked={current === l.value} required className="h-5 w-5" />
              <span className="text-sm"><span className="block font-semibold">{l.label}</span><span className="block opacity-75">{l.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="room-feedback-comment" className="label">Anything you want your tutor to go over again? (optional)</label>
        <textarea id="room-feedback-comment" name="comment" rows={2} maxLength={1000} defaultValue={comment ?? ''} className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3"><Send label={current ? 'Update' : 'Send to my tutor'} /><Note state={state} /></div>
    </form>
  );
}
