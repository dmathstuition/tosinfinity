import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, requireEnv, supabaseConfigured } from '@/lib/env';

/**
 * Service-role client. BYPASSES RLS.
 * Only call from server code that has already (a) authenticated the requester and
 * verified the Owner role, or (b) verified a webhook signature / cron secret, or
 * (c) is performing a narrow system task (rate limiting, student-ID lookup at sign-in).
 * Never import from Client Components or pass the client to one.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminConfigured(): boolean {
  return supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
