import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';
import { createClassAction } from '../actions';
import { ClassFields } from '../ClassFields';

export const metadata = { title: 'Schedule class' };

export default async function NewClassPage({ searchParams }: { searchParams: { date?: string } }) {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const [{ data: students }, { data: programmes }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, student_code').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('programmes').select('id, title').order('sort_order'),
  ]);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '') ? searchParams.date : undefined;
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/classes" className="text-link hover:underline">← Classes</Link></p>
      <PageHeader title="Schedule class" description="Create one session or a weekly series." />
      <Card className="max-w-3xl">
        <ActionForm action={createClassAction} submitLabel="Schedule">
          <ClassFields students={students ?? []} programmes={programmes ?? []} timezone={timezone} recurring values={date ? { starts_local: `${date}T16:00` } : {}} />
        </ActionForm>
      </Card>
    </>
  );
}
