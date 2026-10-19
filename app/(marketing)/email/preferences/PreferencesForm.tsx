'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { EMAIL_CHOICES } from '@/lib/email/choices';
import { savePreferencesAction } from './actions';

function Save({ label, variant, name, value }: { label: string; variant?: 'outline'; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending} name={name} value={value}>{pending ? 'Saving…' : label}</Button>;
}

export function PreferencesForm({ token, current }: { token: string; current: { reminders: boolean; updates: boolean; reports: boolean } }) {
  const [state, action] = useFormState(savePreferencesAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Send me</legend>
        {EMAIL_CHOICES.map((c) => (
          <label key={c.name} className="flex items-start gap-3 rounded-2xl bg-sunken p-3">
            <input type="checkbox" name={c.name} defaultChecked={current[c.name]} className="mt-1 h-5 w-5" />
            <span><span className="font-medium">{c.label}</span><span className="block text-sm text-muted">{c.hint}</span></span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">Sign-in links, invoices and payment receipts are always sent.</p>
      <div className="flex flex-wrap gap-2">
        <Save label="Save preferences" />
        <Save label="Unsubscribe from all optional emails" variant="outline" name="all" value="off" />
      </div>
      {state && <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'font-medium text-ok' : 'font-medium text-bad'}>{state.message}</p>}
    </form>
  );
}
