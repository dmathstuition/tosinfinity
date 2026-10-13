import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/lib/blog';
import { publicEnv } from '@/lib/env';
import { getProgrammes } from '@/lib/programmes';

const STATIC = ['', '/about', '/subjects', '/examination-preparation', '/how-it-works', '/pricing', '/contact', '/blog', '/faq', '/apply', '/privacy', '/terms', '/refund-policy'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [programmes, posts] = await Promise.all([getProgrammes(), getPublishedPosts()]);
  const base = publicEnv.siteUrl;
  return [
    ...STATIC.map((p) => ({ url: `${base}${p}`, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : 0.7 })),
    ...programmes.map((p) => ({ url: `${base}/subjects/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.publish_at ?? p.created_at, priority: 0.5 })),
  ];
}
