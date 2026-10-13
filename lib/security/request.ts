import { timingSafeEqual } from 'node:crypto';

/**
 * CSRF check for cookie-authenticated POST route handlers (Server Actions get this
 * from Next.js automatically). The browser-set Origin must match the host being called.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Fails closed when the secret is unset. */
export function cronAuthorised(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') && safeEqual(header.slice(7), secret);
}
