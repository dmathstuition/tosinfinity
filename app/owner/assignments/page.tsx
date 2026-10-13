import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, EmptyState, PageHeader, TableWrap, td, th } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';
import { formatDateTime } from '@/lib/time';

export const metadata = { title: 'Assignments' };
const KIND = { written: 'Written', quiz: 'Quiz', timed: 'Timed practice' } as const;

export default async function AssignmentsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data } = await supabase
    .from('assignments')
    .select('id, title, kind, due_at, published, assignment_students(count), submissions(id, status)')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []).map((a) => {
    const subs = a.submissions as Array<{ status: string }>;
    return { ...a, assigned: (a.assignment_students as Array<{ count: number }>)[0]?.count ?? 0, submitted: subs.length, waiting: subs.filter((s) => s.status === 'submitted').length };
  });
  const filter = searchParams.filter === 'grading' ? 'grading' : 'all';
  const shown = filter === 'grading' ? rows.filter((r) => r.waiting > 0) : rows;

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Written work, quizzes and timed practice."
        actions={
          <>
            <ButtonLink href={filter === 'grading' ? '/owner/assignments' : '/owner/assignments?filter=grading'} variant="outline" size="sm">
              {filter === 'grading' ? 'Show all' : 'Awaiting grading'}
            </ButtonLink>
            <ButtonLink href="/owner/assignments/new" size="sm">Create assignment</ButtonLink>
          </>
        }
      />
      {shown.length ? (
        <TableWrap>
          <table className="w-full">
            <thead className="border-b border-line"><tr>
              <th scope="col" className={th}>Assignment</th><th scope="col" className={th}>Type</th><th scope="col" className={th}>Due</th>
              <th scope="col" className={th}>Submitted</th><th scope="col" className={th}>Status</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((a) => (
                <tr key={a.id}>
                  <td className={td}><Link href={`/owner/assignments/${a.id}`} className="font-semibold text-link hover:underline">{a.title}</Link></td>
                  <td className={td}>{KIND[a.kind as keyof typeof KIND]}</td>
                  <td className={`${td} whitespace-nowrap`}>{a.due_at ? formatDateTime(a.due_at, timezone) : '—'}</td>
                  <td className={`${td} tabular-nums`}>
                    {a.submitted} / {a.assigned}
                    {a.waiting > 0 && <span className="ml-2"><Badge tone="orange">{a.waiting} to grade</Badge></span>}
                  </td>
                  <td className={td}><Badge tone={a.published ? 'green' : 'neutral'}>{a.published ? 'Published' : 'Draft'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState title={filter === 'grading' ? 'Nothing is waiting to be graded' : 'No assignments yet'} action={<ButtonLink href="/owner/assignments/new">Create assignment</ButtonLink>} />
      )}
    </>
  );
}
