import Link from 'next/link';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { tileClass, type TileTone } from '@/components/ui/primitives';

/** Dashboard heading: a light title row (bento style) with optional shortcut tiles beneath. */
export function WelcomeBanner({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h1 className="mt-1.5 text-[1.9rem] font-semibold leading-tight sm:text-[2.4rem]">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

const TILE_ORDER: TileTone[] = ['royal', 'lilac', 'red', 'gold', 'green', 'orange'];

/** Pastel shortcut tile. `index` picks the colour so a row of tiles reads as a set. */
export function ActionTile({ href, label, icon: Icon, index = 0 }: { href: string; label: string; icon: LucideIcon; index?: number }) {
  return (
    <Link
      href={href}
      className={clsx(
        'group flex min-h-[56px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-ink transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card',
        tileClass(TILE_ORDER[index % TILE_ORDER.length]!),
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface/85 text-[rgb(var(--heading))] shadow-xs">
        <Icon size={17} aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}

export function SectionHeading({ title, href, link, count }: { title: string; href?: string; link?: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        {typeof count === 'number' && (
          <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-bold text-white">
            {count}
            <span className="sr-only"> items</span>
          </span>
        )}
      </h2>
      {href && link && <Link href={href} className="shrink-0 text-sm font-semibold text-link underline-offset-4 hover:underline">{link} ›</Link>}
    </div>
  );
}
