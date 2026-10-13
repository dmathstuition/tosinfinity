import type { Metadata } from 'next';
import { CtaBand, PageHero, ProgrammeGroups } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Subjects and Programmes',
  description: 'Mathematics, Physics, Chemistry, Biology and examination preparation for WAEC, IGCSE and UTME topics.',
  alternates: { canonical: '/subjects' },
};

export default async function SubjectsPage() {
  const [programmes, { academy }] = await Promise.all([getProgrammes(), getSiteSettings()]);
  return (
    <>
      <PageHero
        eyebrow="Subjects and programmes"
        title="Find the right programme"
        intro="Every programme is available as home tutoring or online tutoring."
      >
        <ButtonLink href="/apply">Apply for Tutoring</ButtonLink>
      </PageHero>
      <div className="container-page py-14">
        <ProgrammeGroups programmes={programmes} />
      </div>
      <CtaBand academy={academy} />
    </>
  );
}
