import 'server-only';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type Child = { id: string; full_name: string; student_code: string | null; school_year: string | null };

/**
 * Parent context. The list of children comes from verified links that RLS lets this
 * parent read. A `child` value from the URL is honoured only if it is in that list;
 * anything else falls back to the first child. (Even a forged ID would return no
 * data, because every query is also filtered by RLS in the database.)
 */
export async function parentContext(requestedChild?: string) {
  const profile = await requireRole('parent');
  const supabase = createClient();
  const { data } = await supabase
    .from('parent_student_links')
    .select('student:profiles!parent_student_links_student_id_fkey(id, full_name, student_code, school_year)')
    .eq('parent_id', profile.id)
    .not('verified_at', 'is', null);
  const children: Child[] = (data ?? [])
    .map((l) => (Array.isArray(l.student) ? l.student[0] : l.student))
    .filter((c): c is Child => Boolean(c))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const child = children.find((c) => c.id === requestedChild) ?? children[0] ?? null;
  return { profile, supabase, children, child };
}

export async function studentContext() {
  const profile = await requireRole('student');
  return { profile, supabase: createClient() };
}

export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
