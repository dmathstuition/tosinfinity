import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile, ROLE_HOME } from '@/lib/auth';
import { settleReference } from '@/lib/payments';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Where the payment provider returns the payer. Arriving here proves nothing: the
 * reference is checked with the provider, server to server, before any credit.
 * (The webhook performs the same check, so a payer who closes the tab is still credited.)
 */
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference') ?? request.nextUrl.searchParams.get('trxref') ?? '';
  const profile = await getSessionProfile();
  const home = profile ? (profile.role === 'owner' ? '/owner/billing' : `${ROLE_HOME[profile.role]}/invoices`) : '/login';
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  if (!adminConfigured() || !/^[A-Z0-9-]{10,80}$/.test(reference)) return to(home);
  if (!(await rateLimit('pay-callback', clientIp(), 30, 600))) return to(home);

  let state = 'pending';
  try {
    const result = await settleReference(reference);
    state = result === 'credited' || result === 'already_credited' ? 'paid' : result === 'not_paid' ? 'failed' : 'pending';
  } catch (e) {
    console.error('[payments] callback settle failed', e instanceof Error ? e.message : '');
  }
  if (!profile) return to('/login');
  const { data: intent } = await createAdminClient().from('payment_intents').select('invoice_id').eq('reference', reference).maybeSingle();
  // The invoice page itself is protected by RLS, so this redirect reveals nothing.
  return to(intent ? `${home}/${intent.invoice_id}?payment=${state}` : home);
}
