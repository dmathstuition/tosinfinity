'use client';

import clsx from 'clsx';
import { Check, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AiBuddy } from '@/components/ai/AiBuddy';
import { Button } from '@/components/ui/Button';
import type { DraftQuestion } from '@/lib/ai/questions';
import { draftQuizQuestionsAction } from '../../ai-actions';
import { addDraftQuestionsAction } from '../actions';

/**
 * Draft quiz questions with AI. The Owner checks every question and answer, ticks
 * the ones to keep, and only then are they added (each worth 1 mark, editable after).
 */
export function AiQuestionDrafter({ assignmentId }: { assignmentId: string }) {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('');
  const [count, setCount] = useState(5);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const draft = () => start(async () => {
    setMessage(null);
    const res = await draftQuizQuestionsAction(topic, level, count);
    if (res.error || !res.questions) return setMessage({ ok: false, text: res.error ?? 'No questions were produced.' });
    setDrafts(res.questions);
    setKeep(new Set(res.questions.map((_, i) => i)));
  });
  const add = () => start(async () => {
    const chosen = drafts.filter((_, i) => keep.has(i));
    const res = await addDraftQuestionsAction(assignmentId, chosen);
    setMessage({ ok: res?.ok ?? false, text: res?.message ?? 'Done.' });
    if (res?.ok) { setDrafts([]); setKeep(new Set()); router.refresh(); }
  });
  const toggle = (i: number) => setKeep((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="rounded-2xl bg-tile-mint p-4">
      <h3 className="flex items-center gap-2 font-semibold"><AiBuddy size={28} /> Draft questions with AI</h3>
      <p className="mt-1 text-sm text-ink/75">Check every question and answer before adding. Only the topic and level are sent to the AI.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_6rem]">
        <div><label htmlFor="ai_topic" className="label">Topic</label><input id="ai_topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} className="field" placeholder="e.g. Quadratic equations" /></div>
        <div><label htmlFor="ai_level" className="label">Level (optional)</label><input id="ai_level" value={level} onChange={(e) => setLevel(e.target.value)} maxLength={100} className="field" placeholder="e.g. SS2, WAEC" /></div>
        <div><label htmlFor="ai_count" className="label">How many</label><input id="ai_count" type="number" min={1} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="field" /></div>
      </div>
      <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={pending || topic.trim().length < 2} onClick={draft}>
        <Sparkles size={16} aria-hidden="true" /> {pending && !drafts.length ? 'Drafting…' : 'Draft questions'}
      </Button>

      {drafts.length > 0 && (
        <div className="mt-4">
          <ol className="space-y-3">
            {drafts.map((q, i) => (
              <li key={i} className={clsx('rounded-xl bg-surface p-3 ring-2', keep.has(i) ? 'ring-orange' : 'ring-transparent opacity-70')}>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={keep.has(i)} onChange={() => toggle(i)} className="mt-1 h-5 w-5" />
                  <span className="min-w-0">
                    <span className="font-medium">{q.prompt}</span>{q.topic && <span className="text-sm text-muted"> · {q.topic}</span>}
                    <ol className="mt-1 list-[upper-alpha] pl-5 text-sm">
                      {q.options.map((o, j) => (
                        <li key={j} className={j === q.correct ? 'font-semibold text-ok' : ''}>{o}{j === q.correct && <Check size={14} aria-label="correct" className="ml-1 inline" />}</li>
                      ))}
                    </ol>
                  </span>
                </label>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending || keep.size === 0} onClick={add}>{pending ? 'Adding…' : `Add ${keep.size} question${keep.size === 1 ? '' : 's'}`}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setDrafts([]); setKeep(new Set()); }}>Discard</Button>
          </div>
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className={clsx('mt-3 text-sm font-medium', message.ok ? 'text-ok' : 'text-bad')}>{message.text}</p>}
    </div>
  );
}
