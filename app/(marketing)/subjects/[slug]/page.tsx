import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CtaBand, DeliveryCards, PageHero, ProgrammeCard, Section } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { publicEnv } from '@/lib/env';
import { Markdown } from '@/lib/markdown';
import { DELIVERY } from '@/lib/marketing-content';
import { CATEGORY_LABEL, getProgramme, getProgrammes } from '@/lib/programmes';
import { getSiteSettings } from '@/lib/site';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProgramme(params.slug);
  if (!p) return {};
  return { title: p.title, description: p.summary, alternates: { canonical: `/subjects/${p.slug}` } };
}

const INCLUDED = [
  'An initial conversation and assessment of current level',
  'Lessons planned around the learner’s gaps and goals',
  'Assignments and practice between lessons',
  'Regular assessments with written feedback',
  'Progress reports shared with parents',
];

export default async function ProgrammePage({ params }: Props) {
  const [programme, all, { academy }] = await Promise.all([getProgramme(params.slug), getProgrammes(), getSiteSettings()]);
  if (!programme) notFound();
  const related = all.filter((p) => p.category === programme.category && p.slug !== programme.slug).slice(0, 3);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: programme.title,
          description: programme.summary,
          provider: { '@type': 'EducationalOrganization', name: academy.name, url: publicEnv.siteUrl },
        }}
      />
      <PageHero
        eyebrow={CATEGORY_LABEL[programme.category] + (programme.level ? ` · ${programme.level}` : '')}
        title={programme.title}
        intro={programme.summary}
      >
        <ButtonLink href="/apply">Apply for Tutoring</ButtonLink>
        <ButtonLink href="/contact" variant="onDark">Ask a question</ButtonLink>
      </PageHero>

      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {programme.description ? (
            <Markdown source={programme.description} />
          ) : (
            <p className="text-lg text-muted">
              Lessons follow the learner’s school syllabus and pace. After an initial assessment, we agree the topics to
              prioritise and review progress regularly.
            </p>
          )}
        </div>
        <aside className="card h-fit p-6">
          <h2 className="text-lg font-semibold">What tutoring includes</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {INCLUDED.map((i) => (
              <li key={i} className="flex gap-2">
                <Check size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" /> {i}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <Section id="delivery" title="Available at home or online" className="bg-surface">
        <DeliveryCards items={DELIVERY} />
      </Section>

      {related.length > 0 && (
        <Section id="related" title="Related programmes">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => <ProgrammeCard key={p.slug} programme={p} />)}
          </div>
        </Section>
      )}
      <CtaBand academy={academy} />
    </>
  );
}
