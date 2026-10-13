'use client';

import { useEffect } from 'react';
import { reportErrorDigest } from '@/app/error-actions';
import { Button } from '@/components/ui/Button';

/** Shown when a page fails. Internal details are never displayed. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (error.digest) void reportErrorDigest(error.digest, 'page');
  }, [error.digest]);
  return (
    <main id="main" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">The page could not be shown. Please try again. If it keeps happening, contact the academy.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6"><Button onClick={reset} variant="secondary">Try again</Button></div>
    </main>
  );
}
