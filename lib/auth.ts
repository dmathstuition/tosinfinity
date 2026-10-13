import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

export type Role = 'owner' | 'student' | 'parent';

export type SessionProfile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  student_code: string | null;
};

export const ROLE_HOME: Record<Role, string> = {
  owner: '/owner',
  student: '/portal',
  parent: '/parent',
};

/** Verified with the auth server (getUser), never trusted from the cookie alone. */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, student_code, status')
    .eq('id', user.id)
    .maybeSingle();
  if (!data || data.status !== 'active') return null;
  return {
    id: data.id,
    role: data.role as Role,
    full_name: data.full_name,
    email: data.email,
    student_code: data.student_code,
  };
});

/** Use at the top of every private layout, page and server action. */
export async function requireRole(role: Role): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}

/**
 * Owner accounts with TOTP enrolled must hold an aal2 session.
 * Returns true when a second-factor challenge is still required.
 */
export async function ownerNeedsMfa(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
}

export async function requireOwner(): Promise<SessionProfile> {
  const profile = await requireRole('owner');
  if (await ownerNeedsMfa()) redirect('/login/mfa');
  return profile;
}
