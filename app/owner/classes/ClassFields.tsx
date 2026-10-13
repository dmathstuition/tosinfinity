type Student = { id: string; full_name: string; student_code: string | null };
type Values = {
  title?: string; starts_local?: string; duration_minutes?: number; delivery?: string; venue?: string | null;
  meeting_url?: string | null; objectives?: string | null; notes?: string | null; programme_id?: string | null;
};

/** Fields shared by "Schedule class" and the class editor. Times are academy wall-clock time. */
export function ClassFields({
  values = {}, students, selected = [], programmes, timezone, recurring,
}: {
  values?: Values; students: Student[]; selected?: string[]; programmes: Array<{ id: string; title: string }>; timezone: string; recurring?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="label">Title <span className="text-bad" aria-hidden="true">*</span></label>
          <input id="title" name="title" required defaultValue={values.title ?? ''} placeholder="e.g. JSS2 Mathematics: Algebra" className="field" />
        </div>
        <div>
          <label htmlFor="starts_local" className="label">Date and start time <span className="text-bad" aria-hidden="true">*</span></label>
          <input id="starts_local" name="starts_local" type="datetime-local" required defaultValue={values.starts_local ?? ''} className="field" aria-describedby="starts-hint" />
          <p id="starts-hint" className="mt-1 text-xs text-muted">Academy time ({timezone}). Families see it in their own local time.</p>
        </div>
        <div>
          <label htmlFor="duration_minutes" className="label">Duration (minutes) <span className="text-bad" aria-hidden="true">*</span></label>
          <input id="duration_minutes" name="duration_minutes" type="number" min={10} max={600} step={5} required defaultValue={values.duration_minutes ?? 60} className="field" />
        </div>
        <div>
          <label htmlFor="delivery" className="label">Delivery <span className="text-bad" aria-hidden="true">*</span></label>
          <select id="delivery" name="delivery" required defaultValue={values.delivery ?? 'online'} className="field">
            <option value="online">Online</option><option value="home">Home tutoring</option>
          </select>
        </div>
        <div>
          <label htmlFor="programme_id" className="label">Programme</label>
          <select id="programme_id" name="programme_id" defaultValue={values.programme_id ?? ''} className="field">
            <option value="">None</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="meeting_url" className="label">Online meeting link</label>
          <input id="meeting_url" name="meeting_url" type="url" defaultValue={values.meeting_url ?? ''} placeholder="https://meet.google.com/… or https://meet.jit.si/…" className="field" />
        </div>
        <div>
          <label htmlFor="venue" className="label">Home venue</label>
          <input id="venue" name="venue" defaultValue={values.venue ?? ''} className="field" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Students <span className="text-bad" aria-hidden="true">*</span></legend>
        {students.length ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
            {students.map((s) => (
              <label key={s.id} className="flex min-h-[40px] items-center gap-3 text-sm">
                <input type="checkbox" name="students" value={s.id} defaultChecked={selected.includes(s.id)} className="h-5 w-5 accent-[rgb(var(--royal))]" />
                <span>{s.full_name} <span className="text-muted">{s.student_code}</span></span>
              </label>
            ))}
          </div>
        ) : <p className="text-sm text-muted">There are no active students yet. Add a student first.</p>}
      </fieldset>

      <div>
        <label htmlFor="objectives" className="label">Lesson objectives</label>
        <textarea id="objectives" name="objectives" rows={2} defaultValue={values.objectives ?? ''} className="field" />
      </div>
      <div>
        <label htmlFor="notes" className="label">Lesson notes (shared with the family)</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={values.notes ?? ''} className="field" />
      </div>

      {recurring && (
        <div className="max-w-xs">
          <label htmlFor="repeat_weeks" className="label">Repeat weekly for</label>
          <select id="repeat_weeks" name="repeat_weeks" defaultValue="1" className="field">
            <option value="1">One session only</option>
            {[2, 4, 6, 8, 10, 12, 13, 26].map((w) => <option key={w} value={w}>{w} weeks</option>)}
          </select>
        </div>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="allow_conflicts" className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
        <span>Schedule anyway if this overlaps another class.</span>
      </label>
    </>
  );
}
