import { MaterialList } from '@/components/family/views';
import { PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';

export const metadata = { title: 'Materials' };

export default async function Page() {
  await studentContext();
  return (
    <>
      <PageHeader title="Learning materials" description="Worksheets, notes and resources shared with you." />
      <MaterialList />
    </>
  );
}
