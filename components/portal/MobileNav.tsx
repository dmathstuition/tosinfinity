'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { LayoutGrid, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NavLinks, type NavItem } from '@/components/portal/NavLinks';

/** Accessible drawer built on the native <dialog>: focus trap and Escape come for free. */
/** `trigger="tab"` renders the opener as the "More" tab of the bottom bar. */
export function MobileNav({ items, home, footer, trigger = 'icon' }: { items: NavItem[]; home: string; footer: ReactNode; trigger?: 'icon' | 'tab' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {trigger === 'tab' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={clsx('flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium', open ? 'text-royal' : 'text-muted')}
        >
          <LayoutGrid size={21} aria-hidden="true" />
          More
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-haspopup="dialog"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-xs lg:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      )}
      <dialog
        ref={ref}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className="m-0 h-full max-h-none w-80 max-w-[88vw] rounded-r-panel bg-surface p-0 text-ink backdrop:bg-navy/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-[4.25rem] shrink-0 items-center justify-between px-4">
            <Logo size={36} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-ink">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Portal" className="flex-1 overflow-y-auto px-3 py-3">
            <NavLinks items={items} home={home} onNavigate={() => setOpen(false)} />
          </nav>
          {footer}
        </div>
      </dialog>
    </>
  );
}
