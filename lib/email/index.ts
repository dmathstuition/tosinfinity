import 'server-only';
import { optionalEnv, publicEnv } from '@/lib/env';
import { templates, type TemplateData, type TemplateName } from '@/lib/email/templates';

export type EmailResult = { ok: boolean; provider: string; error?: string };

function provider(): 'resend' | 'relay' | 'console' {
  const p = optionalEnv('EMAIL_PROVIDER');
  if (p === 'resend' && optionalEnv('RESEND_API_KEY') && optionalEnv('EMAIL_FROM')) return 'resend';
  if (p === 'relay' && optionalEnv('EMAIL_RELAY_URL')) return 'relay';
  return 'console';
}

/** True only when a real delivery provider is configured. */
export function emailConfigured(): boolean {
  return provider() !== 'console';
}

/**
 * Send a templated email. Never throws: failures are logged (without the body,
 * links or tokens) and reported in the result so callers can continue.
 * In `console` mode nothing is sent; the message is printed for local development.
 */
export async function sendEmail<T extends TemplateName>(
  template: T,
  to: string,
  data: TemplateData[T],
): Promise<EmailResult> {
  const p = provider();
  const { subject, html, text } = templates[template](data as never, publicEnv.siteUrl);
  try {
    if (p === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${optionalEnv('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: optionalEnv('EMAIL_FROM'), to, subject, html, text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    } else if (p === 'relay') {
      // Works with the Gmail relay in scripts/gmail-relay.gs (Google Apps Script) or any
      // endpoint with the same contract. Apps Script web apps cannot read request
      // headers and always answer HTTP 200, so the secret also travels in the JSON body
      // (over HTTPS) and success is read from the reply's `ok` field.
      const secret = optionalEnv('EMAIL_RELAY_SECRET') ?? '';
      const res = await fetch(optionalEnv('EMAIL_RELAY_URL')!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': secret },
        body: JSON.stringify({ secret, template, from: optionalEnv('EMAIL_FROM'), to, subject, html, text }),
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Relay responded ${res.status}`);
      const reply = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (reply && reply.ok === false) throw new Error(`Relay refused: ${String(reply.error ?? 'unknown').slice(0, 80)}`);
      if (!reply) throw new Error('Relay did not return JSON (check the web app is deployed for "Anyone")');
    } else if (process.env.NODE_ENV !== 'production') {
      // Development aid only: lets you follow activation links locally.
      console.info(`\n[email:console] to=${to}\nsubject=${subject}\n${text}\n`);
    } else {
      console.warn(`[email] not configured; "${template}" was NOT sent`);
      return { ok: false, provider: p, error: 'Email provider not configured' };
    }
    console.info(`[email] template=${template} provider=${p} status=sent`);
    return { ok: true, provider: p };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown error';
    console.error(`[email] template=${template} provider=${p} status=failed reason=${error}`);
    return { ok: false, provider: p, error };
  }
}
