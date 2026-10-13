'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Bell } from 'lucide-react';
import { markAllNotificationsRead } from '@/components/portal/notification-actions';
import { LocalTime } from '@/components/portal/LocalTime';

export type NotificationItem = { id: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string };

export function NotificationBell({ unread, items, allHref }: { unread: number; items: NotificationItem[]; allHref: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sunken"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-orange px-1 text-center text-[11px] font-bold leading-[18px] text-navy">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div id="notification-panel" role="region" aria-label="Notifications" className="card absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-heading font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}
                className="text-sm font-medium text-link hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">You have no notifications yet.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.href ?? allHref} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-ink/5">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-orange"><span className="sr-only">Unread: </span></span>}
                      {n.title}
                    </p>
                    {n.body && <p className="truncate text-sm text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted"><LocalTime iso={n.created_at} /></p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-4 py-2 text-center">
            <Link href={allHref} onClick={() => setOpen(false)} className="text-sm font-medium text-link hover:underline">View all</Link>
          </div>
        </div>
      )}
    </div>
  );
}
