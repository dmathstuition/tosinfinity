import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Atom, BookOpenCheck, Calculator, FileBarChart, FlaskConical, Home, Leaf, Quote, Search, Sigma, Target, UserCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { HeroVisual } from '@/components/marketing/HeroVisual';
import {
  ContactButtons, CtaBand, DeliveryCards, FaqList, ICONS, ProgrammeCard, SampleReport, Section, Steps,
} from '@/components/marketing/sections';
import { FeaturedPosts } from '@/components/marketing/FeaturedPosts';
import { JsonLd } from '@/components/marketing/JsonLd';
import { BENEFITS, DEFAULT_FAQ, DELIVERY, STEPS } from '@/lib/marketing-content';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings, toInternational } from '@/lib/site';
import { publicEnv } from '@/lib/env';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// Service facts only (from the flyer). No figures, results or ratings are shown.
const FEATURES = [
  { icon: UserCheck, title: 'One dedicated tutor', body: 'Personal attention every lesson' },
  { icon: Home, title: 'Home or online', body: 'Learn where it suits your family' },
  { icon: FileBarChart, title: 'Progress reports', body: 'Parents see attendance and results' },
  { icon: BookOpenCheck, title: 'Exam preparation', body: 'WAEC, IGCSE, UTME and SAT Math' },
] as const;

// Subjects as browsable tiles; each opens the subjects page filtered to it.
const SUBJECTS = [
  { label: 'Mathematics', q: 'mathematics', icon: Calculator, tile: 'bg-tile-lilac text-royal' },
  { label: 'Further Maths', q: 'further', icon: Sigma, tile: 'bg-tile-sky text-royal' },
  { label: 'Physics', q: 'physics', icon: Atom, tile: 'bg-tile-peach text-accent' },
  { label: 'Chemistry', q: 'chemistry', icon: FlaskConical, tile: 'bg-tile-rose text-ember' },
  { label: 'Biology', q: 'biology', icon: Leaf, tile: 'bg-tile-mint text-ok' },
  { label: 'Exam prep', q: 'exam', icon: Target, tile: 'bg-tile-sun text-accent' },
] as const;

