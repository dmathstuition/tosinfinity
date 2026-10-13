'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';

export type FormActionState = { ok: boolean; message: string } | null;
type Action = (prev: FormActionState, formData: FormData) => Promise<FormActionState>;
type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

function Submit({ label, variant, size, confirm }: { label: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? 'Working…' : label}
    </Button>
  );
}

/**
 * Form bound to a server action. Shows the action's result message to everyone,
 * including screen-reader users, and optionally clears the fields after success.
 */
export function ActionForm({
  action, submitLabel, children, className, variant, size, confirm, resetOnSuccess, hidden,
}: {
  action: Action;
  submitLabel: string;
  children?: ReactNode;
  className?: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  /** Ask for confirmation before submitting (destructive or irreversible actions). */
  confirm?: string;
  resetOnSuccess?: boolean;
  /** Hidden fields, e.g. { id: '…' }. */
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useFormState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className ?? 'grid gap-4'}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
      <div><Submit label={submitLabel} variant={variant} size={size} confirm={confirm} /></div>
    </form>
  );
}
