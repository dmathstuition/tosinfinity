import Link from 'next/link';
import { EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';
import { formatDateTime } from '@/lib/time';

export const metadata = { title: 'Audit log' };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: { page?: string; action?: string } }) {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const page = Math.max(1, Number(searchParams.page) || 1);
  const filter = (searchParams.action ?? '').replace(/[^a-z_.]/g, '').slice(0, 40);
  let query = supabase.from('audit_log').select('id, action, entity, entity_id, meta, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (filter) query = query.like('action', `${filter}%`);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/owner/settings/audit?${new URLSearchParams({ ...(filter && { action: filter }), page: String(p) })}`;

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/settings" className="text-link hover:underline">← Settings</Link></p>
      <PageHeader title="Audit log" description="A permanent record of sensitive actions. Entries cannot be edited or deleted." />
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="action" className="sr-only">Filter by action</label>
        <select id="action" name="action" defaultValue={filter} className="field max-w-xs">
          <option value="">All actions</option>
          {['application', 'student', 'parent', 'grade', 'invoice', 'payment', 'report', 'certificate', 'class', 'attendance', 'settings', 'blog', 'notice'].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="min-h-[44px] rounded-xl bg-royal px-5 text-sm font-semibold text-white">Filter</button>
      </form>
      {data?.length ? (
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>When</th><th scope="col" className={th}>Action</th><th scope="col" className={th}>Record</th><th scope="col" className={th}>Details</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.created_at, timezone)}</td>
                  <td className={`${td} font-medium`}>{r.action}</td>
                  <td className={`${td} text-muted`}>{r.entity}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ''}</td>
                  <td className={`${td} break-all text-muted`}>{Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : <EmptyState title="No entries yet" />}
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
