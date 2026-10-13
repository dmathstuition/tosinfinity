type Student = { id: string; full_name: string; student_code: string | null };
type Values = {
  title?: string; instructions?: string; kind?: string; due_local?: string; max_marks?: number | string;
  time_limit_minutes?: number | null; randomise?: boolean; allow_resubmission?: boolean; programme_id?: string | null;
  rubric?: Array<{ criterion: string; marks: number }>;
};

export function AssignmentFields({
  values = {}, students, selected = [], programmes, timezone,
}: {
  values?: Values; students: Student[]; selected?: string[]; programmes: Array<{ id: string; title: string }>; timezone: string;
}) {
  return (
    <>
      <div>
        <label htmlFor="title" className="label">Title <span className="text-bad" aria-hidden="true">*</span></label>
        <input id="title" name="title" required defaultValue={values.title ?? ''} className="field" />
      </div>
      <div>
        <label htmlFor="instructions" className="label">Instructions</label>
        <textarea id="instructions" name="instructions" rows={5} defaultValue={values.instructions ?? ''} className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className="label">Type</label>
          <select id="kind" name="kind" defaultValue={values.kind ?? 'written'} className="field" aria-describedby="kind-hint">
            <option value="written">Written assignment (text and/or file upload)</option>
            <option value="quiz">Multiple-choice quiz (marked automatically)</option>
            <option value="timed">Timed practice (multiple choice with a time limit)</option>
          </select>
          <p id="kind-hint" className="mt-1 text-xs text-muted">Questions for quizzes are added after saving.</p>
        </div>
        <div>
          <label htmlFor="due_local" className="label">Due date</label>
          <input id="due_local" name="due_local" type="datetime-local" defaultValue={values.due_local ?? ''} className="field" aria-describedby="due-hint" />
          <p id="due-hint" className="mt-1 text-xs text-muted">Academy time ({timezone}).</p>
        </div>
        <div>
          <label htmlFor="max_marks" className="label">Total marks</label>
          <input id="max_marks" name="max_marks" type="number" min={1} max={1000} step="0.5" required defaultValue={values.max_marks ?? 100} className="field" />
        </div>
        <div>
          <label htmlFor="time_limit_minutes" className="label">Time limit (minutes)</label>
          <input id="time_limit_minutes" name="time_limit_minutes" type="number" min={1} max={600} defaultValue={values.time_limit_minutes ?? ''} className="field" />
        </div>
        <div>
          <label htmlFor="programme_id" className="label">Programme</label>
          <select id="programme_id" name="programme_id" defaultValue={values.programme_id ?? ''} className="field">
            <option value="">None</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="allow_resubmission" defaultChecked={values.allow_resubmission} className="h-5 w-5 accent-[rgb(var(--royal))]" />
          Allow resubmissions (each attempt is kept in the history)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="randomise" defaultChecked={values.randomise} className="h-5 w-5 accent-[rgb(var(--royal))]" />
          Show quiz questions in a random order
        </label>
      </div>
      <div>
        <label htmlFor="rubric" className="label">Grading rubric</label>
        <textarea id="rubric" name="rubric" rows={3} defaultValue={(values.rubric ?? []).map((r) => `${r.criterion} | ${r.marks}`).join('\n')} placeholder={'Method shown | 4\nCorrect answer | 6'} className="field" aria-describedby="rubric-hint" />
        <p id="rubric-hint" className="mt-1 text-xs text-muted">Optional. One criterion per line, then a bar and the marks. Students see the rubric.</p>
      </div>
      <fieldset>
        <legend className="label">Assign to <span className="text-bad" aria-hidden="true">*</span></legend>
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
          {students.map((s) => (
            <label key={s.id} className="flex min-h-[40px] items-center gap-3 text-sm">
              <input type="checkbox" name="students" value={s.id} defaultChecked={selected.includes(s.id)} className="h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>{s.full_name} <span className="text-muted">{s.student_code}</span></span>
            </label>
          ))}
          {students.length === 0 && <p className="text-sm text-muted">There are no active students yet.</p>}
        </div>
      </fieldset>
    </>
  );
}
