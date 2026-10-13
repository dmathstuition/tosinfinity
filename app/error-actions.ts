'use server';

import { captureException } from '@/lib/monitoring';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

/** Called by the error boundary. Only Next.js's opaque error digest is accepted from the browser. */
export async function reportErrorDigest(digest: string, area: string) {
  if (!/^[a-zA-Z0-9]{1,64}$/.test(digest ?? '') || !/^[a-z-]{1,20}$/.test(area ?? '')) return;
  if (!(await rateLimit('error-report', clientIp(), 10, 600))) return;
  await captureException(new Error(`Rendered error boundary (digest ${digest})`), `boundary:${area}`);
}
