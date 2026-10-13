import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';
import { FileBarChart, Home, MonitorPlay, Target } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const EXAMS = ['WAEC', 'IGCSE', 'UTME', 'SAT Math'];

/**
 * Hero bento: a cluster of pastel tiles describing what the academy offers.
 * Drop a licensed photograph at public/images/hero.jpg (learners with books, roughly
 * square) and it replaces the brand tile automatically.
 * Tiles state services only: no figures, ratings or results are shown.
 */
export function HeroVisual() {
  const hasPhoto = fs.existsSync(path.join(process.cwd(), 'public', 'images', 'hero.jpg'));
  return (
    <div className="grid animate-rise grid-cols-2 gap-3 delay-2 sm:gap-4">
      {/* Brand / photo tile */}
      <div className="relative col-span-2 flex min-h-[13rem] items-center justify-center overflow-hidden rounded-card bg-brand-deep p-6 sm:min-h-[15rem]">
        {hasPhoto ? (
          <Image src="/images/hero.jpg" alt="A learner studying with books and notes" fill priority sizes="(min-width: 1024px) 520px, 92vw" className="object-cover" />
        ) : (
          <>
            <div aria-hidden="true" className="absolute inset-0 bg-grid bg-[size:32px_32px] mask-fade-b" />
            <div aria-hidden="true" className="absolute -right-10 -top-14 h-48 w-48 rounded-full bg-gold/25 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4 text-center">
              <Logo variant="emblem" tone="dark" size={104} priority />
              <p className="font-heading text-xl font-semibold tracking-tightish text-white sm:text-2xl">Learning without limits</p>
            </div>
          </>
        )}
      </div>

      <div className="tile bg-tile-peach">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 text-accent shadow-xs"><Home size={20} aria-hidden="true" /></span>
        <p className="mt-4 font-heading text-lg font-semibold leading-tight text-navy">Home tutoring</p>
        <p className="mt-1 text-sm text-ink/70">Face-to-face lessons at home.</p>
      </div>
      <div className="tile bg-tile-sky">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 text-link shadow-xs"><MonitorPlay size={20} aria-hidden="true" /></span>
        <p className="mt-4 font-heading text-lg font-semibold leading-tight text-navy">Online tutoring</p>
        <p className="mt-1 text-sm text-ink/70">Live lessons from anywhere.</p>
      </div>
      <div className="tile bg-tile-sun">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 text-navy shadow-xs"><FileBarChart size={20} aria-hidden="true" /></span>
        <p className="mt-4 font-heading text-lg font-semibold leading-tight text-navy">Progress reports</p>
        <p className="mt-1 text-sm text-ink/70">Shared with parents.</p>
      </div>
      <div className="tile bg-tile-lilac">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 text-navy shadow-xs"><Target size={20} aria-hidden="true" /></span>
        <p className="mt-4 font-heading text-lg font-semibold leading-tight text-navy">Exam preparation</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {EXAMS.map((e) => <li key={e} className="rounded-full bg-surface/85 px-2 py-0.5 text-xs font-semibold">{e}</li>)}
        </ul>
      </div>
    </div>
  );
}
