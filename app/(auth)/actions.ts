'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ROLE_HOME, type Role } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { createPasswordLink } from '@/lib/auth-links';
import { supabaseConfigured } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { ok?: boolean; message: string } | null;

const STUDENT_CODE = /^TA-\d{4}-\d{3,}$/i;
const NOT_CONFIGURED = 'Sign-in is not available yet because the site is not connected to its database.';
const BAD_LOGIN = 'Those details do not match an account. Please check and try again.';

/**
 * Resolve "email or student ID" to an email on the server. A student ID is only an
 * alternative identifier: the password is still verified by Supabase Auth.
 */
async function resolveEmail(identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (STUDENT_CODE.test(id)) {
    if (!adminConfigured()) return null;
    const { data } = await createAdminClient().rpc('email_for_student_code', { p_code: id });
    return typeof data === 'string' ? data : null;
  }
  const email = z.string().email().max(254).safeParse(id.toLowerCase());
  return email.success ? email.data : null;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!supabaseConfigured()) return { message: NOT_CONFIGURED };
  const identifier = String(formData.get('identifier') ?? '').slice(0, 254);
  const password = String(formData.get('password') ?? '');
  if (!identifier || !password) return { message: 'Enter your email or student ID and your password.' };

  const ip = clientIp();
  const allowed =
    (await rateLimit('login-ip', ip, 20, 900)) &&
    (await rateLimit('login-id', identifier.trim().toLowerCase(), 8, 900));
  if (!allowed) return { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' };

  const email = await resolveEmail(identifier);
  if (!email) return { message: BAD_LOGIN };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { message: BAD_LOGIN };

  const { data: profile } = await supabase.from('profiles').select('role, status').eq('id', data.user.id).maybeSingle();
  if (!profile || profile.status !== 'active') {
    await supabase.auth.signOut();
    return { message: 'This account is not active. Please contact the academy.' };
  }

  revalidatePath('/', 'layout');
  if (profile.role === 'owner') {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect('/login/mfa');
  }
  redirect(ROLE_HOME[profile.role as Role]);
}

export async function verifyMfaAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return { message: 'Enter the 6-digit code from your authenticator app.' };
  if (!(await rateLimit('mfa', clientIp(), 10, 900))) return { message: 'Too many attempts. Please wait and try again.' };

  const supabase = createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === 'verified');
  if (!factor) redirect('/owner');
  // Verifying on the server writes the upgraded (aal2) session into the auth cookies,
  // so every later server request sees the second factor as satisfied.
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { message: 'That code was not accepted. Please try the current code.' };
  revalidatePath('/', 'layout');
  redirect('/owner');
}

export async function signOutAction() {
  if (supabaseConfigured()) await createClient().auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function requestPasswordResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Same reply whether or not the account exists, so accounts cannot be discovered.
  const generic = { ok: true, message: 'If an account matches those details, a password link has been sent to its email address.' };
  if (!supabaseConfigured() || !adminConfigured()) return { message: 'Password recovery is not available yet. Please contact the academy.' };
  const identifier = String(formData.get('identifier') ?? '').slice(0, 254);
  if (!identifier) return { message: 'Enter your email or student ID.' };
  if (!(await rateLimit('reset-ip', clientIp(), 5, 3600)) || !(await rateLimit('reset-id', identifier.trim().toLowerCase(), 3, 3600))) {
    return { message: 'Too many requests. Please try again later.' };
  }
  const email = await resolveEmail(identifier);
  if (!email) return generic;
  const link = await createPasswordLink(email);
  if (link) await sendEmail('passwordRecovery', email, { link });
  return generic;
}

const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(72, 'Use no more than 72 characters.')
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number.');

export async function setPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? 'Choose a stronger password.' };
  if (password !== confirm) return { message: 'The two passwords do not match.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { message: 'This link has expired. Please request a new one from “Forgot password”.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { message: 'We could not save that password. Please choose a different one.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  revalidatePath('/', 'layout');
  redirect(profile ? ROLE_HOME[profile.role as Role] : '/login');
}

/** Exchanges a single-use activation/recovery token for a session. Runs on a button
 *  press (POST), so link scanners that merely open the URL cannot consume the token. */
export async function confirmLinkAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const tokenHash = String(formData.get('token_hash') ?? '');
  if (!supabaseConfigured() || !/^[A-Za-z0-9_-]{16,200}$/.test(tokenHash)) redirect('/login?error=link');
  if (!(await rateLimit('confirm-link', clientIp(), 20, 900))) return { message: 'Too many attempts. Please wait and try again.' };
  const { error } = await createClient().auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
  if (error) redirect('/login?error=link');
  redirect('/set-password');
}