export default async function HomePage() {
  const [settings, programmes] = await Promise.all([getSiteSettings(), getProgrammes()]);
  const { academy, testimonials } = settings;
  const faq = settings.faq.length ? settings.faq : DEFAULT_FAQ;
  // One from each category in turn, so the featured row shows the range of subjects.
  const byCat = new Map<string, typeof programmes>();
  for (const p of programmes) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  const featured: typeof programmes = [];
  for (let i = 0; featured.length < 4 && i < programmes.length; i++) {
    for (const list of byCat.values()) if (list[i] && featured.length < 4) featured.push(list[i]!);
  }

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
      <section className="relative isolate overflow-hidden bg-surface">
        <div aria-hidden="true" className="absolute -left-40 -top-40 -z-10 h-[28rem] w-[28rem] rounded-full bg-tile-lilac/70 blur-3xl" />
        <div className="container-page grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <Link href="/apply" className="inline-flex animate-rise items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm shadow-xs hover:border-royal/40">
              <span className="rounded-full bg-royal px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-white">New</span>
              Home and online tutoring. <span className="font-semibold text-link">Apply now</span> <ArrowRight size={14} aria-hidden="true" className="text-link" />
            </Link>
            <h1 className="mt-6 animate-rise text-[2.75rem] leading-[1.04] delay-1 sm:text-6xl lg:text-[4.25rem]">
              Learn. Grow.<br /><span className="text-royal">Succeed.</span>
            </h1>
            <p className="mt-5 max-w-lg animate-rise text-lg leading-relaxed text-muted delay-2">
              Are you in need of a private tutor? {academy.tagline}
            </p>

            {/* Subject search: opens the subjects page filtered by what was typed. */}
            <form action="/subjects" method="get" role="search" className="mt-8 flex max-w-lg animate-rise items-center gap-2 rounded-xl border border-line bg-surface p-1.5 shadow-card delay-3">
              <Search size={18} aria-hidden="true" className="ml-2 shrink-0 text-muted" />
              <label htmlFor="hero-q" className="sr-only">What do you want to learn?</label>
              <input id="hero-q" name="q" type="search" placeholder="What do you want to learn? e.g. Physics, WAEC" className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70" />
              <button type="submit" className="min-h-[44px] shrink-0 rounded-lg bg-royal px-5 text-sm font-semibold text-white hover:bg-[#2a22d6]">Search</button>
            </form>

            <div className="mt-6 flex animate-rise flex-wrap gap-3 delay-4">
              <ButtonLink href="/apply" size="lg" variant="accent">Apply for Tutoring <ArrowRight size={18} aria-hidden="true" /></ButtonLink>
              <ButtonLink href="/how-it-works" size="lg" variant="outline">How it works</ButtonLink>
            </div>
          </div>
          <HeroVisual />
        </div>

        {/* Feature strip */}
        <div className="border-y border-line bg-surface">
          <ul className="container-page grid grid-cols-2 gap-x-6 gap-y-5 py-6 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tile-lilac text-royal"><Icon size={20} aria-hidden="true" /></span>
                <span><span className="block text-sm font-semibold text-navy">{title}</span><span className="block text-xs text-muted">{body}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <Section id="programmes" title="Featured programmes" intro="Every programme is available as home or online tutoring." action={{ href: '/subjects', label: 'Explore all programmes' }}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => <li key={p.slug}><ProgrammeCard programme={p} /></li>)}
          </ul>
        </Section>
      )}

      <Section id="subjects" title="Browse by subject" action={{ href: '/subjects', label: 'View all subjects' }} className="!pt-0">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SUBJECTS.map(({ label, q, icon: Icon, tile }) => (
            <li key={label}>
              <Link href={`/subjects?q=${q}`} className="card flex h-full flex-col items-center gap-3 p-5 text-center transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card">
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tile}`}><Icon size={22} aria-hidden="true" /></span>
                <span className="text-sm font-semibold text-navy">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="why" title="Why families choose Tosinfinity" intro="Personal attention from one dedicated tutor, with families kept informed at every step." className="border-y border-line bg-surface">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <li key={b.title} className="rounded-card border border-line bg-cloud p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-royal text-white"><Icon size={20} aria-hidden="true" /></span>
                <h3 className="mt-5 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="how" title="A clear path from enquiry to progress" center>
        <Steps steps={STEPS} />
        <div className="mt-10 flex justify-center">
          <ButtonLink href="/how-it-works" variant="outline">More about how it works <ArrowRight size={16} aria-hidden="true" /></ButtonLink>
        </div>
      </Section>

      <Section id="delivery" title="Home or online: choose what suits your family" className="border-y border-line bg-surface">
        <DeliveryCards items={DELIVERY} />
      </Section>

      <Section id="reports" title="Progress you can see" intro="Parents and students see attendance, results and next steps in their own secure account, and receive a short progress email every week. The example below shows the format.">
        <SampleReport />
      </Section>

      {/* Mission */}
      <section className="px-4 sm:px-6" aria-labelledby="mission-title">
        <div className="mx-auto max-w-6xl rounded-panel border border-line bg-surface px-6 py-14 text-center sm:py-16">
          <Quote size={30} aria-hidden="true" className="mx-auto text-gold" />
          <h2 id="mission-title" className="eyebrow mt-4 justify-center">Our mission</h2>
          <blockquote className="mx-auto mt-5 max-w-3xl font-display text-2xl font-semibold leading-snug text-navy sm:text-3xl">{academy.mission}</blockquote>
        </div>
      </section>

      {testimonials.length > 0 && (
        <Section id="testimonials" title="What parents and learners say">
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <li key={t.quote} className="card flex flex-col p-7">
                <Quote size={26} className="text-gold" aria-hidden="true" />
                <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink">{t.quote}</blockquote>
                <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                  <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-royal font-heading text-sm font-semibold text-white">{t.author.slice(0, 1).toUpperCase()}</span>
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

      <Section id="faq" title="Frequently asked questions" className="border-y border-line bg-surface" center>
        <FaqList items={faq.slice(0, 6)} />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.slice(0, 6).map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
          }}
        />
      </Section>

      <Section id="contact" title="Have a question first?" intro="Call or message us on WhatsApp and we will be glad to help." center>
        <div className="flex justify-center"><ContactButtons academy={academy} /></div>
      </Section>

      <CtaBand academy={academy} />
    </>
  );
}
