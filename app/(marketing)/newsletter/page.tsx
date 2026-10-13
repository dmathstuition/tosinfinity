import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Newsletter', robots: { index: false } };

const COPY: Record<string, { title: string; body: string }> = {
  verified: { title: 'Subscription confirmed', body: 'Thank you. You will receive new articles from Tosinfinity Academy by email.' },
  unsubscribed: { title: 'You have been unsubscribed', body: 'You will not receive any more newsletter emails from us. You can subscribe again at any time.' },
  invalid: { title: 'This link is not valid', body: 'It may have expired or already been used. You can subscribe again from the form at the bottom of any page.' },
};

export default function NewsletterPage({ searchParams }: { searchParams: { state?: string } }) {
  const copy = COPY[searchParams.state ?? ''] ?? COPY.invalid!;
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <h1 className="text-3xl font-semibold">{copy.title}</h1>
      <p className="mt-3 text-muted">{copy.body}</p>
      <div className="mt-8 flex justify-center"><ButtonLink href="/blog" variant="secondary">Read the blog</ButtonLink></div>
    </div>
  );
}
