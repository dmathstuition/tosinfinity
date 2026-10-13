import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  AlertCircle, ArrowUpRight, CalendarCheck, CalendarPlus, ClipboardCheck, ClipboardList, FilePlus2, Home, Inbox, MessageSquarePlus,
  MonitorPlay, Receipt, UserPlus, Users, Wallet,
} from 'lucide-react';
import type { NavItem } from '@/components/portal/NavLinks';
import { ShellFrame } from '@/components/portal/Shell';
import { ActionTile, SectionHeading, WelcomeBanner } from '@/components/portal/WelcomeBanner';
import { MiniBars, Ring } from '@/components/ui/MiniBars';
import { Alert, Badge, Card, Stat } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Design preview', robots: { index: false, follow: false } };

/**
 * DEVELOPMENT ONLY. Shows the portal shell and dashboard components without a
 * database so the design can be reviewed. Every figure on this page is sample data
 * and is labelled as such. In production this route returns 404.
 */
const NAV: NavItem[] = [
  { href: '/design-preview', label: 'Dashboard', icon: 'dashboard' },
  { href: '/design-preview#a', label: 'Applications', icon: 'applications', group: 'People', badge: 2 },
  { href: '/design-preview#b', label: 'Students', icon: 'students', group: 'People' },
  { href: '/design-preview#c', label: 'Classes', icon: 'classes', group: 'Teaching' },
  { href: '/design-preview#d', label: 'Assignments', icon: 'assignments', group: 'Teaching', badge: 3 },
  { href: '/design-preview#e', label: 'Resources', icon: 'resources', group: 'Teaching' },
  { href: '/design-preview#f', label: 'Reports', icon: 'reports', group: 'Teaching' },
  { href: '/design-preview#g', label: 'Messages', icon: 'messages', group: 'Communication' },
  { href: '/design-preview#h', label: 'Billing', icon: 'billing', group: 'Business' },
  { href: '/design-preview#i', label: 'Settings', icon: 'settings', group: 'Business' },
];
const QUICK = [
  ['Add student', UserPlus], ['Review application', Inbox], ['Schedule class', CalendarPlus], ['Mark attendance', ClipboardCheck],
  ['Create assignment', FilePlus2], ['Send message', MessageSquarePlus], ['Create invoice', Receipt],
] as const;
const CLASSES = [
  { title: 'JSS2 Mathematics: Algebra', meta: '15:00 · 60 min · 1 student', online: true, tile: 'bg-tile-sun' },
  { title: 'SS1 Mathematics: Quadratics', meta: '17:00 · 90 min · 2 students', online: false, tile: 'bg-tile-sky' },
];

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ShellFrame profile={{ full_name: 'Sample Owner', role: 'owner', student_code: null }} nav={NAV} home="/design-preview" unread={2} recent={[]}>
      <div className="mb-4"><Alert tone="warning">Design preview with sample data. Nothing on this page is a real record. This page does not exist in production.</Alert></div>
      <WelcomeBanner eyebrow="Sample day" title="Welcome back, Sample">
        <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {QUICK.map(([label, icon], i) => <ActionTile key={label} href="/design-preview" label={label} icon={icon} index={i} />)}
        </nav>
      </WelcomeBanner>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Active students" value={12} icon={Users} tone="royal" />
            <Stat label="Classes today" value={2} icon={CalendarCheck} tone="lilac" hint="9 this week" />
            <Stat label="Work handed in" value={21} suffix="/ 23" icon={ClipboardList} tone="green" />
            <Stat label="Outstanding" value="₦45,000" icon={AlertCircle} tone="red" hint="3 open invoices" />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="tile bg-tile-sky">
              <h2 className="mb-3 text-lg font-semibold">Classes this week</h2>
              <MiniBars label="Sample classes per day" highlight={2} data={[['Mon', 2], ['Tue', 1], ['Wed', 2], ['Thu', 0], ['Fri', 3], ['Sat', 1], ['Sun', 0]].map(([label, value]) => ({ label: String(label), value: Number(value) }))} />
            </section>
            <section className="card p-5">
              <h2 className="mb-3 text-lg font-semibold">Payments received</h2>
              <MiniBars label="Sample payments per month" highlight={5} format={(n) => `${n}k`} data={[['May', 40], ['Jun', 65], ['Jul', 50], ['Aug', 80], ['Sep', 72], ['Oct', 95]].map(([label, value]) => ({ label: String(label), value: Number(value) }))} />
            </section>
          </div>

          <section className="card p-5 sm:p-6">
            <SectionHeading title="Today’s classes" count={CLASSES.length} href="/design-preview" link="Schedule" />
            <ul className="grid gap-3 sm:grid-cols-2">
              {CLASSES.map((c) => (
                <li key={c.title} className={`flex flex-col rounded-2xl p-4 ${c.tile}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-2.5 py-1 text-xs font-semibold shadow-xs">
                      {c.online ? <MonitorPlay size={14} aria-hidden="true" /> : <Home size={14} aria-hidden="true" />} {c.online ? 'Online' : 'Home'}
                    </span>
                    <Badge tone="blue">scheduled</Badge>
                  </div>
                  <p className="mt-3 font-heading text-lg font-semibold leading-snug" style={{ color: 'rgb(var(--heading))' }}>{c.title}</p>
                  <p className="mt-1 text-sm text-ink/70">{c.meta}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Open class <ArrowUpRight size={15} aria-hidden="true" /></span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <SectionHeading title="Needs attention" />
            <ul className="space-y-2">
              {[['Pending applications', 2, 'bg-tile-peach', Inbox], ['Work to grade', 3, 'bg-tile-sun', ClipboardList], ['Registers to complete', 0, 'bg-tile-lilac', ClipboardCheck], ['Overdue invoices', 1, 'bg-tile-rose', AlertCircle]].map(([label, count, tone, Icon]) => {
                const I = Icon as typeof Inbox;
                return (
                  <li key={String(label)} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-sunken px-3 py-2">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[rgb(var(--heading))] ${tone}`}><I size={18} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{String(label)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${Number(count) > 0 ? 'bg-navy text-white' : 'bg-surface text-muted'}`}>{Number(count)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <section className="tile flex items-center gap-4 bg-tile-sun">
            <Ring percent={92} label="Sample attendance" />
            <div>
              <h2 className="text-lg font-semibold">Attendance</h2>
              <p className="text-sm text-ink/70">11 of 12 lessons attended.</p>
            </div>
          </section>
          <Card>
            <SectionHeading title="Payments" />
            <p className="flex items-center gap-2 text-sm text-muted"><Wallet size={16} aria-hidden="true" /> Sample card content.</p>
          </Card>
        </aside>
      </div>
    </ShellFrame>
  );
}
