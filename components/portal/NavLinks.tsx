'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Award, Bell, BookOpen, CalendarDays, ClipboardList, CreditCard, FileBarChart, FolderOpen, GraduationCap,
  Inbox, LayoutDashboard, Megaphone, MessageSquare, Newspaper, ScrollText, Settings, Sparkles, Users,
} from 'lucide-react';

const ICONS = {
  dashboard: LayoutDashboard, applications: Inbox, students: Users, classes: CalendarDays, assignments: ClipboardList,
  resources: FolderOpen, reports: FileBarChart, messages: MessageSquare, notices: Megaphone, billing: CreditCard,
  blog: Newspaper, programmes: GraduationCap, settings: Settings, audit: ScrollText, notifications: Bell,
  certificates: Award, assistant: Sparkles, materials: BookOpen,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; group?: string };

/**
 * Portal navigation in two forms:
 *  - "rail": the slim desktop sidebar. Each item is an icon with a short label beneath,
 *    so the rail stays compact without becoming icon-only guesswork.
 *  - "list": full-width rows with group headings, used in the mobile drawer.
 */
export function NavLinks({ items, home, onNavigate, variant = 'list' }: { items: NavItem[]; home: string; onNavigate?: () => void; variant?: 'rail' | 'list' }) {
  const pathname = usePathname();
  const groups: Array<{ name: string; items: NavItem[] }> = [];
  for (const item of items) {
    const name = item.group ?? '';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(item);
    else groups.push({ name, items: [item] });
  }
  const isActive = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));

  if (variant === 'rail') {
    return (
      <div className="flex flex-col items-stretch">
        {groups.map((g, gi) => (
          <div key={g.name || gi} role={g.name ? 'group' : undefined} aria-label={g.name || undefined}>
            {gi > 0 && <div aria-hidden="true" className="mx-auto my-2 h-px w-8 bg-line" />}
            <ul className="space-y-1">
              {g.items.map((item) => {
                const active = isActive(item.href);
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="group flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-center"
                    >
                      <span
                        className={clsx(
                          'relative flex h-11 w-11 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200',
                          active ? 'bg-navy text-white shadow-royal' : 'text-muted group-hover:bg-tile-sky group-hover:text-[rgb(var(--heading))]',
                        )}
                      >
                        <Icon size={19} aria-hidden="true" />
                        {item.badge ? (
                          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-brand-cta px-1 text-[0.65rem] font-bold leading-[18px] text-navy ring-2 ring-surface">
                            {item.badge > 99 ? '99+' : item.badge}
                            <span className="sr-only"> pending</span>
                          </span>
                        ) : null}
                      </span>
                      <span className={clsx('w-full text-[0.68rem] leading-tight', active ? 'font-bold text-ink' : 'font-medium text-muted group-hover:text-ink')}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.name || gi} role={g.name ? 'group' : undefined} aria-label={g.name || undefined}>
          {g.name && <p className="mb-1.5 px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted">{g.name}</p>}
          <ul className="space-y-1">
            {g.items.map((item) => {
              const active = isActive(item.href);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex min-h-[48px] items-center gap-3 rounded-2xl px-2.5 text-[0.95rem] font-medium transition-colors',
                      active ? 'bg-tile-sky font-semibold text-ink' : 'text-ink/80 hover:bg-sunken',
                    )}
                  >
                    <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', active ? 'bg-navy text-white' : 'bg-sunken text-muted')}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-brand-cta px-2 py-0.5 text-xs font-bold text-navy">
                        {item.badge > 99 ? '99+' : item.badge}
                        <span className="sr-only"> pending</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
