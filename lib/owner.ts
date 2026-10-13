import 'server-only';
import { requireOwner } from '@/lib/auth';
import { getSiteSettings } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { ok: boolean; message: string } | null;

export const ok = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/**
 * Entry point for every Owner page and server action: verifies the session with the
 * auth server, the Owner role, and the second factor when enrolled. Queries then run
 * through the session-scoped client, so RLS still applies as a second line of defence.
 */
export async function ownerContext() {
  const profile = await requireOwner();
  const supabase = createClient();
  const audit = async (action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) => {
    const { error } = await supabase.rpc('write_audit', { p_action: action, p_entity: entity, p_entity_id: entityId, p_meta: meta });
    if (error) console.error('[audit] failed to record', action);
  };
  return { profile, supabase, audit };
}

export async function academyLocale() {
  const { locale } = await getSiteSettings();
  return locale;
}

/** Read a trimmed string from FormData, capped in length. */
export function str(formData: FormData, key: string, max = 2000): string {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Escape % and _ so user search text is matched literally in ILIKE. */
export function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')}%`;
}
