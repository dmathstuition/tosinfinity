'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert, Field } from '@/components/ui/primitives';
import { contactAction } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send message'}</Button>;
}

export function ContactForm() {
  const [state, action] = useFormState(contactAction, null);
  if (state?.ok) return <Alert tone="success">{state.message}</Alert>;
  const e = state?.errors ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      {state && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <Field label="Your name" htmlFor="c-name" required error={e.name}>
        <input id="c-name" name="name" className="field" autoComplete="name" required aria-invalid={Boolean(e.name)} aria-describedby={e.name ? 'c-name-error' : undefined} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="c-email" required error={e.email}>
          <input id="c-email" name="email" type="email" className="field" autoComplete="email" required aria-invalid={Boolean(e.email)} aria-describedby={e.email ? 'c-email-error' : undefined} />
        </Field>
        <Field label="Phone (optional)" htmlFor="c-phone">
          <input id="c-phone" name="phone" type="tel" className="field" autoComplete="tel" />
        </Field>
      </div>
      <Field label="How can we help?" htmlFor="c-message" required error={e.message}>
        <textarea id="c-message" name="message" rows={5} maxLength={4000} className="field" required aria-invalid={Boolean(e.message)} aria-describedby={e.message ? 'c-message-error' : undefined} />
      </Field>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div><Submit /></div>
    </form>
  );
}
