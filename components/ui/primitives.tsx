import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Inbox, Info, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card p-5 sm:p-6', className)}>{children}</div>;
}

const badgeTones = {
  neutral: 'bg-ink/[0.07] text-ink ring-ink/10',
  blue: 'bg-royal/10 text-link ring-royal/20',
  gold: 'bg-gold/25 text-ink ring-gold/50',
  green: 'bg-ok/[0.12] text-ok ring-ok/25',
  red: 'bg-bad/[0.12] text-bad ring-bad/25',
  orange: 'bg-flame/15 text-ink ring-flame/40',
} as const;
const dotTones = { neutral: 'bg-muted', blue: 'bg-link', gold: 'bg-gold', green: 'bg-ok', red: 'bg-bad', orange: 'bg-flame' } as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex max-w-full items-center gap-1.5 rounded-full text-left px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', badgeTones[tone])}>
      <span aria-hidden="true" className={clsx('h-1.5 w-1.5 rounded-full', dotTones[tone])} />
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}

export function EmptyState({ title, children, action, icon: Icon = Inbox }: { title: string; children?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-royal/[0.07] text-link ring-1 ring-inset ring-royal/10">
        <Icon size={26} aria-hidden="true" />
      </span>
      <p className="mt-4 font-heading text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line/70 pb-6">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-[2.125rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[0.95rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const alertTones = {
  info: { box: 'border-royal/20 bg-royal/[0.05]', icon: Info, color: 'text-link' },
  success: { box: 'border-ok/30 bg-ok/[0.08]', icon: CheckCircle2, color: 'text-ok' },
  error: { box: 'border-bad/30 bg-bad/[0.08]', icon: XCircle, color: 'text-bad' },
  warning: { box: 'border-gold/70 bg-gold/[0.14]', icon: AlertTriangle, color: 'text-accent' },
} as const;

export function Alert({ tone = 'info', children }: { tone?: keyof typeof alertTones; children: ReactNode }) {
  const t = alertTones[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed text-ink', t.box)}>
      <t.icon size={18} aria-hidden="true" className={clsx('mt-0.5 shrink-0', t.color)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="text-bad" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-sm font-medium text-bad">{error}</p>}
    </div>
  );
}

// Each tone is a pastel tile. Text on the tile uses the ink token, which flips in dark mode.
const statTones = {
  royal: 'bg-tile-sky',
  lilac: 'bg-tile-lilac',
  gold: 'bg-tile-sun',
  orange: 'bg-tile-peach',
  green: 'bg-tile-mint',
  red: 'bg-tile-rose',
} as const;
export type TileTone = keyof typeof statTones;
export const tileClass = (tone: TileTone) => statTones[tone];

/**
 * Headline figure on a pastel tile. `suffix` renders small beside the value
 * (for example "%" or "/ 12"), as on a bento dashboard.
 */
export function Stat({
  label, value, suffix, hint, icon: Icon, tone = 'royal',
}: {
  label: string; value: ReactNode; suffix?: string; hint?: string; icon?: LucideIcon; tone?: TileTone;
}) {
  return (
    <div className={clsx('tile relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden', statTones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8rem] font-semibold leading-snug text-ink/75">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface/80 text-[rgb(var(--heading))] shadow-xs">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
      </div>
      <div>
        <p className="mt-3 font-heading text-[1.75rem] font-semibold leading-none tracking-display tabular-nums sm:text-[2rem]" style={{ color: 'rgb(var(--heading))' }}>
          {value}
          {suffix && <span className="ml-1 align-top text-sm font-semibold tracking-normal text-ink/60">{suffix}</span>}
        </p>
        {hint && <p className="mt-1.5 text-xs font-medium text-ink/65">{hint}</p>}
      </div>
    </div>
  );
}

/** Wraps wide tables so the page itself never scrolls horizontally. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="card overflow-x-auto p-0 [&_table]:border-separate [&_table]:border-spacing-0 [&_tbody_tr:hover]:bg-royal/[0.035] [&_tbody_tr]:transition-colors [&_thead]:bg-sunken/60">{children}</div>;
}
export const th = 'whitespace-nowrap px-4 py-3.5 text-left text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted';
export const td = 'px-4 py-3.5 align-top text-sm';
