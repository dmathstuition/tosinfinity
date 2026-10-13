import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui/primitives';
import { ownerContext } from '@/lib/owner';
import { ImportClient } from './ImportClient';

export const metadata = { title: 'Import students' };

export default async function ImportPage() {
  const { supabase } = await ownerContext();
  // Every profile email (any role): an email can only ever belong to one login.
  const { data } = await supabase.from('profiles').select('email');
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/students" className="text-link hover:underline">← Students</Link></p>
      <PageHeader title="Import students from CSV" description="Preview and check the file first. Each imported student receives an emailed link to choose a password." />
      <Card><ImportClient existingEmails={(data ?? []).map((p) => p.email)} /></Card>
    </>
  );
}
