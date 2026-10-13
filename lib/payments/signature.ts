import { createHmac, timingSafeEqual } from 'node:crypto';

/** Paystack signs the raw request body with HMAC-SHA512 using the account's secret key. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(createHmac('sha512', secret).update(rawBody).digest('hex'), 'utf8');
  const given = Buffer.from(signature, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
