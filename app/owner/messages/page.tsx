import Link from 'next/link';
import { LocalTime } from '@/components/portal/LocalTime';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';

export const metadata = { title: 'Messages' };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function MessagesPage() {
  const { supabase, profile } = await ownerContext();
  const { timezone } = await academyLocale();
  const [{ data: threads }, { data: people }, { data: unread }] = await Promise.all([
    supabase.from('message_threads').select('id, last_message_at, participant:profiles!message_threads_participant_id_fkey(id, full_name, role)').order('last_message_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id, full_name, role').in('role', ['student', 'parent']).eq('status', 'active').order('full_name'),
    supabase.from('messages').select('thread_id').is('read_at', null).neq('sender_id', profile.id),
  ]);
  const unreadBy = new Map<string, number>();
  for (const m of unread ?? []) unreadBy.set(m.thread_id, (unreadBy.get(m.thread_id) ?? 0) + 1);
  const hasThread = new Set((threads ?? []).map((t) => one(t.participant)?.id));

  return (
    <>
      <PageHeader title="Messages" description="Private one-to-one conversations with students and parents." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {threads?.length ? (
            <ul className="card divide-y divide-line p-0">
              {threads.map((t) => {
                const p = one(t.participant);
                const n = unreadBy.get(t.id) ?? 0;
                return (
                  <li key={t.id}>
                    <Link href={`/owner/messages/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-ink/5">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p?.full_name}</p>
                        <p className="text-sm capitalize text-muted">{p?.role} · <LocalTime iso={t.last_message_at} fallbackZone={timezone} /></p>
                      </div>
                      {n > 0 && <Badge tone="orange">{n} new</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="No conversations yet">Start one from the list of students and parents.</EmptyState>}
        </div>
        <Card className="h-fit">
          <h2 className="text-lg font-semibold">Start a conversation</h2>
          {people?.length ? (
            <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto">
              {people.filter((p) => !hasThread.has(p.id)).map((p) => (
                <li key={p.id}>
                  <Link href={`/owner/messages/new?to=${p.id}`} className="flex min-h-[44px] items-center justify-between gap-2 py-2 text-sm hover:underline">
                    <span>{p.full_name}</span><span className="capitalize text-muted">{p.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">There are no students or parents yet.</p>}
        </Card>
      </div>
    </>
  );
}
