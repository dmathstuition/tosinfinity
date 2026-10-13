'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

type Enrolment = { factorId: string; qr: string; secret: string };

/**
 * Two-step verification (TOTP) for the Owner. Enrolment happens in the browser with
 * the Owner's own session; afterwards a full page load lets the server see the
 * upgraded (aal2) session and enforce it on every Owner page.
 */
export function MfaPanel({ enrolled, factorId }: { enrolled: boolean; factorId: string | null }) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const begin = async () => {
    setBusy(true);
    setError('');
    // Clear any half-finished enrolment first so a fresh secret is issued.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (e || !data) return setError('Could not start set-up. Check that TOTP is enabled in Supabase → Authentication → Multi-factor.');
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async () => {
    if (!enrolment) return;
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.replace(/\s/g, '') });
    setBusy(false);
    if (e) return setError('That code was not accepted. Enter the current 6-digit code from the app.');
    // Full navigation so the server reads the refreshed, second-factor session cookie.
    window.location.assign('/owner/settings/security?enabled=1');
  };

  const disable = async () => {
    if (!factorId || !window.confirm('Turn off two-step verification? Your account will be protected by your password only.')) return;
    setBusy(true);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) return setError('Could not turn it off. Sign out, sign in again with your code, and retry.');
    await supabase.auth.refreshSession();
    router.refresh();
    window.location.assign('/owner/settings/security');
  };

  if (enrolled) {
    return (
      <div className="grid gap-4">
        <Alert tone="success">Two-step verification is on. You will be asked for a code each time you sign in.</Alert>
        {error && <Alert tone="error">{error}</Alert>}
        <div><Button variant="outline" onClick={disable} disabled={busy}>Turn off two-step verification</Button></div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {!enrolment ? (
        <>
          <p className="text-sm text-muted">Use an authenticator app such as Google Authenticator, Microsoft Authenticator or Authy. After set-up, signing in needs your password and a 6-digit code from the app.</p>
          <div><Button onClick={begin} disabled={busy}>{busy ? 'Starting…' : 'Set up two-step verification'}</Button></div>
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open your authenticator app and scan this QR code.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolment.qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-xl border border-line bg-white p-2" />
          <p className="text-sm text-muted">Cannot scan? Enter this key manually: <code className="break-all font-semibold text-ink">{enrolment.secret}</code></p>
          <div className="max-w-xs">
            <label htmlFor="mfa-code" className="label">6-digit code</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="field text-center text-xl tracking-[0.3em]" />
          </div>
          <div><Button onClick={confirm} disabled={busy || code.replace(/\s/g, '').length !== 6}>{busy ? 'Checking…' : 'Turn on'}</Button></div>
        </>
      )}
    </div>
  );
}
