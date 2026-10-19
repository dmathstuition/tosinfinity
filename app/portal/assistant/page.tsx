import { AiBuddy } from '@/components/ai/AiBuddy';
import { EmptyState } from '@/components/ui/primitives';
import { aiConfigured } from '@/lib/ai';
import { promptsLeft } from '@/lib/ai/quota';
import { studentContext } from '@/lib/family';
import { AssistantClient } from './AssistantClient';

export const metadata = { title: 'Learn with AI' };

/** `?mode=practice&q=Fractions` pre-fills the assistant (used by "Practise with AI" links). */
export default async function AssistantPage({ searchParams }: { searchParams: { mode?: string; q?: string } }) {
  const { profile } = await studentContext();
  if (!aiConfigured()) {
    return <EmptyState title="The study assistant is not switched on">Your other learning tools work as normal. Message your tutor if you need help.</EmptyState>;
  }
  return (
    <>
      <h1 className="mb-4 flex items-center justify-center gap-2 text-center text-2xl font-semibold"><AiBuddy size={30} /> Learn with AI</h1>
      <AssistantClient
        firstName={profile.full_name.split(' ')[0] ?? 'there'}
        initialLeft={await promptsLeft(profile.id)}
        initialMode={searchParams.mode}
        initialText={searchParams.q?.slice(0, 300)}
      />
    </>
  );
}
