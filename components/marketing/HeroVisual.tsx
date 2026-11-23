import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import { Home, MailCheck, MonitorPlay, Sigma } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const EXAMS = ['WAEC', 'IGCSE', 'UTME', 'SAT Math'];

/**
 * Hero picture: a tall brand card with small floating cards that state services.
 * Drop a licensed photograph at public/images/hero.jpg (portrait, roughly 4:5) and it
 * replaces the brand artwork automatically. No figures, ratings or results are shown.
 */
export function HeroVisual() {
  const hasPhoto = fs.existsSync(path.join(process.cwd(), 'public', 'images', 'hero.jpg'));
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise py-6 delay-2 lg:max-w-none">
      <div aria-hidden="true" className="absolute -right-6 top-4 h-40 w-40 rounded-full bg-tile-sun blur-2xl" />
      <div aria-hidden="true" className="absolute -left-8 bottom-8 h-40 w-40 rounded-full bg-tile-lilac blur-2xl" />

      <div className="relative mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2a22d6] via-royal to-navy shadow-float">
        {hasPhoto ? (
          <Image src="/images/hero.jpg" alt="A learner studying with books and notes" fill priority sizes="(min-width: 1024px) 400px, 70vw" className="object-cover" />
        ) : (
          <>
            <div aria-hidden="true" className="absolute inset-0 bg-grid bg-[size:30px_30px] mask-fade-b" />
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-gold/30 blur-3xl" />
            <div className="relative flex h-full flex-col items-center justify-start gap-4 p-6 pt-[24%] text-center">
              <Logo variant="emblem" tone="dark" size={112} priority />
              <p className="font-display text-2xl font-bold text-white">Learning without limits</p>
            </div>
          </>
        )}
      </div>

      {/* Floating cards */}
      <div className="absolute right-0 top-0 w-52 rounded-2xl border border-line bg-surface p-3 shadow-lift sm:right-2">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tile-lilac text-royal"><Sigma size={20} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-[0.7rem] text-muted">One dedicated tutor</p>
            <p className="text-sm font-semibold text-navy">Maths &amp; Science</p>
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1">
          {EXAMS.map((e) => <li key={e} className="rounded-md bg-sunken px-1.5 py-0.5 text-[0.65rem] font-semibold">{e}</li>)}
        </ul>
      </div>
      <div className="absolute bottom-3 left-0 w-56 rounded-2xl border border-line bg-surface p-3 shadow-lift">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tile-sun text-accent"><MailCheck size={20} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">Weekly progress email</p>
            <p className="text-[0.7rem] text-muted">Lessons, work and marks, every Friday</p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-1 right-2 flex gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-card"><Home size={14} aria-hidden="true" className="text-accent" /> Home</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-card"><MonitorPlay size={14} aria-hidden="true" className="text-royal" /> Online</span>
      </div>
    </div>
  );
}
