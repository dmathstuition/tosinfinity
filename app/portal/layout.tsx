import type { Metadata } from 'next';
import type { NavItem } from '@/components/portal/NavLinks';
import { PortalShell } from '@/components/portal/Shell';
import { aiConfigured } from '@/lib/ai';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = { title: { default: 'Student portal', template: '%s | Tosinfinity Academy' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole('student');
  const nav: NavItem[] = [
    { href: '/portal', label: 'Dashboard', icon: 'dashboard' },
    { href: '/portal/timetable', label: 'Timetable', icon: 'classes', group: 'Learning' },
    { href: '/portal/assignments', label: 'Assignments', icon: 'assignments', group: 'Learning' },
    { href: '/portal/materials', label: 'Materials', icon: 'materials', group: 'Learning' },
    { href: '/portal/reports', label: 'Reports', icon: 'reports', group: 'Learning' },
    { href: '/portal/messages', label: 'Messages', icon: 'messages', group: 'Updates' },
    { href: '/portal/notices', label: 'Announcements', icon: 'notices', group: 'Updates' },
    { href: '/portal/invoices', label: 'Invoices', icon: 'billing', group: 'Account' },
    ...(aiConfigured() ? [{ href: '/portal/assistant', label: 'Learn with AI', icon: 'assistant', group: 'Learning' } as NavItem] : []),
    { href: '/portal/account', label: 'Account', icon: 'settings', group: 'Account' },
  ];
  const tabs: NavItem[] = [
    { href: '/portal', label: 'Home', icon: 'dashboard' },
    { href: '/portal/timetable', label: 'Classes', icon: 'classes' },
    { href: '/portal/assignments', label: 'Work', icon: 'assignments' },
    { href: '/portal/reports', label: 'Progress', icon: 'reports' },
  ];
  return (
    <PortalShell profile={profile} nav={nav} home="/portal" tabs={tabs} center={aiConfigured() ? { href: '/portal/assistant', label: 'Learn with AI' } : undefined}>
      {children}
    </PortalShell>
  );
}
