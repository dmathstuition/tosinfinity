import Link from 'next/link';
import clsx from 'clsx';
import {
  AlertCircle, ArrowUpRight, CalendarCheck, CalendarPlus, ClipboardCheck, ClipboardList, FilePlus2, Home, Inbox, MessageSquare,
  MessageSquarePlus, MonitorPlay, Receipt, UserPlus, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LocalTime } from '@/components/portal/LocalTime';
import { ActionTile, SectionHeading, WelcomeBanner } from '@/components/portal/WelcomeBanner';
import { MiniBars } from '@/components/ui/MiniBars';
import { Badge, Card, Stat } from '@/components/ui/primitives';
import { formatMoney, minorUnits } from '@/lib/billing';
import { academyLocale, ownerContext } from '@/lib/owner';
import { addDays, formatDate, weekStart, zonedDate, zonedToUtc } from '@/lib/time';

export const metadata = { title: 'Dashboard' };

const QUICK = [
  ['/owner/students/new', 'Add student', UserPlus],
  ['/owner/applications', 'Review application', Inbox],
  ['/owner/classes/new', 'Schedule class', CalendarPlus],
  ['/owner/classes?view=attendance', 'Mark attendance', ClipboardCheck],
  ['/owner/assignments/new', 'Create assignment', FilePlus2],
  ['/owner/messages', 'Send message', MessageSquarePlus],
  ['/owner/billing/new', 'Create invoice', Receipt],
] as const;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CLASS_TILES = ['bg-tile-sun', 'bg-tile-sky', 'bg-tile-lilac', 'bg-tile-mint'];

/** One row in the "Needs attention" column. */
function AttentionRow({ href, icon: Icon, label, count, tone }: { href: string; icon: LucideIcon; label: string; count: number; tone: string }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-[56px] items-center gap-3 rounded-2xl bg-sunken px-3 py-2 transition-colors hover:bg-tile-sky">
        <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[rgb(var(--heading))]', tone)}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
        <span className={clsx('rounded-full px-2.5 py-1 text-sm font-bold tabular-nums', count > 0 ? 'bg-navy text-white' : 'bg-surface text-muted')}>{count}</span>
      </Link>
    </li>
  );
}

