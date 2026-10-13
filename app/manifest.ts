import type { MetadataRoute } from 'next';
import { brandColors } from '@/lib/design-tokens';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tosinfinity Academy',
    short_name: 'Tosinfinity',
    description: 'Private home and online tutoring: classes, assignments, progress and invoices.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    background_color: brandColors.navy,
    theme_color: brandColors.navy,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
