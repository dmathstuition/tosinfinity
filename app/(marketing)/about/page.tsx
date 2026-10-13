import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { CtaBand, ICONS, PageHero, Section } from '@/components/marketing/sections';
import { BENEFITS } from '@/lib/marketing-content';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: 'The mission and teaching approach of Tosinfinity Academy, an owner-led private tutoring academy.',
  alternates: { canonical: '/about' },
};

const APPROACH = [
  { title: 'Start from where the learner is', body: 'Each learner begins with a conversation and assessment so lessons target real gaps rather than repeating what is already secure.' },
  { title: 'Explain, practise, review', body: 'Concepts are explained step by step, practised with guided questions, then revisited so understanding lasts.' },
  { title: 'Keep families informed', body: 'Attendance, assignments, results and written feedback are shared through secure student and parent accounts.' },
];

export default async function AboutPage() {
  const { academy } = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="About us" title="An academy built around the individual learner" intro={academy.tagline} />

      <Section id="mission" eyebrow="Our mission" title="Why we teach">
        <blockquote className="max-w-3xl border-l-4 border-gold pl-5 font-heading text-xl leading-relaxed text-ink sm:text-2xl">
          {academy.mission}
        </blockquote>
      </Section>

      <Section id="approach" eyebrow="Teaching approach" title="How we help learners improve" className="bg-surface">
        <ul className="grid gap-4 md:grid-cols-3">
          {APPROACH.map((a) => (
            <li key={a.title} className="card p-6">
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted">{a.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Founder details appear only once the Owner has supplied them in Settings. */}
      {(academy.founder_bio || academy.qualifications.length > 0) && (
        <Section id="founder" eyebrow="Your tutor" title="Who teaches at Tosinfinity Academy">
          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
            {academy.founder_bio && <p className="whitespace-pre-line text-lg leading-relaxed text-muted">{academy.founder_bio}</p>}
            {academy.qualifications.length > 0 && (
              <div className="card p-6">
                <h3 className="text-lg font-semibold">Qualifications</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {academy.qualifications.map((q) => (
                    <li key={q} className="flex gap-2">
                      <Check size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" /> {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section id="values" eyebrow="What you can expect" title="Our commitments to families" className="bg-surface">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <li key={b.title} className="flex gap-3">
                <Icon className="mt-1 shrink-0 text-orange" size={22} aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{b.title}</h3>
                  <p className="text-sm text-muted">{b.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <CtaBand academy={academy} />
    </>
  );
}
