/**
 * Environment access. Public vars are read eagerly; server secrets are read at the
 * point of use via `requireEnv`, which throws a clear message naming the variable.
 */
/**
 * The site's own address as a full origin. Tolerates the common mistakes of leaving
 * off "https://" or adding a trailing slash or path, and never throws: an unusable
 * value falls back to localhost so a build cannot fail on it.
 */
export function normaliseSiteUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:3000';
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  const withScheme = /^https?:\/\//i.test(value) ? value : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(value) ? 'http' : 'https'}://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
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
