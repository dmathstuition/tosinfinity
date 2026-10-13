'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileUpload } from '@/components/portal/FileUpload';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { submitQuizAction, submitWrittenAction } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit work'}</Button>;
}

export function WrittenForm({ assignmentId, studentId }: { assignmentId: string; studentId: string }) {
  const [state, action] = useFormState(submitWrittenAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <div>
        <label htmlFor="body" className="label">Your answer</label>
        <textarea id="body" name="body" rows={8} maxLength={20000} className="field" aria-describedby="body-hint" />
        <p id="body-hint" className="mt-1 text-xs text-muted">Type your answer, upload a file, or both.</p>
      </div>
      {/* The folder is <your id>/<assignment id>; storage rules reject uploads anywhere else. */}
      <FileUpload bucket="submissions" folder={`${studentId}/${assignmentId}`} label="Upload your work (optional)" />
      {state && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <div><SubmitButton /></div>
    </form>
  );
}

type Question = { id: string; prompt: string; options: string[]; marks: number };

export function QuizRunner({ assignmentId, questions, endsAt }: { assignmentId: string; questions: Question[]; endsAt: string | null }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const submitted = useRef(false);
  const router = useRouter();

  const submit = useCallback(
    (auto = false) => {
      if (submitted.current) return;
      if (!auto && Object.keys(answers).length < questions.length && !window.confirm('Some questions are unanswered. Submit anyway?')) return;
      submitted.current = true;
      start(async () => {
        const res = await submitQuizAction(assignmentId, answers);
        if (res?.ok) router.replace(`/portal/assignments/${assignmentId}`);
        else {
          submitted.current = false;
          setMessage(res?.message ?? 'Could not submit.');
        }
      });
    },
    [answers, assignmentId, questions.length, router],
  );

  // Countdown from the server-recorded start time; submits automatically at zero.
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) submit(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt, submit]);

  const mm = remaining === null ? '' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-5">
      {remaining !== null && (
        <div className="sticky top-16 z-10 rounded-xl border border-orange bg-surface px-4 py-2 text-center font-heading font-semibold shadow-card" role="timer" aria-label={`Time remaining ${mm}`}>
          Time remaining: <span className="tabular-nums">{mm}</span>
        </div>
      )}
      <ol className="grid gap-5">
        {questions.map((q, i) => (
          <li key={q.id} className="card p-5">
            <fieldset>
              <legend className="font-medium">{i + 1}. {q.prompt} <span className="text-sm font-normal text-muted">({q.marks} mark{q.marks === 1 ? '' : 's'})</span></legend>
              <div className="mt-3 grid gap-2">
                {q.options.map((o, j) => (
                  <label key={j} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 has-[:checked]:border-royal has-[:checked]:bg-royal/5">
                    <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === j} onChange={() => setAnswers((a) => ({ ...a, [q.id]: j }))} className="h-5 w-5 accent-[rgb(var(--royal))]" />
                    <span className="text-sm">{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {message && <Alert tone="error">{message}</Alert>}
      <p className="text-sm text-muted" aria-live="polite">{Object.keys(answers).length} of {questions.length} answered</p>
      <div><Button type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit answers'}</Button></div>
    </form>
  );
}
