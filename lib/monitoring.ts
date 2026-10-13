import 'server-only';
import { randomUUID } from 'node:crypto';
import { optionalEnv } from '@/lib/env';

/**
 * Minimal Sentry reporter (no SDK): posts an event to the project in SENTRY_DSN.
 * Does nothing when the DSN is not set. Only an error name, message, stack and a
 * short context label are sent: never request bodies, cookies, tokens or user data.
 */
export async function captureException(error: unknown, where: string): Promise<void> {
  const dsn = optionalEnv('SENTRY_DSN');
  if (!dsn) return;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
    const eventId = randomUUID().replace(/-/g, '');
    const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() });
    const event = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tags: { where },
      exception: { values: [{ type: err.name, value: err.message.slice(0, 500), stacktrace: undefined }] },
      extra: { stack: err.stack?.split('\n').slice(0, 12).join('\n') },
    });
    await fetch(`${url.protocol}//${url.host}/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${url.username}, sentry_client=tosinfinity/1.0` },
      body: `${header}\n${JSON.stringify({ type: 'event' })}\n${event}`,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoring must never break the request it is observing.
  }
}
