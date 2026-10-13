import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { coverUrl } from '@/lib/blog';
import { publicEnv } from '@/lib/env';
import { academyLocale, isUuid, ownerContext } from '@/lib/owner';
import { formatDate, utcToZonedInput } from '@/lib/time';
import { deletePostAction, notifySubscribersAction } from '../actions';
import { Editor } from './Editor';

export const metadata = { title: 'Edit article' };

export default async function EditPostPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { timezone } = await academyLocale();
  const { data: p } = await supabase.from('blog_posts').select('*').eq('id', params.id).maybeSingle();
  if (!p) notFound();
  const live = p.status === 'published' && (!p.publish_at || new Date(p.publish_at) <= new Date());
  const scheduled = p.status === 'published' && !live;

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/owner/blog" className="text-link hover:underline">← Blog</Link></p>
      <PageHeader
        title="Edit article"
        actions={
          <>
            <Badge tone={live ? 'green' : scheduled ? 'blue' : 'neutral'}>{live ? 'Published' : scheduled ? 'Scheduled' : 'Draft'}</Badge>
            {live && <ButtonLink href={`/blog/${p.slug}`} external variant="outline" size="sm">View on website</ButtonLink>}
          </>
        }
      />
      <Editor
        publicBase={publicEnv.supabaseUrl}
        post={{
          id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, body_md: p.body_md, category: p.category ?? '', tags: (p.tags as string[]).join(', '),
          layout: p.layout, accent: p.accent, featured: p.featured, seo_title: p.seo_title ?? '', seo_description: p.seo_description ?? '', status: p.status,
          publish_local: scheduled && p.publish_at ? utcToZonedInput(p.publish_at, timezone) : '', cover_url: coverUrl(p.cover_path),
        }}
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Email subscribers</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            {p.subscribers_notified_at ? `Subscribers were notified on ${formatDate(p.subscribers_notified_at)}.` : 'Optional. Sends this article to verified newsletter subscribers, once.'}
          </p>
          {live && !p.subscribers_notified_at && (
            <ActionForm action={notifySubscribersAction} submitLabel="Notify subscribers" variant="secondary" size="sm" hidden={{ id: p.id }} confirm="Email this article to all verified subscribers?" />
          )}
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Delete</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Removes the article and its cover image permanently.</p>
          <ActionForm action={deletePostAction} submitLabel="Delete article" variant="danger" size="sm" hidden={{ id: p.id }} confirm="Delete this article permanently?" />
        </Card>
      </div>
    </>
  );
}
