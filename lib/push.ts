import 'server-only';
import webpush from 'web-push';
import { optionalEnv } from '@/lib/env';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && optionalEnv('VAPID_PRIVATE_KEY') && optionalEnv('VAPID_SUBJECT') && adminConfigured());
}

/**
 * Best-effort Web Push to users who have opted in on a device. The payload is a
 * title, a short line and a link: never message text or other private content.
 * Failures are swallowed; expired subscriptions are removed.
 */
export async function sendPush(userIds: string[], payload: { title: string; body: string; href: string }): Promise<void> {
  if (!pushConfigured() || userIds.length === 0) return;
  try {
    webpush.setVapidDetails(optionalEnv('VAPID_SUBJECT')!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, optionalEnv('VAPID_PRIVATE_KEY')!);
    const admin = createAdminClient();
    const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', [...new Set(userIds)]);
    const body = JSON.stringify({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 140), href: payload.href });
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }),
    );
  } catch (e) {
    console.error('[push] send failed', e instanceof Error ? e.message : '');
  }
}
