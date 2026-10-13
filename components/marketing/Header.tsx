'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { Logo } from '@/components/brand/Logo';
import { buttonClass } from '@/components/ui/Button';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/subjects', label: 'Subjects' },
  { href: '/examination-preparation', label: 'Examination Preparation' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300',
        scrolled || open ? 'border-line/80 bg-surface/90 shadow-card backdrop-blur-xl' : 'border-transparent bg-surface/70 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Tosinfinity Academy home" className="flex items-center rounded-xl">
          <Logo size={36} priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 rounded-full border border-line/70 bg-surface/80 p-1 shadow-xs xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-[0.84rem] font-medium transition-colors',
                isActive(item.href) ? 'bg-navy text-white shadow-xs' : 'text-ink/80 hover:bg-royal/[0.07] hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonClass('ghost', 'sm', 'hidden whitespace-nowrap sm:inline-flex')}>
            Student Portal
          </Link>
          <Link href="/apply" className={buttonClass('primary', 'sm', 'hidden whitespace-nowrap min-[420px]:inline-flex')}>
            Apply for Tutoring <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface shadow-xs xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="animate-fade border-t border-line bg-surface xl:hidden">
          <ul className="container-page flex flex-col py-3">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={clsx(
                    'flex items-center justify-between rounded-xl px-3 py-3.5 text-base font-medium',
                    isActive(item.href) ? 'bg-royal/[0.07] text-link' : 'text-ink',
                  )}
                >
                  {item.label}
                  <ArrowRight size={16} aria-hidden="true" className="text-muted" />
                </Link>
              </li>
            ))}
            <li className="mt-3 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <Link href="/login" className={buttonClass('outline', 'md')}>
                Student Portal
              </Link>
              <Link href="/apply" className={buttonClass('primary', 'md')}>
                Apply for Tutoring
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
