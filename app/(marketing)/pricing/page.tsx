import type { Metadata } from 'next';
import { ContactButtons, CtaBand, PageHero, Section } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Tutoring rates and billing arrangements at Tosinfinity Academy.',
  alternates: { canonical: '/pricing' },
};

const ARRANGEMENTS = [
  { title: 'Hourly billing', body: 'You are invoiced monthly for the lesson time actually delivered, at the hourly rate agreed with you.' },
  { title: 'Flat tuition', body: 'A fixed monthly or termly fee agreed in advance, with a clear due date.' },
];

export default async function PricingPage() {
  const { academy, pricing } = await getSiteSettings();
  return (
    <>
      <PageHero eyebrow="Pricing" title="Clear fees, agreed before lessons begin" intro="Rates depend on the subject, level and whether lessons are at home or online." />

      <Section id="rates" title="Tutoring rates">
        {pricing.plans.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pricing.plans.map((p) => (
              <li key={p.name} className="card p-6">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2 font-heading text-3xl font-bold text-link">{p.price}</p>
                <p className="mt-2 text-sm text-muted">{p.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          // No prices are invented: this message shows until rates are entered in Owner Settings.
          <div className="card max-w-2xl p-6">
            <h3 className="text-lg font-semibold">Contact us for current rates</h3>
            <p className="mt-2 text-muted">
              Fees are confirmed with each family after we understand the learner’s needs. Get in touch and we will share the
              current rates for your programme.
            </p>
            <div className="mt-5"><ContactButtons academy={academy} /></div>
          </div>
        )}
        {pricing.note && <p className="mt-6 max-w-2xl text-sm text-muted">{pricing.note}</p>}
      </Section>

      <Section id="billing" eyebrow="Billing arrangements" title="How billing works" className="bg-surface">
        <ul className="grid gap-4 md:grid-cols-2">
          {ARRANGEMENTS.map((a) => (
            <li key={a.title} className="card p-6">
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted">{a.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted">
          Invoices, receipts and payment history are available in the parent and student accounts. See our{' '}
          <a href="/refund-policy" className="text-link underline">refund policy</a>.
        </p>
        <div className="mt-6"><ButtonLink href="/apply">Apply for Tutoring</ButtonLink></div>
      </Section>
      <CtaBand academy={academy} />
    </>
  );
}
