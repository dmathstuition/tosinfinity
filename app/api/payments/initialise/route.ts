import { NextResponse } from 'next/server';
import { getSessionProfile, ROLE_HOME } from '@/lib/auth';
import { publicEnv } from '@/lib/env';
import { getProvider, newReference } from '@/lib/payments';
import { rateLimit } from '@/lib/security/rate-limit';
import { sameOrigin } from '@/lib/security/request';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Start an online payment. The amount is never taken from the browser: it is the
 * invoice's current balance, read on the server. The invoice is loaded with the
 * payer's own session, so RLS confirms they are entitled to see (and pay) it.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.redirect(new URL('/login', request.url), 303);
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });

  const form = await request.formData();
  const invoiceId = String(form.get('invoice_id') ?? '');
  const area = profile.role === 'owner' ? '/owner/billing' : `${ROLE_HOME[profile.role]}/invoices`;
  const back = (state: string) => NextResponse.redirect(new URL(`${area}/${invoiceId}?payment=${state}`, request.url), 303);
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return NextResponse.redirect(new URL(area, request.url), 303);

  const provider = getProvider();
  if (!provider.configured() || !adminConfigured()) return back('unavailable');
  if (!(await rateLimit('pay-init', profile.id, 10, 600))) return back('failed');

  const { data: invoice } = await createClient()
    .from('invoices').select('id, number, status, total_minor, paid_minor, currency').eq('id', invoiceId).maybeSingle();
  if (!invoice || !['unpaid', 'partially_paid', 'overdue'].includes(invoice.status)) return back('failed');
  const balance = Number(invoice.total_minor) - Number(invoice.paid_minor);
  if (balance <= 0) return back('failed');

  // Record the attempt first so the webhook can match the reference to this invoice.
  const reference = newReference();
  const admin = createAdminClient();
  const { error } = await admin.from('payment_intents').insert({
    reference, invoice_id: invoice.id, amount_minor: balance, currency: invoice.currency, created_by: profile.id,
  });
  if (error) return back('failed');

  try {
    const { checkoutUrl } = await provider.initialise({
      reference, amountMinor: balance, currency: invoice.currency, email: profile.email,
      callbackUrl: `${publicEnv.siteUrl}/api/payments/callback`,
      metadata: { invoice_number: invoice.number },
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (e) {
    console.error('[payments] initialise failed', e instanceof Error ? e.message : '');
    await admin.from('payment_intents').update({ status: 'failed' }).eq('reference', reference);
    return back('failed');
  }
}
