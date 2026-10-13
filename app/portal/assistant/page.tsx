import { Alert, EmptyState, PageHeader } from '@/components/ui/primitives';
import { aiConfigured } from '@/lib/ai';
import { studentContext } from '@/lib/family';
import { AssistantClient } from './AssistantClient';

export const metadata = { title: 'Study assistant' };

export default async function AssistantPage() {
  await studentContext();
  return (
    <>
      <PageHeader title="Study assistant" description="Extra help between lessons: explanations, hints, practice questions and revision summaries." />
      {aiConfigured() ? (
        <div className="grid max-w-3xl gap-5">
          <Alert tone="info">
            You are talking to an AI, not your tutor. It can make mistakes, so check important answers and ask your tutor if something does not look right.
            It does not replace your lessons or mark your work.
          </Alert>
          <AssistantClient />
        </div>
      ) : (
        <EmptyState title="The study assistant is not switched on">Your other learning tools work as normal. Message your tutor if you need help.</EmptyState>
      )}
    </>
  );
}
