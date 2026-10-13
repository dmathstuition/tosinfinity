import type { Metadata } from 'next';
import Link from 'next/link';
import clsx from 'clsx';
import { PostCard } from '@/components/marketing/PostCard';
import { PageHero } from '@/components/marketing/sections';
import { EmptyState } from '@/components/ui/primitives';
import { getPublishedPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Study tips, examination guidance and learning advice from Tosinfinity Academy.',
  alternates: { canonical: '/blog' },
};

const PAGE_SIZE = 9;

export default async function BlogPage({ searchParams }: { searchParams: { q?: string; category?: string; page?: string } }) {
  const all = await getPublishedPosts();
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 80);
  const category = searchParams.category ?? '';
  const categories = [...new Set(all.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort();

  const filtered = all.filter(
    (p) =>
      (!category || p.category === category) &&
      (!q || [p.title, p.excerpt, ...p.tags].some((t) => t.toLowerCase().includes(q))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(searchParams.page) || 1));
  const posts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const href = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: q || undefined, category: category || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/blog?${s}` : '/blog';
  };

  return (
    <>
      <PageHero eyebrow="Blog" title="Learning tips and guidance" intro="Practical advice for students and parents." />
      <div className="container-page py-12">
        <form role="search" action="/blog" className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="blog-q" className="sr-only">Search articles</label>
          <input id="blog-q" name="q" type="search" defaultValue={q} placeholder="Search articles" className="field sm:max-w-sm" />
          {category && <input type="hidden" name="category" value={category} />}
          <button type="submit" className="min-h-[44px] rounded-xl bg-royal px-5 font-semibold text-white hover:bg-navy">Search</button>
        </form>

        {categories.length > 0 && (
          <nav aria-label="Categories" className="mt-5 flex flex-wrap gap-2">
            {['', ...categories].map((c) => (
              <Link
                key={c || 'all'}
                href={href({ category: c || undefined, page: undefined })}
                aria-current={category === c ? 'page' : undefined}
                className={clsx(
                  'rounded-full border px-4 py-2 text-sm font-medium',
                  category === c ? 'border-royal bg-royal text-white' : 'border-line bg-surface text-ink hover:border-royal',
                )}
              >
                {c || 'All'}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-8">
          {posts.length === 0 ? (
            <EmptyState title={all.length === 0 ? 'Articles are coming soon' : 'No articles match your search'}>
              {all.length === 0 ? 'Please check back shortly.' : 'Try a different search term or category.'}
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => <PostCard key={p.slug} post={p} />)}
            </div>
          )}
        </div>

        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
            {page > 1 ? <Link className="font-semibold text-link hover:underline" href={href({ page: String(page - 1) })}>Previous</Link> : <span className="text-muted">Previous</span>}
            <span>Page {page} of {pages}</span>
            {page < pages ? <Link className="font-semibold text-link hover:underline" href={href({ page: String(page + 1) })}>Next</Link> : <span className="text-muted">Next</span>}
          </nav>
        )}
      </div>
    </>
  );
}
