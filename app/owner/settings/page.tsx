import type { ReactNode } from 'react';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, PageHeader } from '@/components/ui/primitives';
import { aiConfigured } from '@/lib/ai';
import { emailConfigured } from '@/lib/email';
import { optionalEnv, publicEnv } from '@/lib/env';
import { DEFAULT_BILLING, type BillingSettings } from '@/lib/invoicing';
import { DEFAULT_FAQ } from '@/lib/marketing-content';
import { ownerContext } from '@/lib/owner';
import { getProvider } from '@/lib/payments';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/lib/site';
import { adminConfigured } from '@/lib/supabase/admin';
import {
  saveAcademyAction, saveBillingAction, saveBrandAction, saveFaqAction, saveLocaleAction, saveNotificationsAction,
  savePoliciesAction, savePricingAction, saveTestimonialsAction,
} from './actions';

export const metadata = { title: 'Settings' };

function Panel({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <details id={id} className="card group p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <span><span className="font-heading text-lg font-semibold">{title}</span>{hint && <span className="block text-sm text-muted">{hint}</span>}</span>
        <span aria-hidden="true" className="text-2xl leading-none text-link transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-line p-5">{children}</div>
    </details>
  );
}

function Status({ on, label, envs }: { on: boolean; label: string; envs: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted">{envs}</span></span>
      <Badge tone={on ? 'green' : 'neutral'}>{on ? 'Configured' : 'Not configured'}</Badge>
    </li>
  );
}

