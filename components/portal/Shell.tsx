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
  profile, nav, home, tabs, children,
}: {
  profile: SessionProfile; nav: NavItem[]; home: string; tabs?: NavItem[]; children: ReactNode;
}) {
  const supabase = createClient();
  const [{ count }, { data: recent }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).is('read_at', null),
    supabase.from('notifications').select('id, title, body, href, read_at, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(8),
  ]);
  return (
    <>
      <AuthGuard />
      <ShellFrame profile={profile} nav={nav} home={home} tabs={tabs} unread={count ?? 0} recent={recent ?? []}>{children}</ShellFrame>
    </>
  );
}

/**
 * The visual frame. Large screens: a labelled sidebar (logo, grouped menu, the
 * signed-in person and sign-out). Phones and tablets: a slim header and a tab bar
 * at the bottom whose "More" tab opens the full menu. No data access here.
 */
export function ShellFrame({
  profile, nav, home, tabs, unread, recent, children,
}: {
  profile: Pick<SessionProfile, 'full_name' | 'role' | 'student_code'>; nav: NavItem[]; home: string; tabs?: NavItem[];
  unread: number; recent: NotificationItem[]; children: ReactNode;
}) {
  const avatar = (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-royal font-heading text-sm font-bold text-white">
      {initials(profile.full_name)}
    </span>
  );
  const who = (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-sm font-semibold">{profile.full_name}</p>
      <p className="truncate text-xs text-muted">{ROLE_LABEL[profile.role]}{profile.student_code ? ` · ${profile.student_code}` : ''}</p>
    </div>
  );
  const signOut = (full: boolean) => (
    <form action={signOutAction}>
      <button type="submit" className={full
        ? 'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold hover:bg-sunken'
        : 'grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-tile-rose hover:text-bad'} aria-label={full ? undefined : 'Sign out'} title="Sign out">
        <LogOut size={full ? 16 : 18} aria-hidden="true" />{full && ' Sign out'}
      </button>
    </form>
  );
  // Phone menu footer: who is signed in, and sign-out.
  const drawerAccount = (
    <div className="m-3 rounded-2xl bg-sunken p-3">
      <div className="mb-3 flex items-center gap-3">{avatar}{who}</div>
      {signOut(true)}
    </div>
  );

  return (
    <div className="min-h-dvh bg-cloud text-ink">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <Link href={home} className="flex h-[4.5rem] shrink-0 items-center px-5" aria-label="Dashboard">
          <Logo size={34} />
        </Link>
        <nav aria-label="Portal" className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <NavLinks items={nav} home={home} />
        </nav>
        <div className="flex shrink-0 items-center gap-3 border-t border-line p-4">
          {avatar}
          <div className="min-w-0 flex-1">{who}</div>
          {signOut(false)}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line/70 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:h-[4.5rem] lg:border-b-0 lg:bg-cloud/85">
          <Link href={home} aria-label="Dashboard" className="lg:hidden"><Logo size={30} /></Link>
          <p className="hidden text-sm font-medium text-muted lg:block">
            {ROLE_LABEL[profile.role]} portal
          </p>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell unread={unread} items={recent} allHref={`${home}/notifications`} />
            {!tabs?.length && <MobileNav items={nav} home={home} footer={drawerAccount} />}
          </div>
        </header>
        <main id="main" className={`mx-auto w-full max-w-[80rem] flex-1 animate-fade px-4 pt-4 sm:px-6 lg:px-8 lg:pb-12 ${tabs?.length ? 'pb-28' : 'pb-10'}`}>
          {children}
        </main>
        {tabs?.length ? <BottomNav tabs={tabs} home={home} menu={nav} menuFooter={drawerAccount} /> : null}
      </div>
    </div>
  );
}
