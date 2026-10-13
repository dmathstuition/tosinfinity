import { NextResponse } from 'next/server';
import { optionalEnv } from '@/lib/env';
import { captureException } from '@/lib/monitoring';
import { settleReference } from '@/lib/payments';
import { verifyPaystackSignature } from '@/lib/payments/signature';
import { adminConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Paystack webhook.
 *  - The signature is verified against the RAW body before anything is parsed.
 *  - The event is only a hint: settleReference() re-verifies with Paystack and checks
 *    the amount and currency against the invoice before crediting.
 *  - Paystack retries deliveries; crediting is idempotent on the unique reference.
 */
export async function POST(request: Request) {
  const secret = optionalEnv('PAYSTACK_SECRET_KEY');
  if (!secret || !adminConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get('x-paystack-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const reference = event.data?.reference;
  if (event.event !== 'charge.success' || typeof reference !== 'string' || !/^[A-Z0-9-]{10,80}$/.test(reference)) {
    return NextResponse.json({ received: true }); // acknowledged, nothing to do
  }

  try {
    const result = await settleReference(reference);
    console.info(`[webhook:paystack] reference=${reference} result=${result}`);
    return NextResponse.json({ received: true });
  } catch (e) {
    // A 500 asks Paystack to retry later; nothing was credited.
    console.error('[webhook:paystack] settle failed', e instanceof Error ? e.message : '');
    await captureException(e, 'webhook:paystack');
    return NextResponse.json({ error: 'Temporary failure' }, { status: 500 });
  }
}
