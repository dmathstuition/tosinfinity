import 'server-only';
import { optionalEnv, publicEnv } from '@/lib/env';
import { CATEGORY, MANAGE_MARKER, templates, type TemplateData, type TemplateName } from '@/lib/email/templates';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export type EmailResult = { ok: boolean; provider: string; error?: string; skipped?: boolean };

type Category = (typeof CATEGORY)[TemplateName];

/**
 * For optional emails: whether this address still wants the category, and its
 * secret token for the "manage preferences" link. Without the service role (local
 * development) everything is allowed and no link is added.
 */
async function preference(email: string, category: Category): Promise<{ allowed: boolean; token: string | null }> {
  if (category === 'essential' || !adminConfigured()) return { allowed: true, token: null };
  const admin = createAdminClient();
  const address = email.trim().toLowerCase();
  await admin.from('email_preferences').upsert({ email: address }, { onConflict: 'email', ignoreDuplicates: true });
  const { data } = await admin.from('email_preferences').select('token, reminders, updates, reports').eq('email', address).maybeSingle();
  if (!data) return { allowed: true, token: null };
  return { allowed: data[category] !== false, token: data.token as string };
}

/** Records the outcome (never the body). Logging problems never affect sending. */
async function logEmail(template: TemplateName, recipient: string, status: 'sent' | 'failed' | 'skipped' | 'logged', provider: string, error?: string) {
  if (!adminConfigured()) return;
  try {
    await createAdminClient().from('email_log').insert({ template, category: CATEGORY[template], recipient: recipient.toLowerCase().slice(0, 320), status, provider, error: error?.slice(0, 300) ?? null });
  } catch {
    // ignore
  }
}

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
  const category = CATEGORY[template];
  const pref = await preference(to, category).catch(() => ({ allowed: true, token: null }));
  if (!pref.allowed) {
    await logEmail(template, to, 'skipped', p, 'recipient switched this email off');
    return { ok: true, provider: p, skipped: true };
  }
  const rendered = templates[template](data as never, publicEnv.siteUrl);
  const manageUrl = pref.token ? `${publicEnv.siteUrl}/email/preferences?token=${pref.token}` : null;
  const subject = rendered.subject;
  const html = rendered.html.replace(MANAGE_MARKER, manageUrl ? ` <a href="${manageUrl}" style="color:inherit">Manage email preferences</a>` : '');
  const text = manageUrl ? `${rendered.text}

Manage email preferences: ${manageUrl}` : rendered.text;
  try {
    if (p === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${optionalEnv('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: optionalEnv('EMAIL_FROM'), to, subject, html, text,
          ...(manageUrl ? { headers: { 'List-Unsubscribe': `<${manageUrl}>` } } : {}),
        }),
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
      await logEmail(template, to, 'failed', p, 'Email provider not configured');
      return { ok: false, provider: p, error: 'Email provider not configured' };
    }
    console.info(`[email] template=${template} provider=${p} status=sent`);
    await logEmail(template, to, p === 'console' ? 'logged' : 'sent', p);
    return { ok: true, provider: p };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'unknown error';
    console.error(`[email] template=${template} provider=${p} status=failed reason=${error}`);
    await logEmail(template, to, 'failed', p, error);
    return { ok: false, provider: p, error };
  }
}

/** Which delivery route is in use: "resend", "relay" (Gmail via Apps Script) or "console" (not sending). */
export function emailProviderName(): 'resend' | 'relay' | 'console' {
  return provider();
}
