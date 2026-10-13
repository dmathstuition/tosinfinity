import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicEnv } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/server';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_md: string;
  cover_path: string | null;
  category: string | null;
  tags: string[];
  layout: 'standard' | 'wide' | 'minimal';
  accent: 'royal' | 'navy' | 'gold' | 'orange';
  featured: boolean;
  publish_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
};

export const BLOG_TAG = 'blog';
const COLUMNS =
  'id, slug, title, excerpt, body_md, cover_path, category, tags, layout, accent, featured, publish_at, seo_title, seo_description, created_at';

/** RLS returns only published posts whose publish time has passed. */
export const getPublishedPosts = unstable_cache(
  async (): Promise<BlogPost[]> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data } = await supabase
      .from('blog_posts')
      .select(COLUMNS)
      .eq('status', 'published')
      .order('publish_at', { ascending: false, nullsFirst: false });
    return (data ?? []) as BlogPost[];
  },
  ['blog-posts'],
  { tags: [BLOG_TAG], revalidate: 120 },
);

export async function getPost(slug: string): Promise<BlogPost | null> {
  return (await getPublishedPosts()).find((p) => p.slug === slug) ?? null;
}

export function coverUrl(path: string | null): string | null {
  if (!path || !publicEnv.supabaseUrl) return null;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/blog/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function postDate(p: Pick<BlogPost, 'publish_at' | 'created_at'>): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(new Date(p.publish_at ?? p.created_at));
}
