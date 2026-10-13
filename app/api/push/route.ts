import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionProfile } from '@/lib/auth';
import { sameOrigin } from '@/lib/security/request';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1000),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

/** Save this device's push subscription for the signed-in user (RLS: own rows only). */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  const supabase = createClient();
  // An endpoint belongs to one browser; replace any previous owner of this exact endpoint we can see.
  await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    endpoint: parsed.data.endpoint, user_id: profile.id, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth,
  });
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  await createClient().from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', profile.id);
  return NextResponse.json({ ok: true });
}
