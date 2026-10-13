'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-fetches the current page's server data every few seconds while the tab is
 * visible, so quick checks, questions and confirmations appear without a manual
 * reload. It pauses in background tabs and never interrupts what someone is typing
 * (router.refresh keeps client state and focus).
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, Math.max(5, seconds) * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
