import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { publicEnv, supabaseConfigured } from '@/lib/env';

/** Session-scoped server client. RLS applies as the signed-in user. */
export function createClient() {
  if (!supabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README.md).',
    );
  }
  const cookieStore = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by middleware instead.
        }
      },
    },
  });
}

/**
 * Cookie-less anon client for public, cacheable reads (published programmes, posts,
 * public settings). Returns null when Supabase is not configured so marketing pages
 * can still render their built-in defaults.
 */
export function createPublicClient() {
  if (!supabaseConfigured()) return null;
  return createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
