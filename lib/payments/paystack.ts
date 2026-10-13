import 'server-only';
import { optionalEnv } from '@/lib/env';
import type { PaymentProvider } from '@/lib/payments';

const API = 'https://api.paystack.co';

export const paystack: PaymentProvider = {
  name: 'paystack',
  configured: () => Boolean(optionalEnv('PAYSTACK_SECRET_KEY')),

  async initialise({ reference, amountMinor, currency, email, callbackUrl, metadata }) {
    const res = await fetch(`${API}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${optionalEnv('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, amount: amountMinor, currency, email, callback_url: callbackUrl, metadata }),
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; data?: { authorization_url?: string } } | null;
    if (!res.ok || !json?.status || !json.data?.authorization_url) {
      throw new Error(`Paystack initialise failed (${res.status})`);
    }
    return { checkoutUrl: json.data.authorization_url };
  },

  async verify(reference) {
    const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${optionalEnv('PAYSTACK_SECRET_KEY')}` },
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      data?: { status?: string; amount?: number; currency?: string; paid_at?: string; reference?: string };
    } | null;
    if (!res.ok || !json?.status || !json.data) return { paid: false };
    return {
      paid: json.data.status === 'success',
      amountMinor: json.data.amount,
      currency: json.data.currency,
      paidAt: json.data.paid_at,
    };
  },
};
