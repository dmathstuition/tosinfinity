type Values = Partial<Record<'full_name' | 'email' | 'phone' | 'date_of_birth' | 'school_year' | 'curriculum' | 'location' | 'learning_needs' | 'goals' | 'delivery', string | null>>;

/** Form fields shared by "Add student" and the profile editor. */
export function StudentFields({ values = {}, withEmail }: { values?: Values; withEmail?: boolean }) {
  const v = (k: keyof Values) => values[k] ?? '';
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="full_name" className="label">Full name <span className="text-bad" aria-hidden="true">*</span></label>
          <input id="full_name" name="full_name" required defaultValue={v('full_name')} className="field" />
        </div>
        {withEmail && (
          <div>
            <label htmlFor="email" className="label">Login email <span className="text-bad" aria-hidden="true">*</span></label>
            <input id="email" name="email" type="email" required defaultValue={v('email')} className="field" aria-describedby="email-hint" />
            <p id="email-hint" className="mt-1 text-xs text-muted">The activation link is sent here.</p>
          </div>
        )}
        <div>
          <label htmlFor="phone" className="label">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={v('phone')} className="field" />
        </div>
        <div>
          <label htmlFor="date_of_birth" className="label">Date of birth</label>
          <input id="date_of_birth" name="date_of_birth" type="date" defaultValue={v('date_of_birth')} className="field" />
        </div>
        <div>
          <label htmlFor="school_year" className="label">Class / school year</label>
          <input id="school_year" name="school_year" defaultValue={v('school_year')} className="field" />
        </div>
        <div>
          <label htmlFor="curriculum" className="label">Curriculum</label>
          <input id="curriculum" name="curriculum" defaultValue={v('curriculum')} className="field" />
        </div>
        <div>
          <label htmlFor="delivery" className="label">Delivery</label>
          <select id="delivery" name="delivery" defaultValue={v('delivery')} className="field">
            <option value="">Not set</option><option value="home">Home tutoring</option><option value="online">Online tutoring</option>
          </select>
        </div>
        <div>
          <label htmlFor="location" className="label">Location (home tutoring)</label>
          <input id="location" name="location" defaultValue={v('location')} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="learning_needs" className="label">Learning needs</label>
        <textarea id="learning_needs" name="learning_needs" rows={3} defaultValue={v('learning_needs')} className="field" />
      </div>
      <div>
        <label htmlFor="goals" className="label">Goals</label>
        <textarea id="goals" name="goals" rows={3} defaultValue={v('goals')} className="field" />
      </div>
    </>
  );
}
