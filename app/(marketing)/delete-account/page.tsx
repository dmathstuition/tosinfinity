import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/marketing/sections';
import { Alert } from '@/components/ui/primitives';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How students and parents can delete their Tosinfinity Academy account and what happens to their data.',
  alternates: { canonical: '/delete-account' },
};

export default async function DeleteAccountPage({ searchParams }: { searchParams: { done?: string } }) {
  const { academy } = await getSiteSettings();
  const contact = [academy.email, ...academy.phones].filter(Boolean).join(' · ');
  return (
    <>
      <PageHero eyebrow="Your data" title="Delete your account" />
      <div className="container-page max-w-3xl space-y-6 py-14">
        {searchParams.done === '1' && <Alert tone="success">Your account has been deleted and you have been signed out.</Alert>}
        <section className="card space-y-3 p-6">
          <h2 className="text-xl font-semibold">Delete it yourself</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li><Link href="/login" className="text-link underline">Sign in</Link> to your student or parent portal.</li>
            <li>Open <strong>Account</strong>.</li>
            <li>Under <strong>Delete account</strong>, enter your password, type <strong>DELETE</strong> and confirm.</li>
          </ol>
          <p>It happens straight away and cannot be undone.</p>
        </section>
        <section className="card space-y-3 p-6">
          <h2 className="text-xl font-semibold">What is deleted and what is kept</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Deleted:</strong> your name, contact details, messages, notifications, class records, attendance, work and marks, reports, certificates and parent links.</li>
            <li><strong>Kept:</strong> invoices and payments, because the law requires financial records to be retained. They are no longer linked to your name, email or phone number.</li>
          </ul>
          <p>A parent who deletes their own account does not delete their child’s account.</p>
        </section>
        <section className="card space-y-2 p-6">
          <h2 className="text-xl font-semibold">Cannot sign in?</h2>
          <p>Contact the academy and ask for your account to be deleted. We will confirm once it is done.{contact && <> {contact}</>}</p>
        </section>
      </div>
    </>
  );
}
