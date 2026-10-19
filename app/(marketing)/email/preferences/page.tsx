import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/sections';
import { createClient } from '@/lib/supabase/server';
import { PreferencesForm } from './PreferencesForm';

export const metadata: Metadata = { title: 'Email preferences', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Opened from the link at the foot of optional emails. No sign-in needed; the token is the key. */
export default async function EmailPreferencesPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? '';
  const { data } = UUID.test(token) ? await createClient().rpc('get_email_preferences', { p_token: token }) : { data: null };
  const row = (Array.isArray(data) ? data[0] : data) as { email: string; reminders: boolean; updates: boolean; reports: boolean } | undefined;
  return (
    <>
      <PageHero eyebrow="Your inbox" title="Email preferences" />
      <div className="container-page max-w-xl py-12">
        <section className="card p-6">
          {row ? (
            <>
              <p className="mb-4 text-sm text-muted">For <span className="font-semibold text-ink">{row.email}</span></p>
              <PreferencesForm token={token} current={row} />
            </>
          ) : (
            <p>This link is not valid or has expired. Use the link in a recent email, or sign in and change your preferences under Account.</p>
          )}
        </section>
      </div>
    </>
  );
}
