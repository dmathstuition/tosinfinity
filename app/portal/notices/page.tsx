import { NoticeList } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Announcements' };

export default async function Page() {
  await studentContext();
  return (
    <>
      <PageHeader title="Announcements" />
      <NoticeList />
    </>
  );
}
