import type { Metadata } from 'next';
import { CtaBand, DeliveryCards, PageHero, SampleReport, Section, Steps } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { DELIVERY, STEPS } from '@/lib/marketing-content';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'How enrolment, assessment, scheduling and progress reporting work at Tosinfinity Academy.',
  alternates: { canonical: '/how-it-works' },
};

const PORTAL = [
  { title: 'Timetable', body: 'Upcoming lessons with the date, time and whether they are at home or online. Online lessons have a join button.' },
  { title: 'Assignments', body: 'Written work, quizzes and timed practice, with due dates, marks and feedback.' },
  { title: 'Reports', body: 'Attendance summaries, assessment results, strengths, areas to improve and next steps.' },
  { title: 'Messages and invoices', body: 'Private messages with the tutor, plus invoices, receipts and payment history.' },
];

export default async function HowItWorksPage() {
  const { academy } = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="How it works" title="From first enquiry to steady progress" intro="A simple process, with families kept informed at every stage.">
        <ButtonLink href="/apply">Apply for Tutoring</ButtonLink>
      </PageHero>
      <Section id="enrolment" eyebrow="Enrolment" title="Four steps to get started">
        <Steps steps={STEPS} />
      </Section>
      <Section id="delivery" eyebrow="Scheduling" title="Home versus online learning" className="bg-surface"
        intro="Lesson days and times are agreed with each family. If a lesson needs to move, affected families are notified.">
        <DeliveryCards items={DELIVERY} />
      </Section>
      <Section id="portal" eyebrow="Your account" title="What students and parents can see">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PORTAL.map((p) => (
            <li key={p.title} className="card p-5">
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="reporting" eyebrow="Reporting" title="What a progress report looks like" className="bg-surface">
        <SampleReport />
      </Section>
      <CtaBand academy={academy} />
    </>
  );
}
