import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import { Logo } from '@/components/brand/Logo';
import { LocalTime } from '@/components/portal/LocalTime';
import { Card, Stat } from '@/components/ui/primitives';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { formatDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Guardian view', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

function Unavailable() {
  return (
    <main id="main" data-theme="light" className="flex min-h-dvh flex-col items-center justify-center bg-cloud px-6 text-center text-ink">
      <Logo size={48} />
      <h1 className="mt-8 text-2xl font-semibold">This link is not available</h1>
      <p className="mt-2 max-w-sm text-muted">It may have expired or been withdrawn. Please ask the academy for a new link.</p>
    </main>
  );
}

/**
 * Read-only guardian view. There is no session here, so access rests entirely on the
 * token: 256 random bits, stored only as a SHA-256 hash, with expiry and revocation.
 * The service role is used strictly after that check, and only these fields are read:
 * first name, class times and titles, attendance counts, and report learning targets.
 * Never shown: invoices, home address, notes, messages, marks, files or contact details.
 */
export default async function GuardianPage({ params }: { params: { token: string } }) {
  if (!adminConfigured() || !/^[A-Za-z0-9_-]{40,50}$/.test(params.token)) return <Unavailable />;
  if (!(await rateLimit('guardian', clientIp(), 30, 600))) return <Unavailable />;

  const admin = createAdminClient();
  const { data: link } = await admin
    .from('guardian_links')
    .select('student_id, expires_at, revoked_at')
    .eq('token_hash', createHash('sha256').update(params.token).digest('hex'))
    .maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) <= new Date()) return <Unavailable />;

  const sid = link.student_id;
  const [{ data: student }, { data: classRows }, { data: attendance }, { data: report }] = await Promise.all([
    admin.from('profiles').select('full_name, status').eq('id', sid).eq('role', 'student').maybeSingle(),
    admin.from('class_students').select('class:classes!inner(id, title, starts_at, duration_minutes, delivery, status)').eq('student_id', sid).eq('class.status', 'scheduled').gte('class.starts_at', new Date().toISOString()).limit(10),
    admin.from('attendance').select('status').eq('student_id', sid).limit(500),
    admin.from('reports').select('period_start, period_end, content').eq('student_id', sid).eq('status', 'published').order('period_end', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!student || student.status !== 'active') return <Unavailable />;

  const firstName = student.full_name.split(' ')[0];
  const classes = (classRows ?? []).map((r) => (Array.isArray(r.class) ? r.class[0] : r.class)).filter((c): c is NonNullable<typeof c> => Boolean(c)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const rows = attendance ?? [];
  const n = (s: string) => rows.filter((r) => r.status === s).length;
  const attended = n('present') + n('late');
  const targets = ((report?.content as { targets?: string[] } | undefined)?.targets ?? []).filter(Boolean);

  return (
    <main id="main" data-theme="light" className="min-h-dvh bg-cloud text-ink">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo size={36} />
          <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-semibold">Read-only guardian view</span>
        </div>
      </header>
      <div className="container-page max-w-3xl py-8">
        <h1 className="text-3xl font-semibold">{firstName}’s learning</h1>
        <p className="mt-1 text-sm text-muted">This link expires on {formatDate(link.expires_at)}. Please do not forward it.</p>

        <section aria-label="Attendance" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Attendance" value={rows.length ? `${Math.round((attended / rows.length) * 100)}%` : '—'} hint={`${attended} of ${rows.length} lessons`} />
          <Stat label="Present" value={n('present')} />
          <Stat label="Late" value={n('late')} />
          <Stat label="Absent" value={n('absent')} />
        </section>

        <Card className="mt-6">
          <h2 className="text-lg font-semibold">Upcoming classes</h2>
          {classes.length ? (
            <ul className="mt-2 divide-y divide-line">
              {classes.map((c) => (
                <li key={c.id} className="py-3">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted"><LocalTime iso={c.starts_at} /> · {c.duration_minutes} min · {c.delivery === 'online' ? 'Online' : 'Home tutoring'}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">No classes are scheduled at the moment.</p>}
        </Card>

        {targets.length > 0 && report && (
          <Card className="mt-6">
            <h2 className="text-lg font-semibold">Current learning targets</h2>
            <p className="text-sm text-muted">From the report for {formatDate(report.period_start)} to {formatDate(report.period_end)}</p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">{targets.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Card>
        )}
      </div>
    </main>
  );
}
