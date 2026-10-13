'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { BLOG_TAG } from '@/lib/blog';
import { emailConfigured, sendEmail } from '@/lib/email';
import { academyLocale, type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { zonedToUtc } from '@/lib/time';

const schema = z.object({
  title: z.string().trim().min(3, 'Give the article a title').max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'The web address may contain only lowercase letters, numbers and hyphens').max(120),
  excerpt: z.string().trim().max(400),
  body_md: z.string().max(60000),
  category: z.string().trim().max(60),
  layout: z.enum(['standard', 'wide', 'minimal']),
  accent: z.enum(['royal', 'navy', 'gold', 'orange']),
  seo_title: z.string().trim().max(120),
  seo_description: z.string().trim().max(300),
});

function slugify(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

function refresh() {
  revalidateTag(BLOG_TAG);
  revalidatePath('/blog');
  revalidatePath('/');
}

export async function createPostAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const title = str(fd, 'title', 160);
  if (title.length < 3) return fail('Give the article a title.');
  const base = slugify(title) || 'article';
  // Find a free web address: title, title-2, title-3, …
  const { data: taken } = await supabase.from('blog_posts').select('slug').like('slug', `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  const { data, error } = await supabase.from('blog_posts').insert({ title, slug }).select('id').single();
  if (error) return fail('Could not create the article.');
  redirect(`/owner/blog/${data.id}`);
}

export async function savePostAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { timezone } = await academyLocale();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown article.');
  const parsed = schema.safeParse({
    title: str(fd, 'title', 200), slug: str(fd, 'slug', 200), excerpt: str(fd, 'excerpt', 500), body_md: String(fd.get('body_md') ?? ''),
    category: str(fd, 'category', 80), layout: str(fd, 'layout'), accent: str(fd, 'accent'),
    seo_title: str(fd, 'seo_title', 200), seo_description: str(fd, 'seo_description', 400),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const d = parsed.data;
  const intent = str(fd, 'intent'); // save | publish | unpublish
  const { data: before } = await supabase.from('blog_posts').select('status, publish_at, cover_path').eq('id', id).maybeSingle();
  if (!before) return fail('Unknown article.');

  const scheduleLocal = str(fd, 'publish_local');
  const scheduled = scheduleLocal ? zonedToUtc(scheduleLocal, timezone) : null;
  if (scheduleLocal && !scheduled) return fail('Enter a valid publication date and time.');

  let status = before.status;
  let publishAt: string | null = before.publish_at;
  if (intent === 'publish') {
    if (d.body_md.trim().length < 20) return fail('Write the article before publishing.');
    status = 'published';
    // A future time schedules the article: RLS hides it from the public until then.
    publishAt = scheduled && scheduled > new Date() ? scheduled.toISOString() : (before.status === 'published' && before.publish_at) || new Date().toISOString();
  } else if (intent === 'unpublish') {
    status = 'draft';
    publishAt = null;
  }

  const cover = str(fd, 'cover_path', 500);
  const { error } = await supabase
    .from('blog_posts')
    .update({
      title: d.title, slug: d.slug, excerpt: d.excerpt, body_md: d.body_md, category: d.category || null,
      tags: str(fd, 'tags', 300).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
      layout: d.layout, accent: d.accent, featured: fd.get('featured') === 'on',
      seo_title: d.seo_title || null, seo_description: d.seo_description || null,
      cover_path: fd.get('remove_cover') === 'on' ? null : cover || before.cover_path,
      status, publish_at: publishAt,
    })
    .eq('id', id);
  if (error) return fail(error.code === '23505' ? 'Another article already uses that web address.' : 'Could not save the article.');
  if (intent === 'publish' || intent === 'unpublish') await audit(`blog.${intent}`, 'blog_post', id);
  refresh();
  revalidatePath(`/owner/blog/${id}`);
  if (intent === 'publish') return ok(publishAt && new Date(publishAt) > new Date() ? 'Scheduled. It will appear on the website at the chosen time.' : 'Published on the website.');
  if (intent === 'unpublish') return ok('Unpublished. It is a draft again.');
  return ok('Draft saved.');
}

export async function deletePostAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown article.');
  const { data: post } = await supabase.from('blog_posts').select('cover_path').eq('id', id).maybeSingle();
  if (post?.cover_path) await supabase.storage.from('blog').remove([post.cover_path]);
  await supabase.from('blog_posts').delete().eq('id', id);
  await audit('blog.deleted', 'blog_post', id);
  refresh();
  redirect('/owner/blog');
}

/**
 * Email verified subscribers about a published article. Sent once per article, in
 * batches with a pause between them to respect the provider's rate limit.
 * Unsubscribed and unverified addresses are never contacted.
 */
export async function notifySubscribersAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown article.');
  if (!emailConfigured()) return fail('Email is not configured, so subscribers cannot be notified. See README.md.');
  const { data: post } = await supabase.from('blog_posts').select('title, excerpt, slug, status, publish_at, subscribers_notified_at').eq('id', id).maybeSingle();
  if (!post || post.status !== 'published' || (post.publish_at && new Date(post.publish_at) > new Date())) return fail('Publish the article first.');
  if (post.subscribers_notified_at) return fail('Subscribers have already been notified about this article.');

  // Claim first, so a double-click or retry cannot send the newsletter twice.
  const { data: claimed } = await supabase.from('blog_posts').update({ subscribers_notified_at: new Date().toISOString() }).eq('id', id).is('subscribers_notified_at', null).select('id');
  if (!claimed?.length) return fail('Subscribers have already been notified about this article.');

  const { data: subscribers } = await supabase.from('blog_subscribers').select('email, token').eq('status', 'verified').limit(2000);
  let sent = 0;
  const list = subscribers ?? [];
  for (let i = 0; i < list.length; i += 8) {
    const results = await Promise.all(list.slice(i, i + 8).map((s) => sendEmail('blogPublished', s.email, { title: post.title, excerpt: post.excerpt, slug: post.slug, unsubscribeToken: s.token })));
    sent += results.filter((r) => r.ok).length;
    if (i + 8 < list.length) await new Promise((res) => setTimeout(res, 1100));
  }
  await audit('blog.subscribers_notified', 'blog_post', id, { sent, total: list.length });
  revalidatePath(`/owner/blog/${id}`);
  return ok(list.length ? `Sent to ${sent} of ${list.length} verified subscriber${list.length === 1 ? '' : 's'}.` : 'There are no verified subscribers yet.');
}