export default async function SettingsPage() {
  const { supabase } = await ownerContext();
  const { data } = await supabase.from('settings').select('key, value');
  const get = <T,>(key: string, fallback: T): T => {
    const v = data?.find((r) => r.key === key)?.value;
    return v == null ? fallback : Array.isArray(fallback) ? (v as T) : ({ ...(fallback as object), ...(v as object) } as T);
  };
  const academy = get<SiteSettings['academy']>('academy', DEFAULT_SETTINGS.academy);
  const locale = get('locale', DEFAULT_SETTINGS.locale);
  const brand = get('brand', DEFAULT_SETTINGS.brand);
  const pricing = get('pricing', DEFAULT_SETTINGS.pricing);
  const faq = get<SiteSettings['faq']>('faq', []);
  const testimonials = get<SiteSettings['testimonials']>('testimonials', []);
  const policies = get('policies', DEFAULT_SETTINGS.policies);
  const billing = get<BillingSettings>('billing', DEFAULT_BILLING);
  const notifications = get('notifications', { class_reminders: true, work_reminders: true, weekly_reports: true } as { class_reminders?: boolean; work_reminders?: boolean; weekly_reports?: boolean });
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [locale.timezone];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Academy details, website content and policies."
        actions={
          <>
            <ButtonLink href="/owner/settings/security" variant="outline" size="sm">Security</ButtonLink>
            <ButtonLink href="/owner/settings/audit" variant="outline" size="sm">Audit log</ButtonLink>
            <ButtonLink href="/owner/programmes" variant="outline" size="sm">Programme catalogue</ButtonLink>
          </>
        }
      />
      <div className="grid max-w-4xl gap-4">
        <Panel id="academy" title="Academy and contact details" hint="Shown across the public website.">
          <ActionForm action={saveAcademyAction} submitLabel="Save" variant="secondary">
            <div><label htmlFor="name" className="label">Academy name</label><input id="name" name="name" required defaultValue={academy.name} className="field" /></div>
            <div><label htmlFor="tagline" className="label">Tagline</label><textarea id="tagline" name="tagline" rows={2} defaultValue={academy.tagline} className="field" /></div>
            <div><label htmlFor="mission" className="label">Mission</label><textarea id="mission" name="mission" rows={3} defaultValue={academy.mission} className="field" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="phones" className="label">Phone numbers (one per line)</label><textarea id="phones" name="phones" rows={2} required defaultValue={academy.phones.join('\n')} className="field" /></div>
              <div>
                <label htmlFor="whatsapp" className="label">WhatsApp number</label>
                <input id="whatsapp" name="whatsapp" defaultValue={academy.whatsapp} className="field" aria-describedby="wa-hint" />
                <p id="wa-hint" className="mt-1 text-xs text-muted">Leave blank to use the first phone number.</p>
              </div>
              <div>
                <label htmlFor="email" className="label">Public email</label>
                <input id="email" name="email" type="email" defaultValue={academy.email} className="field" aria-describedby="email-hint" />
                <p id="email-hint" className="mt-1 text-xs text-muted">Leave blank and no email address is shown on the website.</p>
              </div>
              <div><label htmlFor="address" className="label">Address or service area</label><input id="address" name="address" defaultValue={academy.address} className="field" /></div>
            </div>
            <div>
              <label htmlFor="founder_bio" className="label">Founder biography</label>
              <textarea id="founder_bio" name="founder_bio" rows={4} defaultValue={academy.founder_bio} className="field" aria-describedby="bio-hint" />
              <p id="bio-hint" className="mt-1 text-xs text-muted">Appears on the About page. Nothing is shown until you write it.</p>
            </div>
            <div>
              <label htmlFor="qualifications" className="label">Verified qualifications (one per line)</label>
              <textarea id="qualifications" name="qualifications" rows={3} defaultValue={academy.qualifications.join('\n')} className="field" aria-describedby="qual-hint" />
              <p id="qual-hint" className="mt-1 text-xs text-muted">List only qualifications you hold and can evidence.</p>
            </div>
          </ActionForm>
        </Panel>

        <Panel id="locale" title="Time zone and currency" hint="Used for lesson times, invoices and reminders.">
          <ActionForm action={saveLocaleAction} submitLabel="Save" variant="secondary">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="timezone" className="label">Academy time zone</label>
                <select id="timezone" name="timezone" defaultValue={locale.timezone} className="field">{zones.map((z) => <option key={z}>{z}</option>)}</select>
              </div>
              <div>
                <label htmlFor="currency" className="label">Currency (ISO code)</label>
                <input id="currency" name="currency" required maxLength={3} defaultValue={locale.currency} className="field uppercase" aria-describedby="cur-hint" />
                <p id="cur-hint" className="mt-1 text-xs text-muted">For example NGN, USD, GBP. Existing invoices keep the currency they were issued in. Online payment requires a currency your Paystack account supports.</p>
              </div>
            </div>
          </ActionForm>
        </Panel>

        <Panel id="brand" title="Brand colours" hint="Applied across the website and portals.">
          <ActionForm action={saveBrandAction} submitLabel="Save colours" variant="secondary">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(['royal', 'navy', 'gold', 'orange'] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`brand-${k}`} className="label capitalize">{k === 'royal' ? 'Royal blue' : k}</label>
                  <input id={`brand-${k}`} name={k} type="color" defaultValue={brand[k]} className="h-11 w-full cursor-pointer rounded-xl border border-line bg-surface p-1" />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="reset" className="h-5 w-5 accent-[rgb(var(--royal))]" /> Reset to the original Tosinfinity colours</label>
            <p className="text-xs text-muted">Keep blue and navy dark and gold and orange bright so text stays readable. The logo files live in <code>public/brand</code>; see README.md to replace them.</p>
          </ActionForm>
        </Panel>

        <Panel id="pricing" title="Pricing page" hint="Public rates. Leave empty to show “Contact us for current rates”.">
          <ActionForm action={savePricingAction} submitLabel="Save" variant="secondary">
            <div>
              <label htmlFor="plans" className="label">Rates (one per line)</label>
              <textarea id="plans" name="plans" rows={4} defaultValue={pricing.plans.map((p) => `${p.name} | ${p.price} | ${p.description}`).join('\n')} placeholder="Name | Price | Description" className="field font-mono text-sm" />
            </div>
            <div><label htmlFor="note" className="label">Note under the rates</label><textarea id="note" name="note" rows={2} defaultValue={pricing.note} className="field" /></div>
          </ActionForm>
        </Panel>

        <Panel id="faq" title="Frequently asked questions" hint={faq.length ? `${faq.length} custom questions` : 'Using the built-in questions.'}>
          <ActionForm action={saveFaqAction} submitLabel="Save" variant="secondary">
            <div>
              <label htmlFor="faq-text" className="label">Questions and answers</label>
              <textarea id="faq-text" name="faq" rows={12} defaultValue={(faq.length ? faq : DEFAULT_FAQ).map((f) => `${f.question}\n${f.answer}`).join('\n\n')} className="field" aria-describedby="faq-hint" />
              <p id="faq-hint" className="mt-1 text-xs text-muted">Question on one line, the answer on the next, and a blank line between questions.</p>
            </div>
          </ActionForm>
        </Panel>

        <Panel id="testimonials" title="Testimonials" hint="Shown on the homepage only when you add genuine ones.">
          <ActionForm action={saveTestimonialsAction} submitLabel="Save" variant="secondary">
            <div>
              <label htmlFor="testimonials-text" className="label">Testimonials</label>
              <textarea id="testimonials-text" name="testimonials" rows={8} defaultValue={testimonials.map((t) => [t.quote, t.author, t.context].filter(Boolean).join('\n')).join('\n\n')} className="field" aria-describedby="t-hint" />
              <p id="t-hint" className="mt-1 text-xs text-muted">Three lines each: the quote, who said it, and optional context (for example “Parent of a JSS2 student”). Blank line between testimonials.</p>
            </div>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm_genuine" className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" /><span>I confirm these are real testimonials, quoted accurately and shared with the person’s permission.</span></label>
          </ActionForm>
        </Panel>

        <Panel id="policies" title="Privacy, terms and refund policy" hint="Leave a box empty to use the built-in baseline text.">
          <ActionForm action={savePoliciesAction} submitLabel="Save" variant="secondary">
            {(['privacy', 'terms', 'refund'] as const).map((k) => (
              <div key={k}>
                <label htmlFor={`policy-${k}`} className="label">{k === 'privacy' ? 'Privacy Policy' : k === 'terms' ? 'Terms of Service' : 'Refund Policy'} (Markdown)</label>
                <textarea id={`policy-${k}`} name={k} rows={6} defaultValue={policies[k]} className="field" />
              </div>
            ))}
            <p className="text-xs text-muted">The baseline text describes how this platform works; it is not legal advice. Have your policies reviewed before relying on them.</p>
          </ActionForm>
        </Panel>

        <Panel id="billing" title="Billing policy" hint="When tuition invoices are drafted and when they fall due.">
          <ActionForm action={saveBillingAction} submitLabel="Save" variant="secondary">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor="invoice_day" className="label">Draft invoices on day</label><input id="invoice_day" name="invoice_day" type="number" min={1} max={28} required defaultValue={billing.invoice_day} className="field" aria-describedby="inv-hint" /><p id="inv-hint" className="mt-1 text-xs text-muted">Of each month, for the previous month.</p></div>
              <div><label htmlFor="due_days" className="label">Days to pay</label><input id="due_days" name="due_days" type="number" min={0} max={90} required defaultValue={billing.due_days} className="field" /></div>
              <div><label htmlFor="reminder_days_before" className="label">Remind days before due</label><input id="reminder_days_before" name="reminder_days_before" type="number" min={1} max={30} required defaultValue={billing.reminder_days_before} className="field" /></div>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="auto_issue" defaultChecked={billing.auto_issue} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>Issue scheduled invoices automatically. Leave off to review each draft before families see it (recommended).</span>
            </label>
            <p className="text-xs text-muted">Each student’s billing mode, rate and absence policy are set on their profile.</p>
          </ActionForm>
        </Panel>

        <Panel id="notifications" title="Notification preferences">
          <ActionForm action={saveNotificationsAction} submitLabel="Save" variant="secondary">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="class_reminders" defaultChecked={notifications.class_reminders !== false} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>Send families a reminder the day before each class.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="work_reminders" defaultChecked={notifications.work_reminders !== false} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>Remind learners and parents the day before work is due, if it has not been handed in.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="weekly_reports" defaultChecked={notifications.weekly_reports !== false} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>Send a weekly progress email every Friday afternoon to each learner and their parents.</span>
            </label>
            <p className="text-xs text-muted">Families can also switch these emails off for themselves. Sign-in, invoice and receipt emails are always sent. See the <a href="/owner/emails" className="text-link underline">Email centre</a> for what was sent.</p>
          </ActionForm>
        </Panel>

        <Panel id="integrations" title="Integrations" hint="Email, payments, AI and analytics status.">
          <p className="mb-2 text-sm text-muted">Keys and secrets are set as environment variables on the server (Vercel → Project → Settings → Environment Variables) and are never shown or stored here.</p>
          <ul className="divide-y divide-line">
            <Status on={adminConfigured()} label="Account creation and scheduled jobs" envs="SUPABASE_SERVICE_ROLE_KEY" />
            <Status on={emailConfigured()} label="Email delivery" envs="EMAIL_PROVIDER, RESEND_API_KEY or EMAIL_RELAY_URL, EMAIL_FROM" />
            <Status on={Boolean(optionalEnv('OWNER_NOTIFY_EMAIL'))} label="Owner notification email" envs="OWNER_NOTIFY_EMAIL" />
            <Status on={getProvider().configured()} label="Online payments (Paystack)" envs="PAYSTACK_SECRET_KEY" />
            <Status on={Boolean(optionalEnv('CRON_SECRET'))} label="Scheduled invoices and reminders" envs="CRON_SECRET" />
            <Status on={aiConfigured()} label="AI assistant (optional)" envs="AI_API_KEY, AI_MODEL, AI_BASE_URL" />
            <Status on={Boolean(publicEnv.gaId)} label="Google Analytics (optional)" envs="NEXT_PUBLIC_GA_MEASUREMENT_ID" />
            <Status on={Boolean(optionalEnv('SENTRY_DSN'))} label="Error monitoring (optional)" envs="SENTRY_DSN" />
          </ul>
          <p className="mt-3 text-sm text-muted">Paystack webhook URL: <code className="break-all">{publicEnv.siteUrl}/api/webhooks/paystack</code></p>
        </Panel>
      </div>
    </>
  );
}
