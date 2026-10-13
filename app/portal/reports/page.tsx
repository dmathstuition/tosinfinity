import { ProgressBars, ReportList } from '@/components/family/views';
import { Card, PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Reports' };

export default async function Page() {
  const { profile } = await studentContext();
  return (
    <>
      <PageHeader title="Reports and certificates" description="Your progress reports, learning targets and certificates." />
      <div className="mb-6"><Card><h2 className="mb-3 text-lg font-semibold">Progress trend</h2><ProgressBars studentId={profile.id} /></Card></div>
      <ReportList studentId={profile.id} base="/portal" />
    </>
  );
}
