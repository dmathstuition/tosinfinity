import { AssignmentList } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Assignments' };

export default async function Page() {
  const { profile } = await studentContext();
  return (
    <>
      <PageHeader title="Assignments" description="Open an assignment to complete it or to see your mark and feedback." />
      <AssignmentList studentId={profile.id} linkBase="/portal/assignments" />
    </>
  );
}
