/**
 * Environment access. Public vars are read eagerly; server secrets are read at the
 * point of use via `requireEnv`, which throws a clear message naming the variable.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  gaId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '',
};

export function supabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable ${name}. See .env.example and README.md.`);
  }
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
