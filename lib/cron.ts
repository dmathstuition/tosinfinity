import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { optionalEnv } from '@/lib/env';
import { captureException } from '@/lib/monitoring';
import { cronAuthorised } from '@/lib/security/request';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

/**
 * Wrapper for scheduled endpoints:
 *  - rejects anything without the server-only CRON_SECRET (fails closed if unset);
 *  - records every run, success or failure, in job_runs so problems are visible.
 * Each job is written to be idempotent, so a retried run cannot duplicate work.
 */
export async function runCron(
  request: Request, job: string, work: (admin: SupabaseClient) => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  if (!cronAuthorised(request, optionalEnv('CRON_SECRET'))) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!adminConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const admin = createAdminClient();
  const runKey = new Date().toISOString();
  try {
    const detail = await work(admin);
    await admin.from('job_runs').insert({ job, run_key: runKey, status: 'ok', detail });
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error(`[cron:${job}] failed: ${message}`);
    await admin.from('job_runs').insert({ job, run_key: runKey, status: 'failed', detail: { message } });
    await captureException(e, `cron:${job}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/** Claim a unit of work once. Returns false if it was already claimed (e.g. by an earlier or retried run). */
export async function claim(admin: SupabaseClient, job: string, key: string): Promise<boolean> {
  const { error } = await admin.from('job_runs').insert({ job, run_key: key });
  return !error;
}

export async function localeSettings(admin: SupabaseClient): Promise<{ timezone: string; currency: string }> {
  const { data } = await admin.from('settings').select('value').eq('key', 'locale').maybeSingle();
  const v = (data?.value ?? {}) as { timezone?: string; currency?: string };
  return { timezone: v.timezone || 'Africa/Lagos', currency: v.currency || 'NGN' };
}
