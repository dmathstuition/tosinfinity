'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Paperclip } from 'lucide-react';
import { FileUpload } from '@/components/portal/FileUpload';
import { sendMessageAction } from '@/components/portal/message-actions';
import { Button } from '@/components/ui/Button';

function Send() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send'}</Button>;
}

export function MessageComposer({ threadId }: { threadId?: string }) {
  const [state, action] = useFormState(sendMessageAction, null);
  const [attach, setAttach] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setAttach(false);
      setResetKey((k) => k + 1);
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="grid gap-3 border-t border-line p-4">
      {threadId && <input type="hidden" name="thread_id" value={threadId} />}
      <label htmlFor="message-body" className="sr-only">Message</label>
      <textarea id="message-body" name="body" rows={3} maxLength={5000} required placeholder="Write a message…" className="field" />
      {attach && threadId && <FileUpload key={resetKey} bucket="message-attachments" folder={threadId} name="attachment" label="Attachment" />}
      {state && !state.ok && <p role="alert" className="text-sm text-bad">{state.message}</p>}
      <div className="flex items-center justify-between gap-3">
        {threadId ? (
          <button type="button" onClick={() => setAttach((v) => !v)} aria-pressed={attach} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-link hover:underline">
            <Paperclip size={16} aria-hidden="true" /> {attach ? 'Remove attachment' : 'Attach a file'}
          </button>
        ) : <span className="text-xs text-muted">You can attach files after your first message.</span>}
        <Send />
      </div>
    </form>
  );
}
