import type { Metadata } from 'next';
import { ArrowRight, Check, Quote } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { HeroVisual } from '@/components/marketing/HeroVisual';
import {
  ContactButtons, CtaBand, DeliveryCards, FaqList, ICONS, ProgrammeGroups, SampleReport, Section, Steps,
} from '@/components/marketing/sections';
import { FeaturedPosts } from '@/components/marketing/FeaturedPosts';
import { JsonLd } from '@/components/marketing/JsonLd';
import { BENEFITS, DEFAULT_FAQ, DELIVERY, STEPS } from '@/lib/marketing-content';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings, toInternational } from '@/lib/site';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// Service facts only (from the flyer). No figures, results or ratings are shown.
const ASSURANCES = ['Home or online lessons', 'Regular progress reports', 'No payment to apply'];
const COVERAGE_TILES = ['bg-tile-sky', 'bg-tile-lilac', 'bg-tile-sun', 'bg-tile-mint', 'bg-tile-peach', 'bg-tile-rose'];
const BENEFIT_TILES = ['bg-tile-sky', 'bg-tile-sun', 'bg-tile-lilac', 'bg-tile-mint', 'bg-tile-peach', 'bg-tile-rose'];
const COVERAGE = ['Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology', 'WAEC', 'IGCSE', 'UTME topics', 'SAT Math'];

export default async function HomePage() {
  const [settings, programmes] = await Promise.all([getSiteSettings(), getProgrammes()]);
  const { academy, testimonials } = settings;
  const faq = settings.faq.length ? settings.faq : DEFAULT_FAQ;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name: academy.name,
          url: publicEnv.siteUrl,
          logo: `${publicEnv.siteUrl}/icons/icon-512.png`,
          description: academy.tagline,
          telephone: academy.phones.map((p) => `+${toInternational(p)}`),
          ...(academy.email ? { email: academy.email } : {}),
        }}
      />

      {/* Hero */}
      <section className="px-3 pt-3 sm:px-5">
        <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-panel bg-surface p-5 shadow-card sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:p-12">
          <div className="lg:py-6">
            <p className="inline-flex animate-rise items-center gap-2 rounded-full bg-tile-sky py-1.5 pl-2 pr-4 text-sm font-semibold">
              <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">Tosinfinity</span>
              Private home and online tutoring
            </p>
            <h1 className="mt-6 animate-rise text-[2.5rem] font-bold leading-[1.05] delay-1 sm:text-6xl lg:text-[4rem]">
              Are You in Need of a <span className="text-gradient">Private Tutor?</span>
            </h1>
            <p className="mt-6 max-w-xl animate-rise text-lg leading-relaxed text-muted delay-2 sm:text-xl">{academy.tagline}</p>
            <div className="mt-9 flex animate-rise flex-col gap-3 delay-3 sm:flex-row">
              <ButtonLink href="/apply" size="lg">
                Apply for Tutoring <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/subjects" size="lg" variant="outline">
                Explore Our Courses
              </ButtonLink>
            </div>
            <ul className="mt-9 flex animate-rise flex-wrap gap-x-6 gap-y-2.5 text-sm font-medium delay-4">
              {ASSURANCES.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ok/15 text-ok"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>

        {/* What we teach, at a glance */}
        <div className="mx-auto mt-3 flex max-w-7xl flex-col gap-3 rounded-card bg-surface px-5 py-4 shadow-card sm:mt-4 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
          <p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-muted">We teach</p>
          <ul className="flex flex-wrap gap-2">
            {COVERAGE.map((c, i) => (
              <li key={c} className={`rounded-full px-3 py-1.5 font-heading text-sm font-semibold text-navy ${COVERAGE_TILES[i % COVERAGE_TILES.length]}`}>{c}</li>
            ))}
          </ul>
        </div>
      </section>

      <Section id="why" eyebrow="Why families choose us" title="Why choose Tosinfinity Academy?" intro="Personal attention from one dedicated tutor, with families kept informed at every step.">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => {
            const Icon = ICONS[b.icon];
            return (
              <li key={b.title} className={`group relative overflow-hidden rounded-card p-7 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift ${BENEFIT_TILES[i % BENEFIT_TILES.length]}`}>
                <span aria-hidden="true" className="absolute right-5 top-4 font-heading text-5xl font-bold text-navy/[0.08]">0{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface/85 text-navy shadow-xs">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/75">{b.body}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        id="programmes"
        eyebrow="Subjects and programmes"
        title="Tutoring matched to the learner’s level"
        intro="From upper primary Mathematics to senior secondary Science and examination preparation."
        className="!py-16"
      >
        <ProgrammeGroups programmes={programmes} level={3} />
      </Section>

      {/* Mission */}
      <section className="on-dark relative isolate mx-3 overflow-hidden rounded-panel bg-brand-deep sm:mx-5" aria-labelledby="mission-title">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-grid bg-[size:44px_44px] opacity-70" />
        <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-royal blur-3xl" />
        <div className="container-page py-20 text-center sm:py-24">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-gold ring-1 ring-inset ring-white/15">
            <Quote size={26} aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6 justify-center !text-gold">Our mission</p>
          <h2 id="mission-title" className="sr-only">Our mission</h2>
          <blockquote className="mx-auto mt-6 max-w-4xl font-heading text-2xl font-medium leading-[1.35] tracking-tightish sm:text-[2.35rem]">
            {academy.mission}
          </blockquote>
        </div>
      </section>

      <Section id="how" eyebrow="How tutoring works" title="A clear path from enquiry to progress" center>
        <Steps steps={STEPS} />
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/how-it-works" variant="outline">More about how it works <ArrowRight size={16} aria-hidden="true" /></ButtonLink>
        </div>
      </Section>

      <Section id="delivery" eyebrow="Two ways to learn" title="Home or online: choose what suits your family" className="border-y border-line/70 bg-surface">
        <DeliveryCards items={DELIVERY} />
      </Section>

      <Section
        id="reports"
        eyebrow="Progress you can see"
        title="Regular assessments and progress reports"
        intro="Parents and students see attendance, results and next steps in their own secure account. The example below shows the format."
      >
        <SampleReport />
      </Section>

      {testimonials.length > 0 && (
        <Section id="testimonials" eyebrow="From our families" title="What parents and learners say" className="border-y border-line/70 bg-surface">
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.quote} className="card card-hover flex flex-col p-7">
                <Quote size={28} className="text-gold" aria-hidden="true" />
                <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink">{t.quote}</blockquote>
                <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-royal font-heading text-sm font-semibold text-white">{t.author.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <p className="text-sm font-semibold">{t.author}</p>
                    {t.context && <p className="text-sm text-muted">{t.context}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <FeaturedPosts />

      <Section id="faq" eyebrow="Questions" title="Frequently asked questions" className="border-y border-line/70 bg-surface" center>
        <FaqList items={faq.slice(0, 6)} />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.slice(0, 6).map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }}
        />
      </Section>

      <Section id="contact" eyebrow="Talk to us" title="Have a question first?" intro="Call or message us on WhatsApp and we will be glad to help." center>
        <div className="flex justify-center"><ContactButtons academy={academy} /></div>
      </Section>

      <CtaBand academy={academy} />
    </>
  );
}
