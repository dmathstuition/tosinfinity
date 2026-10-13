import Link from 'next/link';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Card, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { ownerContext } from '@/lib/owner';
import { formatDate } from '@/lib/time';
import { createPostAction } from './actions';

export const metadata = { title: 'Blog' };

export default async function BlogAdminPage() {
  const { supabase } = await ownerContext();
  const [{ data: posts }, { count: verified }, { count: pending }] = await Promise.all([
    supabase.from('blog_posts').select('id, title, slug, status, publish_at, featured, category, updated_at').order('updated_at', { ascending: false }).limit(100),
    supabase.from('blog_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
    supabase.from('blog_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader title="Blog and newsletter" description="Write, preview and publish articles on the public website." actions={<ButtonLink href="/owner/blog/subscribers" variant="outline" size="sm" external>Export subscribers (CSV)</ButtonLink>} />
      <section aria-label="Newsletter" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Verified subscribers" value={verified ?? 0} />
        <Stat label="Awaiting confirmation" value={pending ?? 0} />
        <Stat label="Articles" value={posts?.length ?? 0} />
      </section>
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">New article</h2>
        <ActionForm action={createPostAction} submitLabel="Start writing" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><label htmlFor="title" className="label">Title</label><input id="title" name="title" required maxLength={160} className="field" /></div>
        </ActionForm>
      </Card>
      {posts?.length ? (
        <ul className="card divide-y divide-line p-0">
          {posts.map((p) => {
            const scheduled = p.status === 'published' && p.publish_at && new Date(p.publish_at) > now;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/owner/blog/${p.id}`} className="font-semibold text-link hover:underline">{p.title}</Link>
                  <p className="text-sm text-muted">/blog/{p.slug}{p.category ? ` · ${p.category}` : ''} · edited {formatDate(p.updated_at)}</p>
                </div>
                <div className="flex gap-2">
                  {p.featured && <Badge tone="gold">Featured</Badge>}
                  <Badge tone={scheduled ? 'blue' : p.status === 'published' ? 'green' : 'neutral'}>{scheduled ? `Scheduled ${formatDate(p.publish_at!)}` : p.status}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title="No articles yet">Your first article will appear on the public blog once published.</EmptyState>}
    </>
  );
}
