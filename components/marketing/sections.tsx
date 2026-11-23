import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarClock, Check, FlaskConical, Globe, GraduationCap, Home, LineChart,
  MessageCircle, MonitorPlay, Phone, ShieldCheck, Sigma, Target,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Badge } from '@/components/ui/primitives';
import { CATEGORY_LABEL, type Programme, type ProgrammeCategory } from '@/lib/programmes';
import { type Academy, type FaqItem, toInternational, whatsappLink } from '@/lib/site';

export const ICONS = { GraduationCap, CalendarClock, Globe, LineChart, BookOpen, ShieldCheck } as const;

// Card artwork per category, in the logo's colours.
export const CATEGORY_STYLE: Record<ProgrammeCategory, { icon: typeof Sigma; tile: string; art: string; blurb: string }> = {
  mathematics: { icon: Sigma, tile: 'from-royal to-navy text-white', art: 'from-[#2a22d6] via-royal to-navy', blurb: 'From upper primary foundations to Further Mathematics.' },
  science: { icon: FlaskConical, tile: 'from-orange to-ember text-white', art: 'from-[#ff9a3c] via-orange to-ember', blurb: 'Physics, Chemistry and Biology taught for understanding.' },
  exam_prep: { icon: Target, tile: 'from-gold to-orange text-navy', art: 'from-[#ffd84d] via-gold to-orange', blurb: 'Structured revision for WAEC, IGCSE and UTME topics.' },
};

