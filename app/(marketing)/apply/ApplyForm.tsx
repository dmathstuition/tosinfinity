'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import {
  APPLICATION_STEPS, applicationSchema, CURRICULUM_OPTIONS, EXAM_OPTIONS, SUBJECT_OPTIONS, type ApplicationInput,
} from '@/lib/validation/application';
import { submitApplication } from './actions';

type FormState = {
  student_name: string; student_dob: string; student_age: string; student_email: string; school_year: string;
  curriculum: string; location: string; guardian_name: string; guardian_email: string; guardian_phone: string;
  guardian_relationship: string; subjects: string[]; current_level: string; exam_target: string;
  delivery: '' | 'home' | 'online'; preferred_times: string; challenges: string; strengths: string;
  desired_outcomes: string; notes: string; consent: boolean;
};

const EMPTY: FormState = {
  student_name: '', student_dob: '', student_age: '', student_email: '', school_year: '', curriculum: '',
  location: '', guardian_name: '', guardian_email: '', guardian_phone: '', guardian_relationship: '',
  subjects: [], current_level: '', exam_target: '', delivery: '', preferred_times: '', challenges: '',
  strengths: '', desired_outcomes: '', notes: '', consent: false,
};

type Errors = Record<string, string>;

function validate(values: FormState): Errors {
  const result = applicationSchema.safeParse(values);
  const errors: Errors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const k = String(issue.path[0] ?? '');
      if (k && !errors[k]) errors[k] = issue.message;
    }
  }
  return errors;
}

