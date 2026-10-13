import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/owner', '/portal', '/parent', '/guardian', '/api', '/login', '/auth', '/set-password'] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
