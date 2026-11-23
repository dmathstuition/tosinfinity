import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, Flame, GraduationCap, Sparkles, XCircle, type LucideIcon } from 'lucide-react';
import { Waveform } from '@/components/ai/AiBuddy';
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
    <section className="mb-5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted"><Greeting /></p>
        <h1 className="truncate text-[1.75rem] leading-tight sm:text-[2.1rem]">Hi, {name.split(' ')[0]} <span aria-hidden="true">👋</span></h1>
        <p className="mt-0.5 text-sm text-muted">What do you want to learn today?</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {code && <span className="hidden rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted sm:inline">ID {code}</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold" title="Lessons attended in a row">
          <Flame size={17} aria-hidden="true" className="text-flame" /> {streak}
          <span className="sr-only">lessons attended in a row</span>
        </span>
        <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-royal font-heading text-sm font-bold text-white">{initials(name)}</span>
      </div>
    </section>
  );
}

/** Big labelled shortcuts, like the reference design's category row. */
export function QuickLinks({ items }: { items: Array<{ href: string; label: string; icon: LucideIcon; tone: string }> }) {
  return (
    <nav aria-label="Shortcuts" className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {items.map(({ href, label, icon: Icon, tone }) => (
        <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-3.5 text-center text-xs font-semibold text-navy transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-card sm:text-sm">
          <span className={clsx('grid h-11 w-11 place-items-center rounded-xl', tone)}><Icon size={21} aria-hidden={true} /></span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export type NextWork = { id: string; title: string; due_at: string | null; missed: boolean } | null;

export function ContinueLearning({ next, done, missed, toDo, href = (id: string) => `/portal/assignments/${id}` }: { next: NextWork; done: number; missed: number; toDo: number; href?: (id: string) => string }) {
  const total = done + missed + toDo;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <section aria-labelledby="continue-h" className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="continue-h" className="text-lg font-semibold">Continue learning</h2>
        <Link href="/portal/assignments" className="text-sm font-semibold text-link hover:underline">See all</Link>
      </div>
      <div className="flex items-stretch gap-4">
        <span aria-hidden="true" className="relative grid w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2a22d6] via-royal to-navy sm:w-32">
          <span className="absolute inset-0 bg-grid bg-[size:20px_20px] opacity-60" />
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/95 text-royal shadow-card"><ArrowRight size={20} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-navy">{next ? next.title : 'No work waiting. Well done!'}</p>
          <p className="mt-0.5 text-sm text-muted">{next?.due_at ? <>Due <LocalTime iso={next.due_at} format="date" /></> : next ? 'No due date' : 'New work will appear here.'}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="Work handed in" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-royal" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-tile-mint px-2 py-1 text-ok"><CheckCircle2 size={13} aria-hidden="true" /> {done} done</span>
            {missed > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-bad/10 px-2 py-1 text-bad"><XCircle size={13} aria-hidden="true" /> {missed} missed</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-1 text-muted"><Clock size={13} aria-hidden="true" /> {toDo} to do</span>
          </div>
        </div>
      </div>
      {next && (
        <Link href={href(next.id)} className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-royal text-sm font-semibold text-white hover:bg-[#2a22d6] sm:w-auto sm:px-5 sm:inline-flex">
          {next.missed ? 'Catch up now' : 'Start now'} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

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
        <div className="h-full rounded-full bg-royal" style={{ width: `${total ? (handedIn / total) * 100 : 0}%` }} />
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
        <span key={i} className={clsx('h-2.5 flex-1 rounded-full', i < filled ? 'bg-royal' : 'bg-sunken')} />
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
