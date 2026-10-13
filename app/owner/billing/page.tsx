import Link from 'next/link';
import clsx from 'clsx';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, type BadgeTone, Card, EmptyState, PageHeader, Stat, TableWrap, td, th } from '@/components/ui/primitives';
import { formatMoney, previousMonth } from '@/lib/billing';
import { academyLocale, ownerContext } from '@/lib/owner';
import { getProvider } from '@/lib/payments';
import { formatDate, zonedDate } from '@/lib/time';
import { generateInvoicesAction } from './actions';

export const metadata = { title: 'Billing' };

const TONE: Record<string, BadgeTone> = { paid: 'green', overdue: 'red', partially_paid: 'gold', unpaid: 'orange', cancelled: 'neutral', draft: 'blue' };
const FILTERS = ['all', 'draft', 'unpaid', 'partially_paid', 'overdue', 'paid', 'cancelled'] as const;
const PAGE = 30;
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function BillingPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const { supabase } = await ownerContext();
  const { currency, timezone } = await academyLocale();
  const status = FILTERS.find((f) => f === searchParams.status) ?? 'all';
  const page = Math.max(1, Number(searchParams.page) || 1);
  const today = zonedDate(new Date(), timezone);
  const prev = previousMonth(today);

  let query = supabase
    .from('invoices')
    .select('id, number, status, total_minor, paid_minor, currency, due_date, period_start, period_end, student:profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status !== 'all') query = query.eq('status', status);
  const [{ data, count }, { data: open }, { data: recent }] = await Promise.all([
    query,
    supabase.from('invoices').select('total_minor, paid_minor, status').in('status', ['unpaid', 'partially_paid', 'overdue']),
    supabase.from('payments').select('amount_minor').gte('paid_at', `${today.slice(0, 8)}01T00:00:00Z`),
  ]);
  const owed = (open ?? []).reduce((s, i) => s + Number(i.total_minor) - Number(i.paid_minor), 0);
  const overdue = (open ?? []).filter((i) => i.status === 'overdue').length;
  const received = (recent ?? []).reduce((s, p) => s + Number(p.amount_minor), 0);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <>
      <PageHeader title="Billing" description={`Invoices and payments in ${currency}.`} actions={<ButtonLink href="/owner/billing/new" size="sm">Create invoice</ButtonLink>} />
      {!getProvider().configured() && (
        <div className="mb-5"><Alert tone="warning">Online payment (Paystack) is not configured. Families cannot pay online yet; you can still issue invoices and record bank-transfer or cash payments. See README.md.</Alert></div>
      )}

      <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Outstanding" value={formatMoney(owed, currency)} hint={`${open?.length ?? 0} open invoices`} />
        <Stat label="Overdue" value={overdue} />
        <Stat label="Received this month" value={formatMoney(received, currency)} />
        <Stat label="Showing" value={count ?? 0} hint={status === 'all' ? 'All invoices' : status.replace('_', ' ')} />
      </section>

      <Card className="mb-6">
        <h2 className="text-lg font-semibold">Generate tuition invoices</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Creates a draft for each active student on hourly or flat monthly billing. Hourly invoices use billable lesson time from the registers.
          Running it again for the same period never creates duplicates.
        </p>
        <ActionForm action={generateInvoicesAction} submitLabel="Create drafts" variant="secondary" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div><label htmlFor="period_start" className="label">Period from</label><input id="period_start" name="period_start" type="date" required defaultValue={prev.start} className="field" /></div>
          <div><label htmlFor="period_end" className="label">Period to</label><input id="period_end" name="period_end" type="date" required defaultValue={prev.end} className="field" /></div>
        </ActionForm>
      </Card>

      <nav aria-label="Filter invoices" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={f === 'all' ? '/owner/billing' : `/owner/billing?status=${f}`} aria-current={status === f ? 'page' : undefined}
            className={clsx('rounded-full border px-4 py-2 text-sm font-medium capitalize', status === f ? 'border-royal bg-royal text-white' : 'border-line bg-surface hover:border-royal')}>
            {f.replace('_', ' ')}
          </Link>
        ))}
      </nav>

      {data?.length ? (
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>Invoice</th><th scope="col" className={th}>Student</th><th scope="col" className={th}>Period</th>
              <th scope="col" className={th}>Due</th><th scope="col" className={`${th} text-right`}>Total</th><th scope="col" className={`${th} text-right`}>Balance</th><th scope="col" className={th}>Status</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((i) => (
                <tr key={i.id}>
                  <td className={td}><Link href={`/owner/billing/${i.id}`} className="font-semibold text-link hover:underline">{i.number}</Link></td>
                  <td className={td}>{one(i.student)?.full_name}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatDate(i.period_start)} – {formatDate(i.period_end)}</td>
                  <td className={`${td} whitespace-nowrap`}>{i.due_date ? formatDate(i.due_date) : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(Number(i.total_minor), i.currency)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMoney(i.status === 'cancelled' ? 0 : Math.max(0, Number(i.total_minor) - Number(i.paid_minor)), i.currency)}</td>
                  <td className={td}><Badge tone={TONE[i.status]}>{i.status.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : <EmptyState title="No invoices here yet" action={<ButtonLink href="/owner/billing/new">Create invoice</ButtonLink>} />}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/owner/billing?status=${status}&page=${page - 1}`} className="font-semibold text-link">Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/owner/billing?status=${status}&page=${page + 1}`} className="font-semibold text-link">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
