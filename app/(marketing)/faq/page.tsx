import type { Metadata } from 'next';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CtaBand, FaqList, PageHero } from '@/components/marketing/sections';
import { DEFAULT_FAQ } from '@/lib/marketing-content';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Answers to common questions about tutoring with Tosinfinity Academy.',
  alternates: { canonical: '/faq' },
};

export default async function FaqPage() {
  const settings = await getSiteSettings();
  const faq = settings.faq.length ? settings.faq : DEFAULT_FAQ;
  return (
    <>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" />
      <div className="container-page py-14">
        <FaqList items={faq} />
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
        }}
      />
      <CtaBand academy={settings.academy} />
    </>
  );
}
