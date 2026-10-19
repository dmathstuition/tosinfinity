import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/(auth)/actions';
import { Logo } from '@/components/brand/Logo';
import { AuthGuard } from '@/components/portal/AuthGuard';
import { BottomNav } from '@/components/portal/BottomNav';
import { MobileNav } from '@/components/portal/MobileNav';
import { NavLinks, type NavItem } from '@/components/portal/NavLinks';
import { NotificationBell, type NotificationItem } from '@/components/portal/NotificationBell';
import { ThemeToggle } from '@/components/portal/ThemeToggle';
import type { SessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const ROLE_LABEL = { owner: 'Owner', student: 'Student', parent: 'Parent' } as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

/**
 * Authenticated layout shared by the Owner, Student and Parent areas. Loads the
 * signed-in user's notifications, then renders the frame.
 */
export async function PortalShell({
  profile, nav, home, tabs, center, children,
}: {
  profile: SessionProfile; nav: NavItem[]; home: string; tabs?: NavItem[]; center?: { href: string; label: string }; children: ReactNode;
}) {
  const supabase = createClient();
  const [{ count }, { data: recent }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).is('read_at', null),
    supabase.from('notifications').select('id, title, body, href, read_at, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(8),
  ]);
  return (
    <>
      <AuthGuard />
      <ShellFrame profile={profile} nav={nav} home={home} tabs={tabs} center={center} unread={count ?? 0} recent={recent ?? []}>{children}</ShellFrame>
    </>
  );
}

/**
 * The visual frame: a slim icon rail on desktop, a drawer on phones, and a soft
 * canvas that the page's cards and pastel tiles sit on. No data access here.
 */
export function ShellFrame({
  profile, nav, home, tabs, center, unread, recent, children,
}: {
  profile: Pick<SessionProfile, 'full_name' | 'role' | 'student_code'>; nav: NavItem[]; home: string; tabs?: NavItem[]; center?: { href: string; label: string };
  unread: number; recent: NotificationItem[]; children: ReactNode;
}) {

  const avatar = (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cta font-heading text-sm font-bold text-navy">
      {initials(profile.full_name)}
    </span>
  );

  // Drawer footer (mobile): name, role and a full-width sign-out button.
  const drawerAccount = (
    <div className="m-3 rounded-2xl bg-sunken p-3">
      <div className="flex items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{profile.full_name}</p>
          <p className="truncate text-xs text-muted">{ROLE_LABEL[profile.role]}{profile.student_code ? ` · ${profile.student_code}` : ''}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-3">
        <button type="submit" className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-surface text-sm font-semibold shadow-xs">
          <LogOut size={16} aria-hidden="true" /> Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cloud text-ink">
      {/* Desktop rail */}
      <aside className="no-print fixed inset-y-3 left-3 z-30 hidden w-[6.75rem] flex-col rounded-panel bg-surface shadow-card lg:flex">
        <Link href={home} className="flex h-[5rem] shrink-0 items-center justify-center pt-1" aria-label="Dashboard">
          <Logo variant="emblem" size={40} />
        </Link>
        <nav aria-label="Portal" className="flex-1 overflow-y-auto px-2 pb-2">
          <NavLinks items={nav} home={home} variant="rail" />
        </nav>
        <form action={signOutAction} className="flex shrink-0 flex-col items-center gap-1 border-t border-line/70 px-1 py-3">
          <button type="submit" className="group flex flex-col items-center gap-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors group-hover:bg-tile-rose group-hover:text-bad">
              <LogOut size={19} aria-hidden="true" />
            </span>
            <span className="text-[0.68rem] font-medium text-muted group-hover:text-ink">Sign out</span>
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-col lg:pl-[8.25rem]">
        <header className="no-print sticky top-0 z-20 flex h-[4.5rem] items-center justify-between gap-3 bg-cloud/90 px-4 backdrop-blur-xl sm:px-6 lg:pl-2 lg:pr-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <MobileNav items={nav} home={home} footer={drawerAccount} />
            <Link href={home} aria-label="Dashboard"><Logo variant="emblem" size={36} /></Link>
          </div>
          <p className="hidden font-heading text-sm font-semibold text-muted lg:block">
            Tosinfinity Academy <span aria-hidden="true" className="mx-1.5">/</span> <span className="text-ink">{ROLE_LABEL[profile.role]} portal</span>
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-surface p-1 shadow-xs">
              <ThemeToggle />
              <NotificationBell unread={unread} items={recent} allHref={`${home}/notifications`} />
            </div>
            <div className="hidden items-center gap-2.5 rounded-full bg-surface py-1 pl-1 pr-4 shadow-xs sm:flex">
              {avatar}
              <div className="min-w-0 leading-tight">
                <p className="max-w-[10rem] truncate text-sm font-semibold">{profile.full_name}</p>
                <p className="truncate text-[0.7rem] text-muted">{ROLE_LABEL[profile.role]}{profile.student_code ? ` · ${profile.student_code}` : ''}</p>
              </div>
            </div>
          </div>
        </header>
        <main id="main" className={`mx-auto w-full max-w-[82rem] flex-1 animate-fade px-4 pt-2 sm:px-6 lg:pb-10 lg:pl-2 lg:pr-6 ${tabs?.length ? 'pb-28' : 'pb-10'}`}>
          {children}
        </main>
        {tabs?.length ? <BottomNav tabs={tabs} home={home} center={center} /> : null}
      </div>
    </div>
  );
}
