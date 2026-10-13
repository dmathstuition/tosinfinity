import { AccountPage } from '@/components/portal/AccountPage';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Account' };

export default async function Page() {
  const { profile } = await parentContext();
  return <AccountPage profile={profile} />;
}
