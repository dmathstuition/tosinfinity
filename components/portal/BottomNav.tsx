'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { MobileNav } from '@/components/portal/MobileNav';
import { ICONS, type NavItem } from '@/components/portal/NavLinks';

/**
 * Tab bar for phones and tablets: the four most used pages, each with an icon and a
 * label, plus "More", which opens the full menu. Hidden on large screens, where the
 * sidebar is shown instead.
 */
export function BottomNav({ tabs, home, menu, menuFooter }: { tabs: NavItem[]; home: string; menu: NavItem[]; menuFooter: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));
  return (
    <nav aria-label="Quick navigation" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgb(var(--shadow)/0.12)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch">
        {tabs.slice(0, 4).map((t) => {
          const Icon = ICONS[t.icon];
          const on = active(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={clsx('relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] transition-colors', on ? 'font-semibold text-royal' : 'font-medium text-muted hover:text-ink')}
            >
              {on && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-royal" />}
              <Icon size={21} aria-hidden="true" />
              <span className="max-w-full truncate px-1">{t.label}</span>
              {t.badge ? <span className="absolute right-[calc(50%-18px)] top-2 h-2.5 w-2.5 rounded-full bg-orange ring-2 ring-surface"><span className="sr-only">{t.badge} new</span></span> : null}
            </Link>
          );
        })}
        <MobileNav items={menu} home={home} footer={menuFooter} trigger="tab" />
      </div>
    </nav>
  );
}
