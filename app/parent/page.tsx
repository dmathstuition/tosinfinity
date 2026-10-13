import Link from 'next/link';
import { ChildSwitcher, NoChildren } from '@/components/family/ChildSwitcher';
import { AssignmentList, AttendanceSummary, InvoiceList, ProgressBars, ReportList, UpcomingClasses } from '@/components/family/views';
import { SectionHeading, WelcomeBanner } from '@/components/portal/WelcomeBanner';
import { Card } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Dashboard' };

const SectionTitle = SectionHeading;

export default async function ParentDashboard({ searchParams }: { searchParams: { child?: string } }) {
  const { profile, supabase, children, child } = await parentContext(searchParams.child);
  if (!child) {
    return (
      <>
        <WelcomeBanner eyebrow="Parent portal" title={`Welcome, ${profile.full_name.split(' ')[0]}`} />
        <NoChildren />
      </>
    );
  }
  const q = `?child=${child.id}`;
  const { count: unread } = await supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', profile.id);

  return (
    <>
      <WelcomeBanner eyebrow="Parent portal" title={`Welcome, ${profile.full_name.split(' ')[0]}`} description="Follow your child’s classes, progress and invoices." />
      <ChildSwitcher childList={children} current={child} path="/parent" />
      {(unread ?? 0) > 0 && (
        <Link href="/parent/messages" className="mb-6 block rounded-xl border border-orange bg-orange/10 px-4 py-3 text-sm font-medium hover:underline">
          You have {unread} unread message{unread === 1 ? '' : 's'} from the academy.
        </Link>
      )}

      <section aria-label="Upcoming classes" className="mb-8">
        <SectionTitle title="Upcoming classes" href={`/parent/timetable${q}`} link="All classes" />
        <UpcomingClasses studentId={child.id} limit={3} roomBase="/parent/classes" />
      </section>

      <section aria-label="Attendance" className="mb-8">
        <SectionHeading title="Attendance" />
        <AttendanceSummary studentId={child.id} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="Recent results and feedback">
          <SectionTitle title="Recent results and tutor feedback" href={`/parent/progress${q}`} link="All results" />
          <AssignmentList studentId={child.id} only="graded" />
        </section>
        <Card className="h-fit">
          <SectionTitle title="Progress trend" href={`/parent/progress${q}`} link="Details" />
          <ProgressBars studentId={child.id} />
        </Card>
      </div>

      <section aria-label="Reports" className="mt-8">
        <ReportList studentId={child.id} base="/parent" />
      </section>

      <section aria-label="Invoices" className="mt-8">
        <SectionTitle title="Invoices and payments" href={`/parent/invoices${q}`} link="All invoices" />
        <InvoiceList studentId={child.id} base="/parent" limit={3} />
      </section>
    </>
  );
}
