import { AccountPage } from '@/components/portal/AccountPage';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Account' };

export default async function Page() {
  const { profile } = await studentContext();
  return <AccountPage profile={profile} />;
}
