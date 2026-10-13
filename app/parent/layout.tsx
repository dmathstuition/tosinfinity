import type { Metadata } from 'next';
import type { NavItem } from '@/components/portal/NavLinks';
import { PortalShell } from '@/components/portal/Shell';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = { title: { default: 'Parent portal', template: '%s | Tosinfinity Academy' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

const NAV: NavItem[] = [
  { href: '/parent', label: 'Dashboard', icon: 'dashboard' },
  { href: '/parent/timetable', label: 'Classes', icon: 'classes', group: 'My child' },
  { href: '/parent/progress', label: 'Progress', icon: 'assignments', group: 'My child' },
  { href: '/parent/reports', label: 'Reports', icon: 'reports', group: 'My child' },
  { href: '/parent/messages', label: 'Messages', icon: 'messages', group: 'Updates' },
  { href: '/parent/notices', label: 'Announcements', icon: 'notices', group: 'Updates' },
  { href: '/parent/invoices', label: 'Invoices', icon: 'billing', group: 'Account' },
  { href: '/parent/account', label: 'Account', icon: 'settings', group: 'Account' },
];

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole('parent');
  return <PortalShell profile={profile} nav={NAV} home="/parent">{children}</PortalShell>;
}
