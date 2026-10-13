import { Logo } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main id="main" data-theme="light" className="flex min-h-dvh flex-col items-center justify-center bg-cloud px-6 text-center">
      <Logo size={48} />
      <h1 className="mt-8 text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">The page you are looking for does not exist or has moved.</p>
      <div className="mt-6"><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></div>
    </main>
  );
}
