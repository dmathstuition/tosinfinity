import { NotificationsPage } from '@/components/portal/NotificationsPage';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Notifications' };

export default async function Page() {
  const { profile } = await studentContext();
  return <NotificationsPage userId={profile.id} />;
}
