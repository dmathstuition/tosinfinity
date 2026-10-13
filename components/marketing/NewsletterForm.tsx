'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { subscribeAction } from '@/app/(marketing)/newsletter-actions';
import { buttonClass } from '@/components/ui/Button';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass('primary', 'md', 'shrink-0')}>
      {pending ? 'Sending…' : 'Subscribe'}
    </button>
  );
}

export function NewsletterForm() {
  const [state, action] = useFormState(subscribeAction, null);
  if (state?.ok) {
    return <p role="status" className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm">{state.message}</p>;
  }
  return (
    <form action={action} className="mt-4" noValidate>
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="field !border-white/30 !bg-white/10 !text-white placeholder:!text-white/60"
          aria-describedby="newsletter-note"
        />
        {/* Honeypot: hidden from people, tempting for bots. */}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <Submit />
      </div>
      <p id="newsletter-note" className="mt-2 text-xs text-muted">
        By subscribing you agree to receive emails from Tosinfinity Academy. See our privacy policy.
      </p>
      {state && !state.ok && <p role="alert" className="mt-2 text-sm text-gold">{state.message}</p>}
    </form>
  );
}
