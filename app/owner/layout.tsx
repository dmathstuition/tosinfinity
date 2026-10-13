import type { Metadata } from 'next';
import type { NavItem } from '@/components/portal/NavLinks';
import { PortalShell } from '@/components/portal/Shell';
import { ownerContext } from '@/lib/owner';

export const metadata: Metadata = { title: { default: 'Owner', template: '%s | Owner | Tosinfinity Academy' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { profile, supabase } = await ownerContext();
  const [{ count: pending }, { count: toGrade }] = await Promise.all([
    supabase.from('applications').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_review']),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
  ]);
  const nav: NavItem[] = [
    { href: '/owner', label: 'Dashboard', icon: 'dashboard' },
    { href: '/owner/applications', label: 'Applications', icon: 'applications', group: 'People', badge: pending ?? 0 },
    { href: '/owner/students', label: 'Students', icon: 'students', group: 'People' },
    { href: '/owner/classes', label: 'Classes', icon: 'classes', group: 'Teaching' },
    { href: '/owner/assignments', label: 'Assignments', icon: 'assignments', group: 'Teaching', badge: toGrade ?? 0 },
    { href: '/owner/resources', label: 'Resources', icon: 'resources', group: 'Teaching' },
    { href: '/owner/reports', label: 'Reports', icon: 'reports', group: 'Teaching' },
    { href: '/owner/messages', label: 'Messages', icon: 'messages', group: 'Communication' },
    { href: '/owner/notices', label: 'Announcements', icon: 'notices', group: 'Communication' },
    { href: '/owner/billing', label: 'Billing', icon: 'billing', group: 'Business' },
    { href: '/owner/blog', label: 'Blog', icon: 'blog', group: 'Business' },
    { href: '/owner/programmes', label: 'Programmes', icon: 'programmes', group: 'Business' },
    { href: '/owner/settings', label: 'Settings', icon: 'settings', group: 'Business' },
  ];
  return <PortalShell profile={profile} nav={nav} home="/owner">{children}</PortalShell>;
}