export function ApplyForm() {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [serverMessage, setServerMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [pending, startTransition] = useTransition();
  const startedAt = useRef(Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the step heading so keyboard and screen-reader users follow the change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _removed, ...rest } = e;
      return rest;
    });
  };

  const stepErrors = (index: number, all: Errors): Errors => {
    const fields: readonly string[] = APPLICATION_STEPS[index]?.fields ?? [];
    return Object.fromEntries(Object.entries(all).filter(([k]) => fields.includes(k)));
  };

  const next = () => {
    const errs = stepErrors(step, validate(values));
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep((s) => s + 1);
    else focusFirstError(errs);
  };

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    // A timeout (not requestAnimationFrame) so focus still moves if the tab is in the background.
    if (first) setTimeout(() => document.getElementById(`f-${first}`)?.focus(), 0);
  };

  const submit = () => {
    const all = validate(values);
    if (Object.keys(all).length) {
      const firstBad = APPLICATION_STEPS.findIndex((_, i) => Object.keys(stepErrors(i, all)).length > 0);
      const target = firstBad === -1 ? step : firstBad;
      setStep(target);
      setErrors(stepErrors(target, all));
      focusFirstError(stepErrors(target, all));
      return;
    }
    setServerMessage('');
    startTransition(async () => {
      const result = await submitApplication(values as unknown as ApplicationInput, {
        website,
        startedAt: startedAt.current,
      });
      // On success the action redirects, so reaching here means it failed.
      if (result && !result.ok) {
        setServerMessage(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  };

  const input = (
    name: keyof FormState,
    label: string,
    opts: { type?: string; required?: boolean; hint?: string; autoComplete?: string; inputMode?: 'tel' | 'email' | 'numeric' } = {},
  ) => (
    <div>
      <label htmlFor={`f-${name}`} className="label">
        {label}
        {opts.required ? <span className="text-bad" aria-hidden="true"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <input
        id={`f-${name}`}
        type={opts.type ?? 'text'}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete}
        className={clsx('field', errors[name] && '!border-bad')}
        value={values[name] as string}
        onChange={(e) => set(name, e.target.value as never)}
        aria-required={opts.required}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `f-${name}-error` : opts.hint ? `f-${name}-hint` : undefined}
      />
      {opts.hint && !errors[name] && <p id={`f-${name}-hint`} className="mt-1 text-xs text-muted">{opts.hint}</p>}
      {errors[name] && <p id={`f-${name}-error`} className="mt-1 text-sm text-bad">{errors[name]}</p>}
    </div>
  );

  const textarea = (name: keyof FormState, label: string, hint?: string) => (
    <div>
      <label htmlFor={`f-${name}`} className="label">
        {label} <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={`f-${name}`}
        rows={3}
        maxLength={1000}
        className="field"
        value={values[name] as string}
        onChange={(e) => set(name, e.target.value as never)}
        aria-describedby={hint ? `f-${name}-hint` : undefined}
      />
      {hint && <p id={`f-${name}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  const total = APPLICATION_STEPS.length;
  const last = step === total - 1;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (last) submit();
        else next();
      }}
      className="card p-5 sm:p-8"
    >
      <div aria-hidden="true" className="mb-2 flex gap-1.5">
        {APPLICATION_STEPS.map((s, i) => (
          <span key={s.title} className={clsx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-orange' : 'bg-line')} />
        ))}
      </div>
      <p className="text-sm text-muted">Step {step + 1} of {total}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-semibold outline-none">
        {APPLICATION_STEPS[step]?.title}
      </h2>

      <div className="mt-6 grid gap-5">
        {step === 0 && (
          <>
            {input('student_name', 'Learner’s full name', { required: true, autoComplete: 'off' })}
            <div className="grid gap-5 sm:grid-cols-2">
              {input('student_dob', 'Date of birth', { type: 'date', hint: 'Or give an age instead.' })}
              {input('student_age', 'Age', { inputMode: 'numeric' })}
            </div>
            {input('school_year', 'Current class or school year', { required: true, hint: 'For example: Primary 5, JSS2, SS1, Year 10.' })}
            <div>
              <label htmlFor="f-curriculum" className="label">Curriculum <span className="font-normal text-muted">(optional)</span></label>
              <select id="f-curriculum" className="field" value={values.curriculum} onChange={(e) => set('curriculum', e.target.value)}>
                <option value="">Select…</option>
                {CURRICULUM_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {input('student_email', 'Learner’s own email', {
              type: 'email', inputMode: 'email',
              hint: 'Used for the learner’s portal login. Leave blank if they do not have one; we can arrange this later.',
            })}
          </>
        )}

        {step === 1 && (
          <>
            {input('guardian_name', 'Parent or guardian’s full name', { required: true, autoComplete: 'name' })}
            {input('guardian_email', 'Email', { required: true, type: 'email', inputMode: 'email', autoComplete: 'email' })}
            {input('guardian_phone', 'Phone number', { required: true, type: 'tel', inputMode: 'tel', autoComplete: 'tel', hint: 'A number we can call or reach on WhatsApp.' })}
            {input('guardian_relationship', 'Relationship to the learner', { required: true, hint: 'For example: mother, father, guardian.' })}
          </>
        )}

        {step === 2 && (
          <>
            <fieldset aria-describedby={errors.subjects ? 'f-subjects-error' : undefined}>
              <legend className="label">Subjects required <span className="text-bad" aria-hidden="true">*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUBJECT_OPTIONS.map((s, i) => (
                  <label key={s} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 has-[:checked]:border-royal has-[:checked]:bg-royal/5">
                    <input
                      id={i === 0 ? 'f-subjects' : undefined}
                      type="checkbox"
                      className="h-5 w-5 accent-[rgb(var(--royal))]"
                      checked={values.subjects.includes(s)}
                      onChange={(e) => set('subjects', e.target.checked ? [...values.subjects, s] : values.subjects.filter((x) => x !== s))}
                    />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
              {errors.subjects && <p id="f-subjects-error" className="mt-1 text-sm text-bad">{errors.subjects}</p>}
            </fieldset>

            <div>
              <label htmlFor="f-exam_target" className="label">Examination target <span className="font-normal text-muted">(optional)</span></label>
              <select id="f-exam_target" className="field" value={values.exam_target} onChange={(e) => set('exam_target', e.target.value)}>
                <option value="">Select…</option>
                {EXAM_OPTIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <fieldset aria-describedby={errors.delivery ? 'f-delivery-error' : undefined}>
              <legend className="label">How would you like lessons delivered? <span className="text-bad" aria-hidden="true">*</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['home', 'online'] as const).map((d, i) => (
                  <label key={d} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 has-[:checked]:border-royal has-[:checked]:bg-royal/5">
                    <input
                      id={i === 0 ? 'f-delivery' : undefined}
                      type="radio"
                      name="delivery"
                      className="h-5 w-5 accent-[rgb(var(--royal))]"
                      checked={values.delivery === d}
                      onChange={() => set('delivery', d)}
                    />
                    <span className="text-sm font-medium">{d === 'home' ? 'Home tutoring' : 'Online tutoring'}</span>
                  </label>
                ))}
              </div>
              {errors.delivery && <p id="f-delivery-error" className="mt-1 text-sm text-bad">{errors.delivery}</p>}
            </fieldset>

            {values.delivery === 'home' &&
              input('location', 'Area or address for home tutoring', { required: true, autoComplete: 'street-address', hint: 'Used only to check whether home tutoring is possible in your area.' })}
            {input('current_level', 'Current level', { hint: 'For example: recent grades, or topics the learner finds easy or hard.' })}
            {input('preferred_times', 'Preferred days and times', { hint: 'For example: weekday evenings after 4pm, Saturday mornings.' })}
          </>
        )}

        {step === 3 && (
          <>
            {textarea('challenges', 'Main learning challenges')}
            {textarea('strengths', 'Existing strengths')}
            {textarea('desired_outcomes', 'What would you like tutoring to achieve?')}
            {textarea('notes', 'Anything else we should know?')}
            <div className="rounded-xl bg-cloud p-4 text-sm text-muted">
              <p>
                We use the details in this form only to respond to your enquiry and, if you enrol, to set up the learner’s
                account. We do not sell personal information. See our{' '}
                <Link href="/privacy" className="text-link underline" target="_blank">privacy policy</Link>.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-ink">
                <input
                  id="f-consent"
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--royal))]"
                  checked={values.consent}
                  onChange={(e) => set('consent', e.target.checked)}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? 'f-consent-error' : undefined}
                />
                <span>
                  I am the learner’s parent or guardian (or an adult learner) and I agree to Tosinfinity Academy contacting me
                  about this application.
                </span>
              </label>
              {errors.consent && <p id="f-consent-error" className="mt-1 text-sm text-bad">{errors.consent}</p>}
            </div>
          </>
        )}
      </div>

      {/* Honeypot field: visually hidden and skipped by assistive technology. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {serverMessage && <div className="mt-5"><Alert tone="error">{serverMessage}</Alert></div>}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </Button>
        ) : <span />}
        <Button type="submit" disabled={pending}>
          {last ? (pending ? 'Sending…' : 'Submit application') : 'Continue'}
        </Button>
      </div>
      {last && <p className="mt-3 text-center text-xs text-muted sm:text-right">No payment is taken when you apply.</p>}
    </form>
  );
}
