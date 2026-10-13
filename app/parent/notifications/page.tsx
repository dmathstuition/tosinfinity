import { NotificationsPage } from '@/components/portal/NotificationsPage';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Notifications' };

export default async function Page() {
  const { profile } = await parentContext();
  return <NotificationsPage userId={profile.id} />;
}
