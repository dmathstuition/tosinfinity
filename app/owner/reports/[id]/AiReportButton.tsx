'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { draftReportAction } from '@/app/owner/ai-actions';

/** Inserts an AI draft into the comments box for review. Nothing is saved or published. */
export function AiReportButton({ reportId, targetId }: { reportId: string; targetId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await draftReportAction(reportId);
            if (res.error || !res.text) return setNote(res.error ?? 'No draft was produced.');
            const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
            if (el) el.value = res.text;
            setNote('AI draft inserted. Review and edit it before saving.');
          })
        }
        className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:border-royal"
      >
        <Sparkles size={16} aria-hidden="true" /> {pending ? 'Drafting…' : 'Draft comments with AI'}
      </button>
      <span role="status" className="text-xs text-muted">{note}</span>
    </div>
  );
}
