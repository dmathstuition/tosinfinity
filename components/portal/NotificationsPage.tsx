import Link from 'next/link';
import { LocalTime } from '@/components/portal/LocalTime';
import { markAllNotificationsRead } from '@/components/portal/notification-actions';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/server';

/** Full notification history for the signed-in user (RLS: own rows only). */
export async function NotificationsPage({ userId }: { userId: string }) {
  const { data } = await createClient()
    .from('notifications')
    .select('id, title, body, href, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={unread ? (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="min-h-[40px] rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-royal">Mark all as read</button>
          </form>
        ) : undefined}
      />
      {data?.length ? (
        <ul className="card divide-y divide-line p-0">
          {data.map((n) => {
            const inner = (
              <>
                <p className="flex items-center gap-2 font-semibold">
                  {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-flame"><span className="sr-only">Unread: </span></span>}
                  {n.title}
                </p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted"><LocalTime iso={n.created_at} /></p>
              </>
            );
            return <li key={n.id}>{n.href ? <Link href={n.href} className="block p-4 hover:bg-ink/5">{inner}</Link> : <div className="p-4">{inner}</div>}</li>;
          })}
        </ul>
      ) : <EmptyState title="No notifications yet">Updates about classes, work, messages and invoices will appear here.</EmptyState>}
    </>
  );
}
