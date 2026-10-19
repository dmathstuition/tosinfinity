import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, Flame, GraduationCap, Sparkles, XCircle } from 'lucide-react';
import { AiBuddy, Waveform } from '@/components/ai/AiBuddy';
import { Greeting } from '@/components/portal/Greeting';
import { LocalTime } from '@/components/portal/LocalTime';
import { SectionHeading } from '@/components/portal/WelcomeBanner';

/*
 * Presentational blocks of the learner's home screen. They take plain data, so the
 * real dashboard and the design preview render exactly the same markup.
 */

const COURSE_TILES = ['bg-tile-mint', 'bg-tile-lilac', 'bg-tile-sky', 'bg-tile-sun', 'bg-tile-rose', 'bg-tile-peach'];

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p[p.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

export function GreetingHeader({ name, code, streak }: { name: string; code: string | null; streak: number }) {
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-cta font-heading text-lg font-bold text-navy shadow-cta">{initials(name)}</span>
        <div>
          <p className="text-sm text-muted"><Greeting /></p>
          <h1 className="text-2xl font-semibold leading-tight sm:text-[1.9rem]">{name.split(' ')[0]}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {code && <span className="hidden rounded-full bg-surface px-3 py-2 text-xs font-semibold text-muted shadow-xs sm:inline">ID {code}</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-sm font-bold shadow-xs" title="Lessons attended in a row">
          <Flame size={18} aria-hidden="true" className="text-flame" /> {streak}
          <span className="sr-only">lessons attended in a row</span>
        </span>
      </div>
    </section>
  );
}

export type NextWork = { id: string; title: string; due_at: string | null; missed: boolean } | null;

export function ContinueLearning({ next, done, missed, toDo, href = (id: string) => `/portal/assignments/${id}` }: { next: NextWork; done: number; missed: number; toDo: number; href?: (id: string) => string }) {
  return (
    <section aria-labelledby="continue-h" className="on-dark sheen relative overflow-hidden rounded-card bg-brand-deep p-5 shadow-lift sm:p-6">
      <div aria-hidden="true" className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id="continue-h" className="text-xl font-semibold sm:text-2xl">Continue learning</h2>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            {next ? <>Next: <span className="font-semibold text-white">{next.title}</span>{next.due_at && <> · due <LocalTime iso={next.due_at} format="date" /></>}</> : 'No work waiting. Well done!'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange px-3 py-1.5 text-navy"><CheckCircle2 size={14} aria-hidden="true" /> {done} done</span>
            <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5', missed ? 'bg-bad text-white' : 'bg-white/15')}><XCircle size={14} aria-hidden="true" /> {missed} missed</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Clock size={14} aria-hidden="true" /> {toDo} to do</span>
          </div>
          {next && (
            <Link href={href(next.id)} className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-cta px-5 text-sm font-semibold text-navy shadow-cta transition-transform hover:-translate-y-0.5">
              {next.missed ? 'Catch up now' : 'Start now'} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <AiBuddy size={112} className="hidden shrink-0 sm:block" />
      </div>
    </section>
  );
}

/** A card with a coloured header strip, as in the reference design. */
export function StripCard({ title, tone, children, href, label }: { title: string; tone: string; children: React.ReactNode; href?: string; label?: string }) {
  const body = (
    <>
      <p className="flex items-center justify-between px-5 pb-2 pt-3 text-sm font-semibold">{title}{href && <ArrowUpRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />}</p>
      <div className="rounded-card bg-surface p-5">{children}</div>
    </>
  );
  return href
    ? <Link href={href} aria-label={label} className={clsx('group block overflow-hidden rounded-card shadow-card transition-transform hover:-translate-y-0.5', tone)}>{body}</Link>
    : <section aria-label={title} className={clsx('overflow-hidden rounded-card shadow-card', tone)}>{body}</section>;
}

export function WorkCard({ handedIn, total, nextDue }: { handedIn: number; total: number; nextDue: string | null }) {
  return (
    <StripCard title="Work handed in" tone="bg-tile-sun">
      <p className="font-heading text-3xl font-semibold tabular-nums" style={{ color: 'rgb(var(--heading))' }}>{handedIn}<span className="text-lg text-muted">/{total}</span></p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        <div className="h-full rounded-full bg-gradient-to-r from-gold to-orange" style={{ width: `${total ? (handedIn / total) * 100 : 0}%` }} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Clock size={16} aria-hidden="true" className="text-accent" />
        {nextDue ? <>Next deadline <LocalTime iso={nextDue} format="date" /></> : 'No deadlines coming up'}
      </p>
    </StripCard>
  );
}

export function AiCard({ left, href = '/portal/assistant' }: { left: number; href?: string }) {
  return (
    <StripCard title="AI study helper" tone="bg-tile-lilac" href={href} label={`Learn with AI: ${left} prompts left today`}>
      <p className="font-heading text-3xl font-semibold tabular-nums" style={{ color: 'rgb(var(--heading))' }}>{left}<span className="text-lg text-muted"> prompts left</span></p>
      <Waveform bars={15} className="justify-center" />
      <p className="flex items-center gap-2 text-sm text-muted"><Sparkles size={16} aria-hidden="true" className="text-accent" /> Explanations, hints and practice</p>
    </StripCard>
  );
}

/** Segmented progress bar (a row of beads); at most 24 segments. */
export function Segments({ done, total, label }: { done: number; total: number; label: string }) {
  const n = Math.min(24, Math.max(total, 1));
  const filled = total ? Math.round((done / total) * n) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="flex gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={clsx('h-2.5 flex-1 rounded-full', i < filled ? 'bg-gradient-to-b from-gold to-orange' : 'bg-sunken')} />
      ))}
    </div>
  );
}

export type Course = { id: string; title: string; total: number; done: number };

export function CourseList({ courses, link = '/portal/timetable' }: { courses: Course[]; link?: string }) {
  return (
    <section aria-label="Your courses">
      <SectionHeading title="Your courses" href={link} link="Timetable" />
      {courses.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {courses.map((c, i) => {
            const toGo = c.total - c.done;
            return (
              <li key={c.id} className="card flex items-stretch gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-lg font-semibold leading-snug" style={{ color: 'rgb(var(--heading))' }}>{c.title}</p>
                  <p className="mt-1 text-sm text-muted">{c.total} lesson{c.total === 1 ? '' : 's'} · {c.done} done</p>
                  <div className="mt-3"><Segments done={c.done} total={c.total} label={`${c.title}: ${c.done} of ${c.total} lessons done`} /></div>
                  <p className="mt-2 text-xs font-semibold text-muted">{toGo > 0 ? `${toGo} lesson${toGo === 1 ? '' : 's'} to go` : c.total ? 'All scheduled lessons done' : 'Lessons not scheduled yet'}</p>
                </div>
                <span aria-hidden="true" className={clsx('grid w-20 shrink-0 place-items-center rounded-2xl', COURSE_TILES[i % COURSE_TILES.length])}>
                  <GraduationCap size={30} className="text-[rgb(var(--heading))]" />
                </span>
              </li>
            );
          })}
        </ul>
      ) : <p className="card p-5 text-sm text-muted">Your programmes will appear here once your tutor enrols you.</p>}
    </section>
  );
}
