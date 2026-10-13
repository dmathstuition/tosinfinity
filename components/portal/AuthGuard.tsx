'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Re-checks the session whenever a private page becomes visible again: on tab focus,
 * and when the browser restores the page from its back-forward cache. After sign-out
 * (in this or another tab) a stale private page is replaced by the sign-in screen
 * instead of being left on display.
 */
export function AuthGuard() {
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const check = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!cancelled && (error || !data.user)) window.location.replace('/login');
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('/login');
    });
    window.addEventListener('pageshow', onShow);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
