'use client';

import { useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FileUpload } from '@/components/portal/FileUpload';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { Markdown } from '@/lib/markdown';
import { savePostAction } from '../actions';

export type PostValues = {
  id: string; title: string; slug: string; excerpt: string; body_md: string; category: string; tags: string; layout: string; accent: string;
  featured: boolean; seo_title: string; seo_description: string; status: string; publish_local: string; cover_url: string | null;
};

function Buttons({ published }: { published: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>{pending ? 'Saving…' : published ? 'Save changes' : 'Save draft'}</Button>
      {published
        ? <Button type="submit" name="intent" value="unpublish" variant="outline" disabled={pending}>Unpublish</Button>
        : <Button type="submit" name="intent" value="publish" disabled={pending}>Publish</Button>}
    </div>
  );
}

/** Article editor with live preview. The preview uses the same safe renderer as the public site. */
export function Editor({ post, publicBase }: { post: PostValues; publicBase: string }) {
  const [state, action] = useFormState(savePostAction, null);
  const [body, setBody] = useState(post.body_md);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const area = useRef<HTMLTextAreaElement>(null);
  const published = post.status === 'published';

  // Images uploaded for the article body are inserted as Markdown at the cursor.
  const insertImage = (path: string) => {
    const snippet = `\n![Describe the image](${publicBase}/storage/v1/object/public/blog/${path})\n`;
    const el = area.current;
    const at = el ? el.selectionStart : body.length;
    setBody(body.slice(0, at) + snippet + body.slice(at));
  };

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <input type="hidden" name="id" value={post.id} />
      <div className="card grid gap-4 p-5 sm:p-6">
        <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required defaultValue={post.title} className="field" /></div>
        <div><label htmlFor="excerpt" className="label">Summary</label><textarea id="excerpt" name="excerpt" rows={2} maxLength={400} defaultValue={post.excerpt} className="field" /></div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="body_md" className="label !mb-0">Article</label>
            <div role="tablist" aria-label="Editor view" className="flex rounded-lg border border-line p-0.5 text-sm">
              {(['write', 'preview'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 capitalize ${tab === t ? 'bg-royal text-white' : ''}`}>{t}</button>
              ))}
            </div>
          </div>
          {/* The textarea stays mounted in preview so its content is always submitted. */}
          <textarea ref={area} id="body_md" name="body_md" rows={22} value={body} onChange={(e) => setBody(e.target.value)} className={`field font-mono text-sm ${tab === 'preview' ? 'hidden' : ''}`} aria-describedby="md-hint" />
          {tab === 'preview' && <div className="min-h-[20rem] rounded-xl border border-line p-4">{body.trim() ? <Markdown source={body} /> : <p className="text-muted">Nothing to preview yet.</p>}</div>}
          <p id="md-hint" className="mt-1 text-xs text-muted">Markdown: ## heading, **bold**, *italic*, - list, &gt; quote, [link](https://…). HTML is shown as text, never run.</p>
        </div>
        <FileUpload bucket="blog" folder={`posts/${post.id}`} name="inline_image" label="Insert an image into the article" onUploaded={insertImage} />
      </div>

      <div className="grid h-fit gap-6">
        <div className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">Publish</h2>
          {state && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}
          <div>
            <label htmlFor="publish_local" className="label">Schedule for later (optional)</label>
            <input id="publish_local" name="publish_local" type="datetime-local" defaultValue={post.publish_local} className="field" aria-describedby="sched-hint" />
            <p id="sched-hint" className="mt-1 text-xs text-muted">Leave empty to publish immediately. A future time keeps it hidden until then.</p>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="featured" defaultChecked={post.featured} className="h-5 w-5 accent-[rgb(var(--royal))]" />
            Feature on the homepage
          </label>
          <Buttons published={published} />
        </div>

        <div className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">Appearance</h2>
          {post.cover_url && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_url} alt="Current cover" className="aspect-[16/9] w-full rounded-xl object-cover" />
              <label className="mt-2 flex items-center gap-3 text-sm"><input type="checkbox" name="remove_cover" className="h-5 w-5 accent-[rgb(var(--royal))]" /> Remove cover image</label>
            </div>
          )}
          <FileUpload bucket="blog" folder={`covers/${post.id}`} name="cover_path" label={post.cover_url ? 'Replace cover image' : 'Cover image'} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="layout" className="label">Layout</label>
              <select id="layout" name="layout" defaultValue={post.layout} className="field"><option value="standard">Standard</option><option value="wide">Wide</option><option value="minimal">Minimal</option></select>
            </div>
            <div>
              <label htmlFor="accent" className="label">Accent colour</label>
              <select id="accent" name="accent" defaultValue={post.accent} className="field"><option value="royal">Royal blue</option><option value="navy">Navy</option><option value="gold">Gold</option><option value="orange">Orange</option></select>
            </div>
          </div>
          <div><label htmlFor="category" className="label">Category</label><input id="category" name="category" defaultValue={post.category} maxLength={60} className="field" /></div>
          <div><label htmlFor="tags" className="label">Tags (comma separated)</label><input id="tags" name="tags" defaultValue={post.tags} className="field" /></div>
        </div>

        <div className="card grid gap-4 p-5">
          <h2 className="text-lg font-semibold">Search engines</h2>
          <div><label htmlFor="slug" className="label">Web address</label><input id="slug" name="slug" required defaultValue={post.slug} className="field" aria-describedby="slug-hint" /><p id="slug-hint" className="mt-1 text-xs text-muted">/blog/{post.slug}</p></div>
          <div><label htmlFor="seo_title" className="label">Search title (optional)</label><input id="seo_title" name="seo_title" defaultValue={post.seo_title} maxLength={120} className="field" /></div>
          <div><label htmlFor="seo_description" className="label">Search description (optional)</label><textarea id="seo_description" name="seo_description" rows={2} maxLength={300} defaultValue={post.seo_description} className="field" /></div>
        </div>
      </div>
    </form>
  );
}
