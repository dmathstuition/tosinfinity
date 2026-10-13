import { PageHero } from '@/components/marketing/sections';
import { Markdown } from '@/lib/markdown';
import { getSiteSettings } from '@/lib/site';

/**
 * Baseline policy text describing how this platform actually handles data and
 * payments. It is a starting point, not legal advice: the Owner should review it and
 * can replace any policy with their own wording in Owner → Settings → Policies.
 */
const BASELINE = {
  privacy: `## What we collect
We collect the details you give us when you apply for tutoring or contact us: the learner's name, age or date of birth, school year and learning needs, and the parent or guardian's name, email address and phone number. If the learner enrols, we also keep records needed to teach them: timetable, attendance, assignments, results, reports, messages and invoices.

## How we use it
We use this information only to respond to enquiries, deliver tutoring, report progress to the learner and their linked parent or guardian, and manage billing. We do not sell personal information.

## Who can see it
Each student sees only their own records. A parent or guardian sees only the records of children linked to their account. The academy owner can see the records needed to run the academy.

## Service providers
The platform relies on third-party services for hosting, database storage, email delivery and, where you choose to pay online, payment processing. Card details are entered on the payment provider's own pages and are never stored by us.

## Cookies
We use essential cookies to keep you signed in. If analytics are enabled, they are used only to understand how the public website is used.

## Keeping and deleting information
We keep learner records while the learner is enrolled and for a reasonable period afterwards. Financial records are kept for as long as accounting rules require. You can ask us to correct or delete personal information, subject to those obligations.

## Newsletter
If you subscribe to our articles, we store your email address and the date you consented. Every email includes a one-click unsubscribe link.

## Contact
For any privacy question or request, please use the details on our contact page.`,
  terms: `## About these terms
These terms apply to the use of this website and the student and parent accounts provided by Tosinfinity Academy.

## Applications and enrolment
Submitting an application does not guarantee a place. Enrolment is confirmed once the academy and the family have agreed a schedule and fees.

## Accounts
Keep your sign-in details private. You are responsible for activity on your account. Tell us promptly if you believe someone else has accessed it.

## Lessons
Lesson times are agreed with each family. If you need to move or cancel a lesson, please give as much notice as you can. Where the academy needs to reschedule, affected families are notified.

## Learning materials
Materials shared through the platform are for the enrolled learner's personal study and should not be redistributed.

## Fees
Fees and billing arrangements are agreed with each family before lessons begin and are shown on invoices in the account.

## Conduct
We ask learners and families to treat lessons and messages with respect. The academy may suspend access where the platform is misused.

## Changes
We may update these terms from time to time. The current version is always available on this page.`,
  refund: `## Refunds
Fees and any refund arrangements are agreed with each family before lessons begin.

If you believe you have been charged incorrectly, or you would like to discuss a refund for lessons that have been paid for but not delivered, please contact us using the details on our contact page. We will review the invoice and payment record with you.

Payments made online are processed by our payment provider. Approved refunds for online payments are returned through the same provider and can take several working days to appear.`,
};

export async function PolicyPage({ kind, title }: { kind: keyof typeof BASELINE; title: string }) {
  const { policies } = await getSiteSettings();
  return (
    <>
      <PageHero title={title} />
      <div className="container-page max-w-3xl py-12">
        <Markdown source={policies[kind] || BASELINE[kind]} />
      </div>
    </>
  );
}
