'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { confirmLinkAction, requestPasswordResetAction, setPasswordAction, signInAction, verifyMfaAction, type AuthState } from './actions';

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Please wait…' : children}
    </Button>
  );
}

function Message({ state }: { state: AuthState }) {
  if (!state) return null;
  return <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>;
}

export function SignInForm() {
  const [state, action] = useFormState(signInAction, null);
  return (
    <form action={action} className="grid gap-5">
      <Message state={state} />
      <div>
        <label htmlFor="identifier" className="label">Email or student ID</label>
        <input id="identifier" name="identifier" className="field" autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-describedby="identifier-hint" />
        <p id="identifier-hint" className="mt-1 text-xs text-muted">Students can use their ID, for example TA-2026-001.</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="mb-1.5 text-sm font-medium text-link hover:underline">Forgot password?</Link>
        </div>
        <input id="password" name="password" type="password" className="field" autoComplete="current-password" required />
      </div>
      <Submit>Sign in</Submit>
    </form>
  );
}

export function MfaForm() {
  const [state, action] = useFormState(verifyMfaAction, null);
  return (
    <form action={action} className="grid gap-5">
      <Message state={state} />
      <div>
        <label htmlFor="code" className="label">6-digit code</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} className="field text-center text-2xl tracking-[0.4em]" required autoFocus />
      </div>
      <Submit>Verify</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useFormState(requestPasswordResetAction, null);
  if (state?.ok) return <Message state={state} />;
  return (
    <form action={action} className="grid gap-5">
      <Message state={state} />
      <div>
        <label htmlFor="identifier" className="label">Email or student ID</label>
        <input id="identifier" name="identifier" className="field" autoComplete="username" autoCapitalize="none" required />
      </div>
      <Submit>Send password link</Submit>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action] = useFormState(setPasswordAction, null);
  return (
    <form action={action} className="grid gap-5">
      <Message state={state} />
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" className="field" autoComplete="new-password" minLength={10} required aria-describedby="password-hint" />
        <p id="password-hint" className="mt-1 text-xs text-muted">At least 10 characters, with a letter and a number.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repeat new password</label>
        <input id="confirm" name="confirm" type="password" className="field" autoComplete="new-password" minLength={10} required />
      </div>
      <Submit>Save password</Submit>
    </form>
  );
}

export function ConfirmLinkForm({ tokenHash }: { tokenHash: string }) {
  const [state, action] = useFormState(confirmLinkAction, null);
  return (
    <form action={action} className="grid gap-5">
      <Message state={state} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <Submit>Continue</Submit>
    </form>
  );
}
