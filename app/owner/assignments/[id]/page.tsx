import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { formatDateTime, utcToZonedInput } from '@/lib/time';
import {
  addQuestionAction, deleteAssignmentAction, deleteQuestionAction, gradeSubmissionAction, setPublishedAction, updateAssignmentAction,
} from '../actions';
import { AssignmentFields } from '../AssignmentFields';
import { AiFeedbackButton } from './AiFeedbackButton';
import { AiQuestionDrafter } from './AiQuestionDrafter';
import { aiConfigured } from '@/lib/ai';

export const metadata = { title: 'Assignment' };

export default async function AssignmentPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data: a } = await supabase.from('assignments').select('*').eq('id', params.id).maybeSingle();
  if (!a) notFound();

  const [{ data: assigned }, { data: questions }, { data: submissions }, { data: students }, { data: programmes }] = await Promise.all([
    supabase.from('assignment_students').select('student_id, student:profiles(full_name)').eq('assignment_id', a.id),
    supabase.from('quiz_questions').select('*').eq('assignment_id', a.id).order('position'),
    supabase.from('submissions').select('*, student:profiles(full_name, student_code)').eq('assignment_id', a.id).order('submitted_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, student_code').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('programmes').select('id, title').order('sort_order'),
  ]);
  const isQuiz = a.kind !== 'written';
  const submittedBy = new Set((submissions ?? []).map((s) => s.student_id));
  const missing = (assigned ?? []).filter((x) => !submittedBy.has(x.student_id));
  const ai = aiConfigured();

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/assignments" className="text-link hover:underline">← Assignments</Link></p>
      <PageHeader
        title={a.title}
        description={`${a.kind === 'written' ? 'Written assignment' : a.kind === 'quiz' ? 'Multiple-choice quiz' : 'Timed practice'} · ${Number(a.max_marks)} marks${a.due_at ? ` · due ${formatDateTime(a.due_at, timezone)}` : ''}`}
        actions={<Badge tone={a.published ? 'green' : 'neutral'}>{a.published ? 'Published' : 'Draft'}</Badge>}
      />

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <ActionForm action={setPublishedAction} submitLabel={a.published ? 'Unpublish' : 'Publish to students'} variant={a.published ? 'outline' : 'primary'} hidden={{ id: a.id, publish: String(!a.published) }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold">Submissions</h2>
            {missing.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                Not yet submitted: {missing.map((m) => (Array.isArray(m.student) ? m.student[0] : m.student)?.full_name).join(', ')}
              </p>
            )}
            {submissions?.length ? (
              <ul className="mt-4 space-y-4">
                {submissions.map((s) => {
                  const st = Array.isArray(s.student) ? s.student[0] : s.student;
                  const late = a.due_at && new Date(s.submitted_at) > new Date(a.due_at);
                  return (
                    <li key={s.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{st?.full_name} <span className="text-sm font-normal text-muted">{st?.student_code} · attempt {s.attempt}</span></p>
                        <div className="flex gap-2">
                          {late && <Badge tone="red">Late</Badge>}
                          <Badge tone={s.status === 'graded' ? 'green' : 'orange'}>{s.status === 'graded' ? `${Number(s.score)} / ${Number(a.max_marks)}` : 'To grade'}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted">Submitted {formatDateTime(s.submitted_at, timezone)}</p>
                      {s.body && <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-cloud p-3 text-sm">{s.body}</p>}
                      {s.file_path && (
                        <p className="mt-3"><ButtonLink href={`/api/files?bucket=submissions&path=${encodeURIComponent(s.file_path)}`} external variant="outline" size="sm">Download uploaded file</ButtonLink></p>
                      )}
                      {isQuiz && s.auto_score !== null && <p className="mt-2 text-sm text-muted">Marked automatically: {Number(s.auto_score)} / {Number(a.max_marks)}. You can adjust the mark below.</p>}
                      <div className="mt-4 border-t border-line pt-4">
                        <ActionForm action={gradeSubmissionAction} submitLabel={s.status === 'graded' ? 'Update mark' : 'Save mark'} variant="secondary" size="sm" hidden={{ submission_id: s.id }}>
                          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                            <div>
                              <label htmlFor={`score_${s.id}`} className="label">Mark / {Number(a.max_marks)}</label>
                              <input id={`score_${s.id}`} name="score" type="number" min={0} max={Number(a.max_marks)} step="0.5" required defaultValue={s.score ?? ''} className="field" />
                            </div>
                            <div>
                              <label htmlFor={`feedback_${s.id}`} className="label">Feedback to the student</label>
                              <textarea id={`feedback_${s.id}`} name="feedback" rows={3} defaultValue={s.feedback ?? ''} className="field" />
                            </div>
                          </div>
                          {ai && !isQuiz && <AiFeedbackButton submissionId={s.id} targetId={`feedback_${s.id}`} />}
                        </ActionForm>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">No work has been submitted yet.</p>}
          </Card>

          {isQuiz && (
            <Card>
              <h2 className="text-lg font-semibold">Questions</h2>
              <p className="mt-1 text-sm text-muted">Correct answers are stored on the server and are never sent to students.</p>
              {questions?.length ? (
                <ol className="mt-4 space-y-4">
                  {questions.map((q, i) => (
                    <li key={q.id} className="rounded-xl border border-line p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{i + 1}. {q.prompt} <span className="text-sm font-normal text-muted">({Number(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'}{q.topic ? ` · ${q.topic}` : ''})</span></p>
                        <ActionForm action={deleteQuestionAction} submitLabel="Remove" variant="outline" size="sm" hidden={{ id: a.id, question_id: q.id }} confirm="Remove this question?" />
                      </div>
                      <ol className="mt-2 list-[upper-alpha] space-y-1 pl-6 text-sm">
                        {(q.options as string[]).map((o, j) => (
                          <li key={j} className={j === q.correct_index ? 'font-semibold text-ok' : ''}>{o}{j === q.correct_index && ' (correct)'}</li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              ) : <div className="mt-3"><Alert tone="warning">Add at least one question before publishing.</Alert></div>}
              {ai && <div className="mt-5"><AiQuestionDrafter assignmentId={a.id} /></div>}
              <div className="mt-5 border-t border-line pt-5">
                <h3 className="mb-3 font-semibold">Add a question</h3>
                <ActionForm action={addQuestionAction} submitLabel="Add question" variant="secondary" size="sm" hidden={{ id: a.id }} resetOnSuccess>
                  <div><label htmlFor="prompt" className="label">Question</label><textarea id="prompt" name="prompt" rows={2} required className="field" /></div>
                  <div>
                    <label htmlFor="options" className="label">Answer options (one per line)</label>
                    <textarea id="options" name="options" rows={4} required className="field" placeholder={'12\n14\n16\n18'} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label htmlFor="topic" className="label">Topic (optional)</label><input id="topic" name="topic" maxLength={80} className="field" placeholder="e.g. Fractions" /></div>
                    <div><label htmlFor="correct" className="label">Correct option number</label><input id="correct" name="correct" type="number" min={1} max={8} required className="field" /></div>
                    <div><label htmlFor="marks" className="label">Marks</label><input id="marks" name="marks" type="number" min={0.5} max={100} step="0.5" defaultValue={1} required className="field" /></div>
                  </div>
                </ActionForm>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <ActionForm action={updateAssignmentAction} submitLabel="Save changes" variant="secondary" hidden={{ id: a.id }}>
              <AssignmentFields
                values={{ ...a, due_local: a.due_at ? utcToZonedInput(a.due_at, timezone) : '', rubric: a.rubric as Array<{ criterion: string; marks: number }> }}
                students={students ?? []}
                selected={(assigned ?? []).map((x) => x.student_id)}
                programmes={programmes ?? []}
                timezone={timezone}
              />
            </ActionForm>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Delete</h2>
            <p className="mb-3 mt-1 text-sm text-muted">Only possible while there are no submissions.</p>
            <ActionForm action={deleteAssignmentAction} submitLabel="Delete assignment" variant="danger" size="sm" hidden={{ id: a.id }} confirm="Delete this assignment permanently?" />
          </Card>
        </div>
      </div>
    </>
  );
}
