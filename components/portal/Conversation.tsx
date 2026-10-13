import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import { LocalTime } from '@/components/portal/LocalTime';
import { MessageComposer } from '@/components/portal/MessageComposer';
import { createClient } from '@/lib/supabase/server';

/**
 * One-to-one conversation view shared by all roles. RLS returns messages only for a
 * thread the viewer belongs to (or any thread, for the Owner). Opening it marks the
 * other party's messages as read.
 */
export async function Conversation({ threadId, viewerId, otherName }: { threadId?: string; viewerId: string; otherName: string }) {
  const supabase = createClient();
  let messages: Array<{ id: string; sender_id: string; body: string; attachment_path: string | null; read_at: string | null; created_at: string }> = [];
  if (threadId) {
    await supabase.rpc('mark_thread_read', { p_thread: threadId });
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, attachment_path, read_at, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(100);
    messages = (data ?? []).reverse();
  }

  return (
    <section aria-label={`Conversation with ${otherName}`} className="card flex flex-col p-0">
      <ol className="flex max-h-[60vh] min-h-[14rem] flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <li className="m-auto text-center text-sm text-muted">No messages yet. Say hello to start the conversation.</li>}
        {messages.map((m) => {
          const mine = m.sender_id === viewerId;
          return (
            <li key={m.id} className={clsx('max-w-[85%] rounded-2xl px-4 py-2.5', mine ? 'self-end bg-royal text-white' : 'self-start bg-cloud text-ink')}>
              <p className="sr-only">{mine ? 'You' : otherName}:</p>
              <p className="whitespace-pre-line break-words text-sm">{m.body}</p>
              {m.attachment_path && (
                <a href={`/api/files?bucket=message-attachments&path=${encodeURIComponent(m.attachment_path)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-medium underline">
                  <Paperclip size={14} aria-hidden="true" /> Attachment
                </a>
              )}
              <p className={clsx('mt-1 text-[11px]', mine ? 'text-white/75' : 'text-muted')}>
                <LocalTime iso={m.created_at} />
                {mine && (m.read_at ? ' · Read' : ' · Sent')}
              </p>
            </li>
          );
        })}
      </ol>
      <MessageComposer threadId={threadId} />
    </section>
  );
}
