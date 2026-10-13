import { Conversation } from '@/components/portal/Conversation';
import { PageHeader } from '@/components/ui/primitives';
import { parentContext } from '@/lib/family';

export const metadata = { title: 'Messages' };

export default async function Page() {
  const { profile, supabase } = await parentContext();
  const { data: thread } = await supabase.from('message_threads').select('id').eq('participant_id', profile.id).limit(1).maybeSingle();
  return (
    <>
      <PageHeader title="Messages" description="A private conversation between you and the academy." />
      <div className="max-w-3xl">
        <Conversation threadId={thread?.id} viewerId={profile.id} otherName="the academy" />
      </div>
    </>
  );
}
