import type { Metadata } from 'next';
import { Logo } from '@/components/brand/Logo';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

export default function OfflinePage() {
  return (
    <main id="main" className="on-dark flex min-h-dvh flex-col items-center justify-center bg-navy px-6 text-center">
      <Logo tone="dark" variant="emblem" size={72} />
      <h1 className="mt-6 text-3xl font-semibold">You are offline</h1>
      <p className="mt-2 max-w-sm text-muted">
        Tosinfinity Academy needs an internet connection to show your classes and records. Please reconnect and try again.
      </p>
    </main>
  );
}
