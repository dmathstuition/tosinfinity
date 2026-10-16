import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TopicBreakdown } from '@/components/family/TopicBreakdown';
import { LocalTime } from '@/components/portal/LocalTime';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { studentContext } from '@/lib/family';
import { QuizRunner, WrittenForm } from './WorkForms';

export const metadata = { title: 'Assignment' };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default async function StudentAssignmentPage({ params, searchParams }: { params: { id: string }; searchParams: { start?: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { profile, supabase } = await studentContext();
  // RLS: only published assignments that are assigned to this student are returned.
  const { data: a } = await supabase.from('assignments').select('id, title, instructions, kind, due_at, max_marks, time_limit_minutes, randomise, allow_resubmission, rubric').eq('id', params.id).maybeSingle();
  if (!a) notFound();
  const { data: attempts } = await supabase
    .from('submissions').select('id, attempt, body, file_path, submitted_at, score, feedback, status')
    .eq('assignment_id', a.id).eq('student_id', profile.id).order('attempt', { ascending: false });

  const isQuiz = a.kind !== 'written';
  const done = (attempts?.length ?? 0) > 0;
  const canAttempt = !done || a.allow_resubmission;
  const rubric = (a.rubric ?? []) as Array<{ criterion: string; marks: number }>;

  let quiz: React.ReactNode = null;
  if (isQuiz && canAttempt && searchParams.start === '1') {
    // Opening the questions records the start time in the database (once per attempt).
    const [{ data: started, error: startError }, { data: questions }] = await Promise.all([
      supabase.rpc('start_quiz', { p_assignment: a.id }),
      supabase.rpc('get_quiz_questions', { p_assignment: a.id }),
    ]);
    if (startError || !questions?.length) {
      quiz = <Alert tone="error">This quiz is not available right now.</Alert>;
    } else {
      const list = (questions as Array<{ id: string; prompt: string; options: string[]; marks: number }>).map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, marks: Number(q.marks) }));
      const endsAt = a.time_limit_minutes && started ? new Date(new Date(started as string).getTime() + a.time_limit_minutes * 60000).toISOString() : null;
      quiz = <QuizRunner assignmentId={a.id} questions={a.randomise ? shuffle(list) : list} endsAt={endsAt} />;
    }
  }

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/portal/assignments" className="text-link hover:underline">← Assignments</Link></p>
      <PageHeader
        title={a.title}
        description={`${a.kind === 'written' ? 'Written assignment' : a.kind === 'quiz' ? 'Multiple-choice quiz' : 'Timed practice'} · ${Number(a.max_marks)} marks`}
        actions={a.due_at ? <Badge tone="gold">Due <LocalTime iso={a.due_at} /></Badge> : undefined}
      />

      {quiz ?? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-semibold">Instructions</h2>
              <p className="mt-2 whitespace-pre-line">{a.instructions || 'No extra instructions.'}</p>
              {a.time_limit_minutes && <p className="mt-3 text-sm text-muted">Time limit: {a.time_limit_minutes} minutes. The clock starts when you open the questions and keeps running if you leave the page.</p>}
            </Card>

            {canAttempt && (
              <Card>
                <h2 className="mb-3 text-lg font-semibold">{done ? 'Submit again' : isQuiz ? 'Ready?' : 'Hand in your work'}</h2>
                {isQuiz
                  ? <ButtonLink href={`/portal/assignments/${a.id}?start=1`}>{done ? 'Start a new attempt' : a.kind === 'timed' ? 'Start timed practice' : 'Start quiz'}</ButtonLink>
                  : <WrittenForm assignmentId={a.id} studentId={profile.id} />}
              </Card>
            )}

            {done && (
              <Card>
                <h2 className="text-lg font-semibold">Your submissions</h2>
                <ul className="mt-3 space-y-4">
                  {attempts!.map((s) => (
                    <li key={s.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">Attempt {s.attempt} <span className="text-sm font-normal text-muted">· <LocalTime iso={s.submitted_at} /></span></p>
                        {s.status === 'graded' ? <Badge tone="green">{Number(s.score)} / {Number(a.max_marks)}</Badge> : <Badge tone="blue">Awaiting marking</Badge>}
                      </div>
                      {isQuiz && s.status === 'graded' && <TopicBreakdown submissionId={s.id} />}
                      {s.body && <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-line rounded-lg bg-cloud p-3 text-sm">{s.body}</p>}
                      {s.file_path && <p className="mt-3"><ButtonLink href={`/api/files?bucket=submissions&path=${encodeURIComponent(s.file_path)}`} external variant="outline" size="sm">Download your file</ButtonLink></p>}
                      {s.feedback && <p className="mt-3 whitespace-pre-line rounded-lg border-l-4 border-gold bg-gold/10 p-3 text-sm"><span className="font-semibold">Tutor feedback: </span>{s.feedback}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {rubric.length > 0 && (
            <Card className="h-fit">
              <h2 className="text-lg font-semibold">How it is marked</h2>
              <ul className="mt-3 divide-y divide-line text-sm">
                {rubric.map((r, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{r.criterion}</span><span className="tabular-nums text-muted">{r.marks}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
