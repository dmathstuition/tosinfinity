import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Conversation } from '@/components/portal/Conversation';
import { PageHeader } from '@/components/ui/primitives';
import { isUuid, ownerContext } from '@/lib/owner';

export const metadata = { title: 'Conversation' };

export default async function ThreadPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase, profile } = await ownerContext();
  const { data: t } = await supabase.from('message_threads').select('id, participant:profiles!message_threads_participant_id_fkey(id, full_name, role)').eq('id', params.id).maybeSingle();
  if (!t) notFound();
  const p = Array.isArray(t.participant) ? t.participant[0] : t.participant;
  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/messages" className="text-link hover:underline">← Messages</Link></p>
      <PageHeader title={p?.full_name ?? 'Conversation'} description={p?.role === 'parent' ? 'Parent' : 'Student'} />
      <div className="max-w-3xl"><Conversation threadId={t.id} viewerId={profile.id} otherName={p?.full_name ?? 'them'} /></div>
    </>
  );
}
