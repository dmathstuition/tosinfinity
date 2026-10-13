import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/sections';
import { ApplyForm } from './ApplyForm';

export const metadata: Metadata = {
  title: 'Apply for Tutoring',
  description: 'Apply for home or online tutoring with Tosinfinity Academy. No payment is taken when you apply.',
  alternates: { canonical: '/apply' },
};

export default function ApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="Enrolment"
        title="Apply for Tutoring"
        intro="Four short steps. Tell us about the learner and what they need, and we will contact you to discuss the next steps."
      />
      <div className="container-page max-w-2xl py-10 sm:py-14">
        <ApplyForm />
      </div>
    </>
  );
}
