'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { askAssistantAction, type AssistantMode } from './actions';

const MODES: Array<{ key: AssistantMode; label: string; placeholder: string }> = [
  { key: 'explain', label: 'Explain step by step', placeholder: 'e.g. How do I solve 3x + 5 = 20?' },
  { key: 'hint', label: 'Give me a hint', placeholder: 'Paste the question you are stuck on.' },
  { key: 'practice', label: 'Practice questions', placeholder: 'e.g. Simultaneous equations, SS1 level' },
  { key: 'mistakes', label: 'Explain my mistake', placeholder: 'Paste the question and your working.' },
  { key: 'summary', label: 'Revision summary', placeholder: 'e.g. Photosynthesis' },
];

type Turn = { mode: AssistantMode; question: string; answer: string };

export function AssistantClient() {
  const [mode, setMode] = useState<AssistantMode>('explain');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const current = MODES.find((m) => m.key === mode)!;

  const ask = () =>
    start(async () => {
      setError('');
      const res = await askAssistantAction(mode, question);
      if (res.error || !res.text) return setError(res.error ?? 'No answer was produced.');
      setTurns((t) => [{ mode, question, answer: res.text! }, ...t]);
      setQuestion('');
    });

  return (
    <div className="grid gap-6">
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="card grid gap-4 p-5">
        <fieldset>
          <legend className="label">What would you like?</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <label key={m.key} className="flex min-h-[40px] cursor-pointer items-center rounded-full border border-line px-4 text-sm font-medium has-[:checked]:border-royal has-[:checked]:bg-royal has-[:checked]:text-white">
                <input type="radio" name="mode" value={m.key} checked={mode === m.key} onChange={() => setMode(m.key)} className="sr-only" />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="question" className="label">Your question or topic</label>
          <textarea id="question" rows={4} maxLength={2000} required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={current.placeholder} className="field" aria-describedby="q-hint" />
          <p id="q-hint" className="mt-1 text-xs text-muted">Do not include personal information. Only what you type here is sent to the AI.</p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        <div><Button type="submit" disabled={pending || question.trim().length < 3}><Sparkles size={18} aria-hidden="true" /> {pending ? 'Thinking…' : 'Ask the assistant'}</Button></div>
      </form>

      <div aria-live="polite" className="grid gap-4">
        {turns.map((t, i) => (
          <article key={turns.length - i} className="card p-5">
            <p className="text-sm text-muted">{MODES.find((m) => m.key === t.mode)?.label}</p>
            <p className="mt-1 whitespace-pre-line font-medium">{t.question}</p>
            <div className="mt-3 rounded-xl bg-cloud p-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-link"><Sparkles size={14} aria-hidden="true" /> AI-generated answer</p>
              <p className="whitespace-pre-line text-sm leading-relaxed">{t.answer}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
