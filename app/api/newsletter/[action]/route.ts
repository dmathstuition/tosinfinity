import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * /api/newsletter/verify?token=…       confirms a subscription (double opt-in)
 * /api/newsletter/unsubscribe?token=…  one-click unsubscribe (GET from the email link,
 *                                      POST for mail clients' List-Unsubscribe button)
 * The token is a 48-character random value unique to each subscriber.
 */
async function handle(request: NextRequest, action: string) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const done = (state: string) => NextResponse.redirect(new URL(`/newsletter?state=${state}`, request.url), 303);
  if ((action !== 'verify' && action !== 'unsubscribe') || !/^[a-f0-9]{48}$/.test(token) || !adminConfigured()) return done('invalid');
  if (!(await rateLimit('newsletter-link', clientIp(), 30, 600))) return done('invalid');

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const patch = action === 'verify'
    ? { status: 'verified', verified_at: now, unsubscribed_at: null }
    : { status: 'unsubscribed', unsubscribed_at: now };
  let query = admin.from('blog_subscribers').update(patch).eq('token', token);
  // Verifying must not silently re-subscribe someone who has unsubscribed.
  if (action === 'verify') query = query.eq('status', 'pending');
  const { data } = await query.select('id');
  if (!data?.length && action === 'verify') {
    const { data: existing } = await admin.from('blog_subscribers').select('status').eq('token', token).maybeSingle();
    return done(existing?.status === 'verified' ? 'verified' : 'invalid');
  }
  return done(data?.length ? (action === 'verify' ? 'verified' : 'unsubscribed') : 'invalid');
}

export async function GET(request: NextRequest, { params }: { params: { action: string } }) {
  return handle(request, params.action);
}

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
  return handle(request, params.action);
}
