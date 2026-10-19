'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ICONS, type NavItem } from '@/components/portal/NavLinks';

/**
 * Floating tab bar for phones and tablets: the most used pages as icons, with an
 * optional raised centre button (the study assistant for learners). Hidden on
 * large screens, where the side rail is shown instead.
 */
export function BottomNav({ tabs, home, center }: { tabs: NavItem[]; home: string; center?: { href: string; label: string } }) {
  const pathname = usePathname();
  const active = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));
  const half = Math.ceil(tabs.length / 2);
  const tab = (t: NavItem) => {
    const Icon = ICONS[t.icon];
    const on = active(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={on ? 'page' : undefined}
        className={clsx('relative flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[0.65rem] font-semibold transition-colors', on ? 'text-navy' : 'text-muted hover:text-ink')}
      >
        <span className={clsx('grid h-8 w-8 place-items-center rounded-full transition-colors', on && 'bg-tile-mint')}>
          <Icon size={19} aria-hidden="true" />
        </span>
        <span className="max-w-[4.5rem] truncate">{t.label}</span>
        {t.badge ? <span className="absolute right-1 top-0.5 h-2.5 w-2.5 rounded-full bg-flame ring-2 ring-surface"><span className="sr-only">{t.badge} new</span></span> : null}
      </Link>
    );
  };
  return (
    <nav aria-label="Quick navigation" className="no-print fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-center justify-around rounded-full border border-white/70 bg-surface/95 px-2 py-1.5 shadow-float backdrop-blur-xl lg:hidden">
      {tabs.slice(0, half).map(tab)}
      {center && (
        <Link
          href={center.href}
          aria-label={center.label}
          aria-current={active(center.href) ? 'page' : undefined}
          className="-mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-cta text-navy shadow-cta ring-4 ring-cloud transition-transform hover:scale-105"
        >
          <Sparkles size={24} aria-hidden="true" />
        </Link>
      )}
      {tabs.slice(half).map(tab)}
    </nav>
  );
}
