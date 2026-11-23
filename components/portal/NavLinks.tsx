'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Award, Bell, BookOpen, CalendarDays, ClipboardList, CreditCard, FileBarChart, FolderOpen, GraduationCap,
  Inbox, LayoutDashboard, Mail, Megaphone, MessageSquare, Newspaper, ScrollText, Settings, Sparkles, Users,
} from 'lucide-react';

export const ICONS = {
  dashboard: LayoutDashboard, applications: Inbox, students: Users, classes: CalendarDays, assignments: ClipboardList,
  resources: FolderOpen, reports: FileBarChart, messages: MessageSquare, notices: Megaphone, billing: CreditCard,
  blog: Newspaper, programmes: GraduationCap, settings: Settings, audit: ScrollText, notifications: Bell,
  certificates: Award, assistant: Sparkles, materials: BookOpen, email: Mail,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; group?: string };

/**
 * Portal navigation: labelled rows with group headings. Used in the desktop sidebar
 * and in the phone menu. The current page is highlighted and announced to screen readers.
 */
export function NavLinks({ items, home, onNavigate }: { items: NavItem[]; home: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups: Array<{ name: string; items: NavItem[] }> = [];
  for (const item of items) {
    const name = item.group ?? '';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(item);
    else groups.push({ name, items: [item] });
  }
  const isActive = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));

  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.name || gi} role={g.name ? 'group' : undefined} aria-label={g.name || undefined}>
          {g.name && <p className="mb-1 px-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">{g.name}</p>}
          <ul className="space-y-0.5">
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
                      'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[0.92rem] transition-colors',
                      active ? 'bg-royal/[0.08] font-semibold text-royal' : 'font-medium text-ink/75 hover:bg-sunken hover:text-ink',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-full bg-royal" />}
                    <Icon size={19} aria-hidden="true" className={active ? 'text-royal' : 'text-muted'} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-orange px-2 py-0.5 text-xs font-bold text-navy">
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
