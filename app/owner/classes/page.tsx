import Link from 'next/link';
import clsx from 'clsx';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, EmptyState, PageHeader } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';
import { addDays, formatDate, formatDateTime, weekStart, zonedDate, zonedToUtc } from '@/lib/time';

export const metadata = { title: 'Classes' };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default async function ClassesPage({ searchParams }: { searchParams: { week?: string; view?: string } }) {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const today = zonedDate(new Date(), timezone);

  if (searchParams.view === 'attendance') {
    const { data } = await supabase.from('classes').select('id, title, starts_at').lt('starts_at', new Date().toISOString()).eq('status', 'scheduled').order('starts_at', { ascending: false }).limit(50);
    return (
      <>
        <PageHeader title="Attendance to complete" description="Past classes that do not have a saved register." actions={<ButtonLink href="/owner/classes" variant="outline" size="sm">Weekly calendar</ButtonLink>} />
        {data?.length ? (
          <ul className="card divide-y divide-line p-0">
            {data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div><p className="font-medium">{c.title}</p><p className="text-sm text-muted">{formatDateTime(c.starts_at, timezone)}</p></div>
                <ButtonLink href={`/owner/classes/${c.id}`} size="sm" variant="secondary">Take register</ButtonLink>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Every past class has a register">Nothing needs your attention here.</EmptyState>}
      </>
    );
  }

  const start = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.week ?? '') ? searchParams.week! : today);
  const from = zonedToUtc(`${start}T00:00`, timezone)!.toISOString();
  const to = zonedToUtc(`${addDays(start, 7)}T00:00`, timezone)!.toISOString();
  const { data } = await supabase
    .from('classes')
    .select('id, title, starts_at, duration_minutes, delivery, status, class_students(count)')
    .gte('starts_at', from).lt('starts_at', to).order('starts_at');
  const byDay = new Map<string, NonNullable<typeof data>>();
  for (const c of data ?? []) {
    const day = zonedDate(c.starts_at, timezone);
    byDay.set(day, [...(byDay.get(day) ?? []), c]);
  }
  const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  return (
    <>
      <PageHeader
        title="Classes"
        description={`Week of ${formatDate(start)} · times shown in ${timezone}`}
        actions={
          <>
            <ButtonLink href="/owner/classes?view=attendance" variant="outline" size="sm">Attendance to complete</ButtonLink>
            <ButtonLink href="/owner/classes/new" size="sm">Schedule class</ButtonLink>
          </>
        }
      />
      <nav aria-label="Week" className="mb-4 flex items-center gap-2">
        <ButtonLink href={`/owner/classes?week=${addDays(start, -7)}`} variant="outline" size="sm">← Previous</ButtonLink>
        <ButtonLink href="/owner/classes" variant="outline" size="sm">This week</ButtonLink>
        <ButtonLink href={`/owner/classes?week=${addDays(start, 7)}`} variant="outline" size="sm">Next →</ButtonLink>
      </nav>

      <ol className="grid gap-3 lg:grid-cols-7">
        {DAYS.map((label, i) => {
          const day = addDays(start, i);
          const items = byDay.get(day) ?? [];
          return (
            <li key={day} className={clsx('card min-h-[8rem] p-3', day === today && 'border-orange')}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{label} <span className="font-normal text-muted">{day.slice(8)}</span></h2>
                <Link href={`/owner/classes/new?date=${day}`} aria-label={`Schedule a class on ${formatDate(day)}`} className="tap flex h-8 w-8 items-center justify-center rounded-lg text-lg text-link hover:bg-royal/10">+</Link>
              </div>
              {items.length ? (
                <ul className="mt-2 space-y-2">
                  {items.map((c) => {
                    const count = (c.class_students as Array<{ count: number }>)[0]?.count ?? 0;
                    return (
                      <li key={c.id}>
                        <Link href={`/owner/classes/${c.id}`} className={clsx('block rounded-lg border-l-4 bg-cloud p-2 text-sm hover:bg-royal/10', c.status === 'cancelled' ? 'border-bad opacity-60' : c.delivery === 'home' ? 'border-orange' : 'border-royal')}>
                          <span className="font-semibold tabular-nums">{time(c.starts_at)}</span>
                          <span className={clsx('block', c.status === 'cancelled' && 'line-through')}>{c.title}</span>
                          <span className="text-xs text-muted">{c.duration_minutes} min · {c.delivery} · {count} student{count === 1 ? '' : 's'}</span>
                          {c.status !== 'scheduled' && <span className="mt-1 block"><Badge tone={c.status === 'completed' ? 'green' : 'red'}>{c.status}</Badge></span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-2 text-xs text-muted">No classes</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
