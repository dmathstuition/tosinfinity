import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import Script from 'next/script';
import { publicEnv } from '@/lib/env';
import { brandColors } from '@/lib/design-tokens';
import { ServiceWorker } from '@/components/ServiceWorker';
import { brandCss, getSiteSettings } from '@/lib/site';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'Tosinfinity Academy | Private home and online tutoring', template: '%s | Tosinfinity Academy' },
  description:
    'Private home and online tutoring in Mathematics, Science and examination preparation. Personalised learning that builds confidence.',
  applicationName: 'Tosinfinity Academy',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  openGraph: {
    type: 'website',
    siteName: 'Tosinfinity Academy',
    locale: 'en_NG',
    images: [{ url: '/icons/og.png', width: 1200, height: 630, alt: 'Tosinfinity Academy' }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: brandColors.navy,
  width: 'device-width',
  initialScale: 1,
};

// Applies the saved portal theme before paint. Marketing pages pin themselves to light.
const themeScript = `try{var t=localStorage.getItem('ta-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const css = brandCss((await getSiteSettings()).brand);
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
        <ServiceWorker />
        {publicEnv.gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${publicEnv.gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${publicEnv.gaId}',{anonymize_ip:true});`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
