import { NotificationsPage } from '@/components/portal/NotificationsPage';
import { ownerContext } from '@/lib/owner';

export const metadata = { title: 'Notifications' };

export default async function Page() {
  const { profile } = await ownerContext();
  return <NotificationsPage userId={profile.id} />;
}