export function Section({
  id, eyebrow, title, intro, children, className = '', center, action,
}: {
  id?: string; eyebrow?: string; title: string; intro?: string; children: ReactNode; className?: string; center?: boolean;
  /** A "see all" link shown to the right of the title. */
  action?: { href: string; label: string };
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`scroll-mt-20 py-16 sm:py-24 ${className}`}>
      <div className="container-page">
        <div className={center ? 'mx-auto max-w-2xl text-center' : 'flex flex-wrap items-end justify-between gap-4'}>
          <div className={center ? '' : 'max-w-2xl'}>
            {eyebrow && <p className={`eyebrow ${center ? 'justify-center' : ''}`}>{eyebrow}</p>}
            <h2 id={id ? `${id}-title` : undefined} className="mt-3 font-display text-[2rem] font-bold leading-[1.12] sm:text-[2.6rem]">
              {title}
            </h2>
            {intro && <p className="mt-3 text-lg leading-relaxed text-muted">{intro}</p>}
          </div>
          {action && !center && (
            <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline">
              {action.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line bg-surface">
      <div aria-hidden="true" className="absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-tile-lilac blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 left-1/4 -z-10 h-80 w-80 rounded-full bg-tile-sun/70 blur-3xl" />
      <div className="container-page py-14 sm:py-20">
        {eyebrow && <p className="eyebrow animate-rise">{eyebrow}</p>}
        <h1 className="mt-4 max-w-3xl animate-rise text-4xl leading-[1.08] delay-1 sm:text-[3.4rem]">{title}</h1>
        {intro && <p className="mt-5 max-w-2xl animate-rise text-lg leading-relaxed text-muted delay-2">{intro}</p>}
        {children && <div className="mt-8 flex animate-rise flex-wrap gap-3 delay-3">{children}</div>}
      </div>
    </section>
  );
}

export function ProgrammeCard({ programme, as: Heading = 'h3' }: { programme: Programme; as?: 'h3' | 'h4' }) {
  const style = CATEGORY_STYLE[programme.category];
  const Icon = style.icon;
  return (
    <Link href={`/subjects/${programme.slug}`} className="card group flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${style.art}`}>
        <div aria-hidden="true" className="absolute inset-0 bg-grid bg-[size:28px_28px] opacity-60" />
        <span aria-hidden="true" className="absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-white/15" />
        <Icon aria-hidden="true" size={52} strokeWidth={1.6} className="relative text-white drop-shadow" />
        <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-navy">
          {CATEGORY_LABEL[programme.category]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {programme.level && <p className="text-xs font-semibold text-accent">{programme.level}</p>}
        <Heading className="mt-1 text-lg font-semibold leading-snug">{programme.title}</Heading>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{programme.summary}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-link">
          View programme
          <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function ProgrammeGroups({ programmes, level = 2 }: { programmes: Programme[]; level?: 2 | 3 }) {
  const GroupHeading = level === 2 ? 'h2' : 'h3';
  const cardHeading = level === 2 ? 'h3' : 'h4';
  const cats = (Object.keys(CATEGORY_LABEL) as ProgrammeCategory[]).filter((c) => programmes.some((p) => p.category === c));
  return (
    <div className="space-y-16">
      {cats.map((cat) => (
        <div key={cat}>
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line pb-4">
            <GroupHeading className="text-2xl font-semibold">{CATEGORY_LABEL[cat]}</GroupHeading>
            <p className="text-sm text-muted">{CATEGORY_STYLE[cat].blurb}</p>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programmes.filter((p) => p.category === cat).map((p) => (
              <ProgrammeCard key={p.slug} programme={p} as={cardHeading} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Steps({ steps }: { steps: ReadonlyArray<{ title: string; body: string }> }) {
  return (
    <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {/* Connecting line behind the numbered markers on wide screens */}
      <li aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[2.35rem] hidden h-px bg-gradient-to-r from-gold via-orange to-royal lg:block" />
      {steps.map((s, i) => (
        <li key={s.title} className="card relative p-6">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brand-cta font-heading text-base font-bold text-navy shadow-cta ring-4 ring-surface">
            {i + 1}
          </span>
          <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function DeliveryCards({ items }: { items: ReadonlyArray<{ key: string; title: string; body: string; points: readonly string[] }> }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {items.map((d) => {
        const home = d.key === 'home';
        const Icon = home ? Home : MonitorPlay;
        return (
          <div key={d.key} className="card card-hover relative overflow-hidden p-7 sm:p-8">
            <div aria-hidden="true" className={`absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl ${home ? 'bg-orange/15' : 'bg-royal/15'}`} />
            <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${home ? 'bg-orange/15 text-accent' : 'bg-royal/10 text-link'}`}>
              <Icon size={24} aria-hidden="true" />
            </span>
            <h3 className="relative mt-5 text-2xl font-semibold">{d.title}</h3>
            <p className="relative mt-2 leading-relaxed text-muted">{d.body}</p>
            <ul className="relative mt-6 space-y-3 border-t border-line pt-6 text-sm">
              {d.points.map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Native <details> gives keyboard and screen-reader support without JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {items.map((f) => (
        <details key={f.question} className="card group overflow-hidden p-0 transition-shadow open:shadow-lift">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-heading font-semibold [&::-webkit-details-marker]:hidden">
            {f.question}
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal/[0.07] text-xl leading-none text-link transition-transform duration-300 group-open:rotate-45 group-open:bg-navy group-open:text-white">+</span>
          </summary>
          <p className="px-6 pb-6 leading-relaxed text-muted">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** Illustrative only: clearly labelled so nobody mistakes it for a real learner's record. */
export function SampleReport() {
  const rows: Array<[string, number, string]> = [
    ['Algebra: linear equations', 78, 'Secure'],
    ['Geometry: angles and triangles', 64, 'Developing'],
    ['Word problems', 55, 'Focus area'],
  ];
  return (
    <div className="card overflow-hidden p-0 shadow-lift">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/60 px-6 py-4">
        <p className="font-heading font-semibold">Progress report</p>
        <Badge tone="orange">Demonstration data, not a real learner</Badge>
      </div>
      <div className="grid gap-8 p-6 md:grid-cols-[1fr_1.5fr] sm:p-8">
        <dl className="grid grid-cols-2 gap-5 text-sm md:grid-cols-1">
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Learner</dt><dd className="mt-1 font-medium">Sample Student (JSS2)</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Subject</dt><dd className="mt-1 font-medium">Mathematics</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Attendance</dt><dd className="mt-1 font-medium">11 of 12 lessons</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-muted">Next step</dt><dd className="mt-1 font-medium">Two worked word problems per lesson</dd></div>
        </dl>
        <ul className="space-y-5" aria-label="Sample assessment results">
          {rows.map(([topic, score, status]) => (
            <li key={topic}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{topic}</span>
                <span className="shrink-0 text-muted"><span className="font-semibold tabular-nums text-ink">{score}%</span> · {status}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${score} percent`}>
                <div className="h-full rounded-full bg-gradient-to-r from-royal to-link" style={{ width: `${score}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ContactButtons({ academy, onDark }: { academy: Academy; onDark?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <ButtonLink href={whatsappLink(academy, 'Hello Tosinfinity Academy, I would like to ask about tutoring.')} external variant={onDark ? 'onDark' : 'outline'}>
        <MessageCircle size={18} aria-hidden="true" /> Chat on WhatsApp
      </ButtonLink>
      {academy.phones.map((p) => (
        <ButtonLink key={p} href={`tel:+${toInternational(p)}`} external variant={onDark ? 'onDark' : 'outline'}>
          <Phone size={18} aria-hidden="true" /> {p}
        </ButtonLink>
      ))}
    </div>
  );
}

/** Closing banner: real service facts only, no invented statistics. */
const FACTS = [
  ['1 to 1', 'personal attention'],
  ['Home', 'or online lessons'],
  ['Weekly', 'progress emails'],
  ['Exam prep', 'WAEC · IGCSE · UTME · SAT Math'],
] as const;

export function CtaBand({ academy }: { academy: Academy }) {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="on-dark relative isolate mx-auto max-w-6xl overflow-hidden rounded-panel bg-gradient-to-br from-royal via-[#2a22d6] to-navy px-6 py-12 shadow-float sm:px-12 sm:py-14">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-grid bg-[size:40px_40px] mask-fade-b" />
        <div aria-hidden="true" className="absolute -right-16 -top-24 -z-10 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-display text-[2rem] font-bold leading-tight sm:text-[2.6rem]">Unlock your child’s potential</h2>
            <p className="mt-3 max-w-lg text-lg leading-relaxed text-muted">Apply in a few minutes. We will contact you to talk through the learner’s needs. No payment is taken when you apply.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/apply" size="lg" variant="accent">
                Apply for Tutoring <ArrowUpRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={whatsappLink(academy, 'Hello Tosinfinity Academy, I would like to ask about tutoring.')} external size="lg" variant="onDark">
                <MessageCircle size={18} aria-hidden="true" /> Chat on WhatsApp
              </ButtonLink>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {FACTS.map(([big, small]) => (
              <li key={big} className="rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15">
                <p className="font-display text-xl font-bold text-gold sm:text-2xl">{big}</p>
                <p className="text-sm text-[rgb(var(--muted))]">{small}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

