import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { ContactButtons } from '@/components/marketing/sections';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = { title: 'Application received', robots: { index: false } };

export default async function ReceivedPage() {
  const { academy } = await getSiteSettings();
  return (
    <div className="container-page max-w-2xl py-16 sm:py-24">
      <div className="card p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto text-ok" size={56} aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-semibold">Thank you. Your application has been received.</h1>
        <p className="mt-3 text-muted">Here is what happens next:</p>
        <ol className="mx-auto mt-5 max-w-md list-decimal space-y-2 pl-5 text-left">
          <li>We review your application.</li>
          <li>We contact you by phone or email to discuss the learner’s needs and a suitable schedule.</li>
          <li>Once a place is agreed, you receive a secure link to activate the learner’s account.</li>
        </ol>
        <p className="mt-5 text-sm text-muted">If an acknowledgement email does not arrive, please check your spam folder. No payment is required at this stage.</p>
        <div className="mt-8 flex justify-center">
          <ButtonLink href="/" variant="secondary">Back to home</ButtonLink>
        </div>
        <div className="mt-6 flex justify-center">
          <ContactButtons academy={academy} />
        </div>
      </div>
    </div>
  );
}
