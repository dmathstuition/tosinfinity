import { Header } from '@/components/marketing/Header';
import { Footer } from '@/components/marketing/Footer';

/** Public site. Pinned to the light theme so the marketing experience stays bright. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-cloud text-ink">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
