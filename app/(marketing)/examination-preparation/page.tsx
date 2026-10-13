import type { Metadata } from 'next';
import { CtaBand, PageHero, ProgrammeCard, Section, Steps } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Examination Preparation',
  description: 'Preparation for WAEC, IGCSE, selected UTME topics and SAT Mathematics Foundation.',
  alternates: { canonical: '/examination-preparation' },
};

const METHOD = [
  { title: 'Diagnose', body: 'A starting assessment shows which topics are secure and which need the most attention.' },
  { title: 'Plan', body: 'A revision plan is set against the time left before the examination.' },
  { title: 'Practise', body: 'Past questions and timed practice build familiarity with the question style.' },
  { title: 'Review', body: 'Mistakes are analysed and revisited, and progress is reported to parents.' },
];

export default async function ExamPrepPage() {
  const [programmes, { academy }] = await Promise.all([getProgrammes(), getSiteSettings()]);
  const exam = programmes.filter((p) => p.category === 'exam_prep' || p.slug === 'sat-mathematics-foundation');
  return (
    <>
      <PageHero
        eyebrow="Examination preparation"
        title="Prepare with a plan, not last-minute panic"
        intro="Structured preparation for WAEC, IGCSE, selected UTME topics and SAT Mathematics Foundation."
      >
        <ButtonLink href="/apply">Apply for Tutoring</ButtonLink>
      </PageHero>
      <Section id="exams" title="Examinations we prepare learners for">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {exam.map((p) => <ProgrammeCard key={p.slug} programme={p} />)}
        </div>
      </Section>
      <Section id="method" eyebrow="Our method" title="How preparation is organised" className="bg-surface">
        <Steps steps={METHOD} />
        <p className="mt-6 max-w-2xl text-sm text-muted">
          Examination outcomes depend on many factors, including the learner’s own effort and the time available. We do not
          promise specific grades; we commit to clear teaching, honest feedback and regular reporting.
        </p>
      </Section>
      <CtaBand academy={academy} />
    </>
  );
}
