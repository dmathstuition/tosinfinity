import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { memoryRateLimit, memoryUsage } from '@/lib/security/window';

export function clientIp(): string {
  const h = headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * Returns true when the action is allowed. Keys are hashed so raw IPs and
 * identifiers are never stored. Uses Postgres (shared across serverless
 * instances) when the service role is configured, otherwise per-instance memory.
 */
export async function rateLimit(
  action: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const key = createHash('sha256').update(`${action}:${identifier}`).digest('hex');
  if (adminConfigured()) {
    const { data, error } = await createAdminClient().rpc('check_rate_limit', {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (!error) return data === true;
    console.error('[rate-limit] database check failed; using memory fallback');
  }
  return memoryRateLimit(key, max, windowSeconds);
}

/** Uses so far in the current window for this action and identifier (for "N left" counters). */
export async function rateLimitUsage(action: string, identifier: string, windowSeconds: number): Promise<number> {
  const key = createHash('sha256').update(`${action}:${identifier}`).digest('hex');
  if (adminConfigured()) {
    const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
    const { data, error } = await createAdminClient().from('rate_limits').select('count').eq('key', key).eq('window_start', windowStart).maybeSingle();
    if (!error) return data?.count ?? 0;
  }
  return memoryUsage(key, windowSeconds);
}
