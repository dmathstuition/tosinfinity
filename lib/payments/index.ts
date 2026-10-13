import 'server-only';
import { randomBytes } from 'node:crypto';
import { formatMoney } from '@/lib/billing';
import { sendEmail } from '@/lib/email';
import { invoiceContacts } from '@/lib/invoicing';
import { createAdminClient } from '@/lib/supabase/admin';
import { paystack } from '@/lib/payments/paystack';

/** Provider contract. Add Stripe (or another gateway) by implementing this interface. */
export type PaymentProvider = {
  name: string;
  configured: () => boolean;
  initialise: (args: {
    reference: string;
    amountMinor: number;
    currency: string;
    email: string;
    callbackUrl: string;
    metadata: Record<string, string>;
  }) => Promise<{ checkoutUrl: string }>;
  verify: (reference: string) => Promise<{ paid: boolean; amountMinor?: number; currency?: string; paidAt?: string }>;
};

export function getProvider(): PaymentProvider {
  return paystack;
}

export function newReference(): string {
  return `TA-${Date.now().toString(36)}-${randomBytes(8).toString('hex')}`.toUpperCase();
}

export type SettleResult = 'credited' | 'already_credited' | 'not_paid' | 'unknown_reference' | 'mismatch';

/**
 * The single place a gateway payment is credited. Called by BOTH the webhook and the
 * return-from-checkout verification, so neither path trusts the browser:
 *  1. the reference must match an intent we created for a real invoice;
 *  2. the provider is asked (server to server) whether it was paid;
 *  3. amount and currency must match the intent;
 *  4. credit_payment() inserts with a unique reference, so repeats are no-ops.
 */
export async function settleReference(reference: string): Promise<SettleResult> {
  const admin = createAdminClient();
  const { data: intent } = await admin
    .from('payment_intents')
    .select('reference, invoice_id, amount_minor, currency, status')
    .eq('reference', reference)
    .maybeSingle();
  if (!intent) return 'unknown_reference';

  const result = await getProvider().verify(reference);
  if (!result.paid) return 'not_paid';
  if (result.amountMinor !== Number(intent.amount_minor) || result.currency?.toUpperCase() !== String(intent.currency).toUpperCase()) {
    console.error(`[payments] amount/currency mismatch for reference ${reference}`);
    return 'mismatch';
  }

  const { data: credited, error } = await admin.rpc('credit_payment', {
    p_invoice: intent.invoice_id,
    p_amount_minor: intent.amount_minor,
    p_currency: intent.currency,
    p_method: 'paystack',
    p_reference: reference,
    p_paid_at: result.paidAt ?? new Date().toISOString(),
    p_note: null,
    p_payload: { provider: getProvider().name },
  });
  if (error) throw new Error(`credit_payment failed: ${error.message}`);
  await admin.from('payment_intents').update({ status: 'succeeded' }).eq('reference', reference);
  if (!credited) return 'already_credited';

  // First (and only) time this reference is credited: email the receipt.
  const { data: inv } = await admin.from('invoices').select('number, student_id').eq('id', intent.invoice_id).maybeSingle();
  if (inv) {
    for (const c of await invoiceContacts(admin, inv.student_id)) {
      await sendEmail('paymentReceipt', c.email, { name: c.full_name, number: inv.number, amount: formatMoney(Number(intent.amount_minor), intent.currency), reference });
    }
  }
  return 'credited';
}
