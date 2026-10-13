import Link from 'next/link';
import clsx from 'clsx';
import { ActionForm } from '@/components/ui/ActionForm';
import { Badge, type BadgeTone, Card, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/primitives';
import { likeTerm, ownerContext } from '@/lib/owner';
import { formatDate } from '@/lib/time';
import { markContactHandledAction } from './actions';

export const metadata = { title: 'Applications' };

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'orange' },
  in_review: { label: 'In review', tone: 'blue' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};
const PAGE = 25;

export default async function ApplicationsPage({ searchParams }: { searchParams: { q?: string; status?: string; tab?: string; page?: string } }) {
  const { supabase } = await ownerContext();
  const tab = searchParams.tab === 'messages' ? 'messages' : 'applications';
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const status = searchParams.status && STATUS[searchParams.status] ? searchParams.status : '';
  const page = Math.max(1, Number(searchParams.page) || 1);

  const tabs = (
    <div className="mb-5 flex gap-2" role="tablist" aria-label="Enquiries">
      {[['applications', 'Applications'], ['messages', 'Contact messages']].map(([key, label]) => (
        <Link key={key} href={key === 'applications' ? '/owner/applications' : '/owner/applications?tab=messages'} role="tab" aria-selected={tab === key}
          className={clsx('rounded-full border px-4 py-2 text-sm font-medium', tab === key ? 'border-royal bg-royal text-white' : 'border-line bg-surface')}>
          {label}
        </Link>
      ))}
    </div>
  );

  if (tab === 'messages') {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(50);
    return (
      <>
        <PageHeader title="Enquiries" description="Messages sent through the public contact form." />
        {tabs}
        {data?.length ? (
          <ul className="grid gap-4">
            {data.map((m) => (
              <li key={m.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-sm text-muted">
                        <a className="text-link hover:underline" href={`mailto:${m.email}`}>{m.email}</a>
                        {m.phone ? <> · <a className="text-link hover:underline" href={`tel:${m.phone}`}>{m.phone}</a></> : null} · {formatDate(m.created_at)}
                      </p>
                    </div>
                    {m.handled_at ? <Badge tone="green">Handled</Badge> : <ActionForm action={markContactHandledAction} submitLabel="Mark handled" variant="outline" size="sm" hidden={{ id: m.id }} />}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No contact messages yet" />}
      </>
    );
  }

  let query = supabase
    .from('applications')
    .select('id, status, student_name, guardian_name, guardian_phone, subjects, delivery, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status) query = query.eq('status', status);
  if (q) query = query.or(`student_name.ilike.${likeTerm(q)},guardian_name.ilike.${likeTerm(q)},guardian_email.ilike.${likeTerm(q)}`);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/owner/applications?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Enquiries" description="Review, approve or reject tutoring applications." />
      {tabs}
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="q" className="sr-only">Search applications</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by learner, guardian or email" className="field sm:max-w-xs" />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status} className="field sm:max-w-[11rem]">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className="min-h-[44px] rounded-xl bg-royal px-5 text-sm font-semibold text-white">Filter</button>
      </form>

      {data?.length ? (
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>Learner</th><th scope="col" className={th}>Guardian</th>
              <th scope="col" className={th}>Subjects</th><th scope="col" className={th}>Delivery</th>
              <th scope="col" className={th}>Received</th><th scope="col" className={th}>Status</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((a) => (
                <tr key={a.id}>
                  <td className={td}><Link href={`/owner/applications/${a.id}`} className="font-semibold text-link hover:underline">{a.student_name}</Link></td>
                  <td className={td}>{a.guardian_name}<br /><span className="text-muted">{a.guardian_phone}</span></td>
                  <td className={td}>{(a.subjects as string[]).join(', ')}</td>
                  <td className={clsx(td, 'capitalize')}>{a.delivery}</td>
                  <td className={clsx(td, 'whitespace-nowrap')}>{formatDate(a.created_at)}</td>
                  <td className={td}><Badge tone={STATUS[a.status]?.tone}>{STATUS[a.status]?.label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState title={q || status ? 'No applications match' : 'No applications yet'}>
          {q || status ? 'Try clearing the search or filter.' : 'New applications from the website will appear here.'}
        </EmptyState>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={link(page - 1)} className="font-semibold text-link">Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={link(page + 1)} className="font-semibold text-link">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
