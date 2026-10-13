import Link from 'next/link';
import { StudentFields } from '@/components/portal/StudentFields';
import { ActionForm } from '@/components/ui/ActionForm';
import { Alert, Card, PageHeader } from '@/components/ui/primitives';
import { ownerContext } from '@/lib/owner';
import { adminConfigured } from '@/lib/supabase/admin';
import { createStudentAction } from '../actions';

export const metadata = { title: 'Add student' };

export default async function NewStudentPage() {
  await ownerContext();
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/students" className="text-link hover:underline">← Students</Link></p>
      <PageHeader title="Add student" description="Creates the profile and student ID, then emails a secure link so the student can choose a password." />
      {!adminConfigured() && <div className="mb-4"><Alert tone="warning">Set SUPABASE_SERVICE_ROLE_KEY on the server before adding students.</Alert></div>}
      <Card className="max-w-3xl">
        <ActionForm action={createStudentAction} submitLabel="Create student">
          <StudentFields withEmail />
        </ActionForm>
      </Card>
    </>
  );
}
