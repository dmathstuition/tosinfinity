const isProd = process.env.NODE_ENV === 'production';
// Optional self-hosted Jitsi server whose meetings may be embedded in the lesson room.
const embedHost = (process.env.NEXT_PUBLIC_JITSI_EMBED_DOMAIN ?? '').replace(/[^a-zA-Z0-9.-]/g, '');
const embedOrigin = embedHost ? `https://${embedHost}` : '';
const media = embedOrigin ? `(self "${embedOrigin}")` : '()';
// The study assistant's voice input needs the microphone on our own pages.
const mic = embedOrigin ? `(self "${embedOrigin}")` : '(self)';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProd ? '' : "'unsafe-eval'"} https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.sentry.io",
  `frame-src 'self' https://checkout.paystack.com ${embedOrigin}`,
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: `camera=${media}, microphone=${mic}, display-capture=${media}, geolocation=()` },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const privateNoStore = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  async redirects() {
    // Family notifications use one path per topic; parents see results under Progress.
    return [
      { source: '/parent/assignments', destination: '/parent/progress', permanent: false },
      { source: '/parent/materials', destination: '/parent/progress', permanent: false },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/owner/:path*', headers: privateNoStore },
      { source: '/portal/:path*', headers: privateNoStore },
      { source: '/parent/:path*', headers: privateNoStore },
      { source: '/guardian/:path*', headers: privateNoStore },
      { source: '/api/:path*', headers: privateNoStore },
    ];
  },
};

export default nextConfig;
