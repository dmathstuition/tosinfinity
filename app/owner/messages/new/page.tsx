import { notFound, redirect } from 'next/navigation';
import { isUuid, ownerContext } from '@/lib/owner';

export const metadata = { title: 'New conversation' };

/** Opens (or reuses) the conversation with one student or parent, then shows it. */
export default async function NewThreadPage({ searchParams }: { searchParams: { to?: string } }) {
  const { supabase } = await ownerContext();
  const to = searchParams.to ?? '';
  if (!isUuid(to)) notFound();
  const { data: person } = await supabase.from('profiles').select('id, role').eq('id', to).in('role', ['student', 'parent']).maybeSingle();
  if (!person) notFound();
  const { data: existing } = await supabase.from('message_threads').select('id').eq('participant_id', to).limit(1).maybeSingle();
  if (existing) redirect(`/owner/messages/${existing.id}`);
  const { data: created } = await supabase.from('message_threads').insert({ participant_id: to }).select('id').single();
  if (!created) notFound();
  redirect(`/owner/messages/${created.id}`);
}
