import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/primitives';
import { likeTerm, ownerContext } from '@/lib/owner';

export const metadata = { title: 'Students' };
const PAGE = 25;

export default async function StudentsPage({ searchParams }: { searchParams: { q?: string; status?: string; delivery?: string; page?: string } }) {
  const { supabase } = await ownerContext();
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const status = searchParams.status === 'inactive' ? 'inactive' : searchParams.status === 'all' ? 'all' : 'active';
  const delivery = searchParams.delivery === 'home' || searchParams.delivery === 'online' ? searchParams.delivery : '';
  const page = Math.max(1, Number(searchParams.page) || 1);

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, student_code, school_year, delivery, status, billing_mode', { count: 'exact' })
    .eq('role', 'student')
    .order('full_name')
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (status !== 'all') query = query.eq('status', status);
  if (delivery) query = query.eq('delivery', delivery);
  if (q) query = query.or(`full_name.ilike.${likeTerm(q)},email.ilike.${likeTerm(q)},student_code.ilike.${likeTerm(q)}`);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: number) => `/owner/students?${new URLSearchParams({ ...(q && { q }), status, ...(delivery && { delivery }), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Students"
        description={`${count ?? 0} ${status === 'all' ? '' : status} student${count === 1 ? '' : 's'}`}
        actions={
          <>
            <ButtonLink href="/owner/students/import" variant="outline" size="sm">Import CSV</ButtonLink>
            <ButtonLink href="/owner/students/export" variant="outline" size="sm" external>Export CSV</ButtonLink>
            <ButtonLink href="/owner/students/new" size="sm">Add student</ButtonLink>
          </>
        }
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="q" className="sr-only">Search students</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name, email or student ID" className="field sm:max-w-xs" />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={status} className="field sm:max-w-[10rem]">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
        </select>
        <label htmlFor="delivery" className="sr-only">Delivery</label>
        <select id="delivery" name="delivery" defaultValue={delivery} className="field sm:max-w-[10rem]">
          <option value="">Home and online</option><option value="home">Home</option><option value="online">Online</option>
        </select>
        <button className="min-h-[44px] rounded-xl bg-royal px-5 text-sm font-semibold text-white">Filter</button>
      </form>

      {data?.length ? (
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>Student</th><th scope="col" className={th}>ID</th><th scope="col" className={th}>Class</th>
              <th scope="col" className={th}>Delivery</th><th scope="col" className={th}>Billing</th><th scope="col" className={th}>Status</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {data.map((s) => (
                <tr key={s.id}>
                  <td className={td}>
                    <Link href={`/owner/students/${s.id}`} className="font-semibold text-link hover:underline">{s.full_name}</Link>
                    <br /><span className="break-all text-muted">{s.email}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{s.student_code}</td>
                  <td className={td}>{s.school_year ?? '—'}</td>
                  <td className={`${td} capitalize`}>{s.delivery ?? '—'}</td>
                  <td className={td}>{s.billing_mode ? s.billing_mode.replace('_', ' ') : <span className="text-muted">Not set</span>}</td>
                  <td className={td}><Badge tone={s.status === 'active' ? 'green' : 'neutral'}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState
          title={q || delivery || status !== 'active' ? 'No students match' : 'No students yet'}
          action={<ButtonLink href="/owner/students/new">Add student</ButtonLink>}
        >
          Students are created when you approve an application, or you can add one directly.
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
