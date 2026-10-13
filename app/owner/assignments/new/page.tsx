import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/primitives';
import { academyLocale, ownerContext } from '@/lib/owner';
import { createAssignmentAction } from '../actions';
import { AssignmentFields } from '../AssignmentFields';

export const metadata = { title: 'Create assignment' };

export default async function NewAssignmentPage() {
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const [{ data: students }, { data: programmes }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, student_code').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('programmes').select('id, title').order('sort_order'),
  ]);
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/assignments" className="text-link hover:underline">← Assignments</Link></p>
      <PageHeader title="Create assignment" description="Saved as a draft. Students see it only after you publish." />
      <Card className="max-w-3xl">
        <ActionForm action={createAssignmentAction} submitLabel="Save draft">
          <AssignmentFields students={students ?? []} programmes={programmes ?? []} timezone={timezone} />
        </ActionForm>
      </Card>
    </>
  );
}
