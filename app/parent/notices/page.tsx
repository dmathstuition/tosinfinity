import { NoticeList } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Announcements' };

export default async function Page() {
  await parentContext();
  return (
    <>
      <PageHeader title="Announcements" />
      <NoticeList />
    </>
  );
}
