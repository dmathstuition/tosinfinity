'use client';

import clsx from 'clsx';
import { Mic, MicOff, Plus, SendHorizontal, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AiBuddy, Waveform } from '@/components/ai/AiBuddy';
import { askAssistantAction, type AssistantMode } from './actions';

const MODES: Array<{ key: AssistantMode; label: string; placeholder: string }> = [
  { key: 'chat', label: 'Ask anything', placeholder: 'Ask a study question…' },
  { key: 'explain', label: 'Explain step by step', placeholder: 'e.g. How do I solve 3x + 5 = 20?' },
  { key: 'hint', label: 'Give me a hint', placeholder: 'Paste the question you are stuck on…' },
  { key: 'practice', label: 'Practice questions', placeholder: 'e.g. Simultaneous equations, SS1 level' },
  { key: 'mistakes', label: 'Check my working', placeholder: 'Paste the question and your working…' },
  { key: 'summary', label: 'Revision summary', placeholder: 'e.g. Photosynthesis' },
  { key: 'plan', label: 'Make a study plan', placeholder: 'e.g. WAEC Maths in 6 weeks, 1 hour a day, weak on trigonometry' },
];

type Turn = { role: 'user' | 'assistant'; content: string; mode?: AssistantMode };

// Minimal typing for the browser speech API (not in the TS DOM library everywhere).
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};
function speechRecognition(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * "Learn with AI": a conversation with the study assistant, with optional voice
 * typing (the browser's speech recognition) and reading answers aloud (the
 * browser's speech synthesis). Nothing is stored; the conversation lives in this tab.
 */
export function AssistantClient({ firstName, initialLeft, initialMode, initialText }: { firstName: string; initialLeft: number; initialMode?: string; initialText?: string }) {
  const [mode, setMode] = useState<AssistantMode>(MODES.some((m) => m.key === initialMode) ? (initialMode as AssistantMode) : 'chat');
  const [input, setInput] = useState(initialText ?? '');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [left, setLeft] = useState(initialLeft);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [pending, start] = useTransition();
  const rec = useRef<Recognition | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const current = MODES.find((m) => m.key === mode)!;

  useEffect(() => setVoiceOk(Boolean(speechRecognition())), []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, pending]);
  useEffect(() => () => { rec.current?.stop(); window.speechSynthesis?.cancel(); }, []);

  function toggleMic() {
    if (listening) return rec.current?.stop();
    const R = speechRecognition();
    if (!R) return;
    const r = new R();
    r.lang = 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    const before = input ? `${input.trim()} ` : '';
    r.onresult = (e) => setInput(before + Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(''));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setError('Voice typing stopped. Check that the browser may use your microphone.'); };
    rec.current = r;
    setError('');
    setListening(true);
    r.start();
  }

  function readAloud(text: string) {
    if (!speak || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 1500));
    u.lang = 'en-GB';
    window.speechSynthesis.speak(u);
  }

  const send = () => {
    const text = input.trim();
    if (text.length < 2 || pending) return;
    rec.current?.stop();
    const history = turns.slice(-6).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: 'user', content: text, mode }]);
    setInput('');
    setError('');
    start(async () => {
      const res = await askAssistantAction(mode, text, history);
      if (typeof res.left === 'number') setLeft(res.left);
      if (res.error || !res.text) {
        setError(res.error ?? 'No answer was produced.');
        setTurns((t) => t.slice(0, -1));
        setInput(text);
        return;
      }
      setTurns((t) => [...t, { role: 'assistant', content: res.text! }]);
      readAloud(res.text);
      if (mode !== 'chat' && mode !== 'mistakes') setMode('chat'); // follow-ups are free conversation
    });
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      {/* Assistant card */}
      <section className="card relative overflow-hidden p-5 text-center sm:p-6" aria-label="Study assistant">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-tile-mint to-transparent" />
        <div className="relative flex items-center justify-center gap-3 sm:gap-6">
          <Waveform bars={7} active={listening || pending} />
          <AiBuddy size={120} listening={listening} />
          <Waveform bars={7} active={listening || pending} />
        </div>
        <p className="relative mx-auto mt-3 w-fit rounded-full bg-tile-mint px-4 py-2 text-sm font-semibold" role="status">
          {listening ? 'Listening… speak your question' : pending ? 'Thinking…' : `Hello ${firstName}! How can I help you learn today?`}
        </p>
        <div className="relative mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => { setSpeak((s) => !s); window.speechSynthesis?.cancel(); }} aria-pressed={speak}
            aria-label={speak ? 'Stop reading answers aloud' : 'Read answers aloud'} title={speak ? 'Reading answers aloud' : 'Read answers aloud'}
            className={clsx('grid h-12 w-12 place-items-center rounded-full shadow-xs', speak ? 'bg-navy text-white' : 'bg-sunken')}>
            {speak ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button type="button" onClick={toggleMic} disabled={!voiceOk} aria-pressed={listening}
            aria-label={listening ? 'Stop voice typing' : 'Speak your question'} title={voiceOk ? 'Speak your question' : 'Voice typing is not supported in this browser'}
            className={clsx('grid h-16 w-16 place-items-center rounded-full bg-brand-cta text-navy shadow-cta transition-transform hover:scale-105 disabled:opacity-50', listening && 'ring-4 ring-gold/60')}>
            {listening ? <MicOff size={26} /> : <Mic size={26} />}
          </button>
          <button type="button" onClick={() => { setTurns([]); setMode('chat'); setError(''); window.speechSynthesis?.cancel(); box.current?.focus(); }}
            aria-label="Start a new conversation" title="New conversation" className="grid h-12 w-12 place-items-center rounded-full bg-sunken shadow-xs">
            <Plus size={20} />
          </button>
        </div>
        {voiceOk && <p className="relative mt-3 text-xs text-muted">Voice typing uses your browser’s speech service.</p>}
      </section>

      {/* Allowance */}
      <div className="on-dark flex items-center justify-between gap-3 rounded-2xl bg-brand-deep px-4 py-3.5 text-sm shadow-card">
        <span className="flex items-center gap-2 font-semibold"><Sparkles size={18} aria-hidden="true" className="text-gold" /> {left} prompt{left === 1 ? '' : 's'} left today</span>
        <span className="text-[rgb(var(--muted))]">AI study helper</span>
      </div>

      {/* Conversation */}
      {turns.length > 0 && (
        <section aria-label="Conversation" aria-live="polite" className="grid gap-3">
          {turns.map((t, i) => (
            t.role === 'user' ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-gold/70 px-4 py-3 text-sm font-medium text-navy shadow-xs">
                {t.mode && t.mode !== 'chat' && <span className="mb-1 block text-[0.7rem] font-bold uppercase tracking-wider opacity-70">{MODES.find((m) => m.key === t.mode)?.label}</span>}
                <p className="whitespace-pre-line">{t.content}</p>
              </div>
            ) : (
              <div key={i} className="flex max-w-[92%] items-start gap-2">
                <AiBuddy size={34} className="mt-1" />
                <div className="rounded-3xl rounded-tl-md bg-surface px-4 py-3 text-sm leading-relaxed shadow-card">
                  <p className="whitespace-pre-line">{t.content}</p>
                  <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">AI-generated · check with your tutor</p>
                </div>
              </div>
            )
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted"><AiBuddy size={34} listening /> Thinking…</div>
          )}
          <div ref={end} />
        </section>
      )}

      {/* Mode chips */}
      <div role="radiogroup" aria-label="What would you like?" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} onClick={() => { setMode(m.key); box.current?.focus(); }}
            className={clsx('tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold shadow-xs transition-colors', mode === m.key ? 'bg-navy text-white' : 'bg-surface hover:bg-tile-mint')}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="card flex items-end gap-2 p-2 pl-4">
        <label htmlFor="ask" className="sr-only">Your question</label>
        <textarea
          ref={box}
          id="ask"
          rows={1}
          maxLength={2000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={current.placeholder}
          className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-base outline-none placeholder:text-muted/70"
        />
        <button type="submit" disabled={pending || input.trim().length < 2 || left === 0} aria-label="Send"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-cta text-navy shadow-cta transition-transform hover:scale-105 disabled:opacity-50">
          <SendHorizontal size={20} />
        </button>
      </form>
      {error && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      <p className="text-center text-xs text-muted">You are talking to an AI, not your tutor. It can make mistakes. Do not share personal information; only what you type is sent.</p>
    </div>
  );
}