export default async function OwnerDashboard() {
  const { profile, supabase } = await ownerContext();
  const { timezone, currency } = await academyLocale();
  const today = zonedDate(new Date(), timezone);
  const at = (date: string) => zonedToUtc(`${date}T00:00`, timezone)!.toISOString();
  const monday = weekStart(today);
  const nowIso = new Date().toISOString();

  // First day of the month five months ago: six calendar months including this one.
  const [y, m] = today.split('-').map(Number) as [number, number];
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d) };
  });

  const [students, pending, todayClasses, weekClasses, needAttendance, toGrade, outstanding, payments, threads, dueSoon] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'active'),
    supabase.from('applications').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_review']),
    supabase.from('classes').select('id, title, starts_at, duration_minutes, delivery, status, class_students(count)').gte('starts_at', at(today)).lt('starts_at', at(addDays(today, 1))).neq('status', 'cancelled').order('starts_at'),
    supabase.from('classes').select('starts_at').gte('starts_at', at(monday)).lt('starts_at', at(addDays(monday, 7))).neq('status', 'cancelled'),
    // Past sessions still marked "scheduled" have no completed register.
    supabase.from('classes').select('id, title, starts_at').lt('starts_at', nowIso).eq('status', 'scheduled').order('starts_at', { ascending: false }).limit(4),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('invoices').select('total_minor, paid_minor, status').in('status', ['unpaid', 'partially_paid', 'overdue']),
    supabase.from('payments').select('amount_minor, paid_at').gte('paid_at', at(`${months[0]!.key}-01`)),
    supabase.from('message_threads').select('id, last_message_at, participant:profiles!message_threads_participant_id_fkey(full_name)').order('last_message_at', { ascending: false }).limit(4),
    supabase.from('invoices').select('id, number, due_date').in('status', ['unpaid', 'partially_paid']).gte('due_date', today).lte('due_date', addDays(today, 7)).order('due_date').limit(4),
  ]);

  const open = outstanding.data ?? [];
  const owed = open.reduce((s, i) => s + (Number(i.total_minor) - Number(i.paid_minor)), 0);
  const overdue = open.filter((i) => i.status === 'overdue').length;

  const perDay = DAYS.map((label, i) => {
    const day = addDays(monday, i);
    return { label, value: (weekClasses.data ?? []).filter((c) => zonedDate(c.starts_at, timezone) === day).length };
  });
  const todayIndex = DAYS.findIndex((_, i) => addDays(monday, i) === today);

  const unit = minorUnits(currency);
  const perMonth = months.map((mo) => ({
    label: mo.label,
    value: Math.round((payments.data ?? []).filter((p) => zonedDate(p.paid_at, timezone).startsWith(mo.key)).reduce((s, p) => s + Number(p.amount_minor), 0) / unit),
  }));
  const thisMonth = (payments.data ?? []).filter((p) => zonedDate(p.paid_at, timezone).startsWith(today.slice(0, 7))).reduce((s, p) => s + Number(p.amount_minor), 0);
  const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  return (
    <>
      <WelcomeBanner eyebrow={formatDate(today)} title={`Welcome back, ${profile.full_name.split(' ')[0]}`}>
        <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {QUICK.map(([href, label, icon], i) => (
            <ActionTile key={href} href={href} label={label} icon={icon} index={i} />
          ))}
        </nav>
      </WelcomeBanner>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Active students" value={students.count ?? 0} icon={Users} tone="royal" />
            <Stat label="Classes today" value={todayClasses.data?.length ?? 0} icon={CalendarCheck} tone="lilac" hint={`${perDay.reduce((s, d) => s + d.value, 0)} this week`} />
            <Stat label="Received this month" value={formatMoney(thisMonth, currency)} icon={Wallet} tone="green" />
            <Stat label="Outstanding" value={formatMoney(owed, currency)} icon={AlertCircle} tone="red" hint={`${open.length} open invoice${open.length === 1 ? '' : 's'}`} />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="week-h" className="tile bg-tile-sky">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="week-h" className="text-lg font-semibold">Classes this week</h2>
                <Link href="/owner/classes" className="rounded-full bg-surface/85 px-3 py-1.5 text-xs font-semibold shadow-xs hover:bg-surface">Calendar</Link>
              </div>
              <MiniBars data={perDay} highlight={todayIndex} label="Number of classes on each day this week" emptyText="No classes are scheduled this week." />
            </section>
            <section aria-labelledby="pay-h" className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="pay-h" className="text-lg font-semibold">Payments received</h2>
                <span className="text-xs font-medium text-muted">{currency} · last 6 months</span>
              </div>
              <MiniBars data={perMonth} highlight={5} format={compact} label={`Payments received in each of the last six months, in ${currency}`} emptyText="No payments have been recorded yet." />
            </section>
          </div>

          <section aria-label="Today’s classes" className="card p-5 sm:p-6">
            <SectionHeading title="Today’s classes" count={todayClasses.data?.length ?? 0} href="/owner/classes/new" link="Schedule" />
            {todayClasses.data?.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {todayClasses.data.map((c, i) => {
                  const n = (c.class_students as Array<{ count: number }>)[0]?.count ?? 0;
                  const Icon = c.delivery === 'home' ? Home : MonitorPlay;
                  return (
                    <li key={c.id}>
                      <Link href={`/owner/classes/${c.id}/room`} className={clsx('group flex h-full flex-col rounded-2xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card', CLASS_TILES[i % CLASS_TILES.length])}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-2.5 py-1 text-xs font-semibold shadow-xs">
                            <Icon size={14} aria-hidden="true" /> {c.delivery === 'home' ? 'Home' : 'Online'}
                          </span>
                          <Badge tone={c.status === 'completed' ? 'green' : 'blue'}>{c.status}</Badge>
                        </div>
                        <p className="mt-3 font-heading text-lg font-semibold leading-snug" style={{ color: 'rgb(var(--heading))' }}>{c.title}</p>
                        <p className="mt-1 text-sm text-ink/70">
                          <LocalTime iso={c.starts_at} format="time" fallbackZone={timezone} /> · {c.duration_minutes} min · {n} student{n === 1 ? '' : 's'}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                          {c.status === 'completed' ? 'Open recap' : 'Open lesson room'} <ArrowUpRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="rounded-2xl bg-sunken px-4 py-8 text-center text-sm text-muted">No classes are scheduled for today.</p>}
          </section>
        </div>

        {/* Right column */}
        <aside aria-label="Needs attention" className="space-y-4">
          <Card>
            <SectionHeading title="Needs attention" />
            <ul className="space-y-2">
              <AttentionRow href="/owner/applications" icon={Inbox} label="Pending applications" count={pending.count ?? 0} tone="bg-tile-peach" />
              <AttentionRow href="/owner/assignments?filter=grading" icon={ClipboardList} label="Work to grade" count={toGrade.count ?? 0} tone="bg-tile-sun" />
              <AttentionRow href="/owner/classes?view=attendance" icon={ClipboardCheck} label="Registers to complete" count={needAttendance.data?.length ?? 0} tone="bg-tile-lilac" />
              <AttentionRow href="/owner/billing?status=overdue" icon={AlertCircle} label="Overdue invoices" count={overdue} tone="bg-tile-rose" />
            </ul>
            {(needAttendance.data?.length ?? 0) > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-muted">Take these registers</h3>
                <ul className="space-y-1.5">
                  {needAttendance.data!.map((c) => (
                    <li key={c.id}>
                      <Link href={`/owner/classes/${c.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-sunken">
                        <span className="min-w-0 truncate font-medium">{c.title}</span>
                        <span className="shrink-0 text-xs text-muted"><LocalTime iso={c.starts_at} format="date" fallbackZone={timezone} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <SectionHeading title="Due this week" href="/owner/billing" link="Billing" />
            {dueSoon.data?.length ? (
              <ul className="space-y-2">
                {dueSoon.data.map((i) => (
                  <li key={i.id}>
                    <Link href={`/owner/billing/${i.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-sunken px-3 py-2.5 text-sm hover:bg-tile-sun">
                      <span className="font-semibold tabular-nums">{i.number}</span>
                      <span className="text-muted">{formatDate(i.due_date!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No invoices fall due in the next 7 days.</p>}
          </Card>

          <Card>
            <SectionHeading title="Recent messages" href="/owner/messages" link="All" />
            {threads.data?.length ? (
              <ul className="space-y-2">
                {threads.data.map((t) => {
                  const p = Array.isArray(t.participant) ? t.participant[0] : t.participant;
                  return (
                    <li key={t.id}>
                      <Link href={`/owner/messages/${t.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-sunken">
                        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tile-lilac font-heading text-sm font-semibold">{(p?.full_name ?? '?').slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p?.full_name ?? 'Conversation'}</span>
                          <span className="block text-xs text-muted"><LocalTime iso={t.last_message_at} fallbackZone={timezone} /></span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted"><MessageSquare size={16} aria-hidden="true" /> No conversations yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
