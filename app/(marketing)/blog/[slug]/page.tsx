import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import clsx from 'clsx';
import { JsonLd } from '@/components/marketing/JsonLd';
import { Badge } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/Button';
import { coverUrl, getPost, postDate } from '@/lib/blog';
import { publicEnv } from '@/lib/env';
import { Markdown } from '@/lib/markdown';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return {};
  const cover = coverUrl(post.cover_path);
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.excerpt, ...(cover ? { images: [cover] } : {}) },
  };
}

const ACCENT_BAR = { royal: 'bg-royal', navy: 'bg-navy', gold: 'bg-gold', orange: 'bg-orange' } as const;
const WIDTH = { standard: 'max-w-3xl', wide: 'max-w-5xl', minimal: 'max-w-2xl' } as const;

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug);
  if (!post) notFound();
  const cover = coverUrl(post.cover_path);

  return (
    <article className={clsx('container-page py-12 sm:py-16', WIDTH[post.layout])}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publish_at ?? post.created_at,
          mainEntityOfPage: `${publicEnv.siteUrl}/blog/${post.slug}`,
          publisher: { '@type': 'EducationalOrganization', name: 'Tosinfinity Academy' },
          ...(cover ? { image: cover } : {}),
        }}
      />
      <Link href="/blog" className="text-sm font-semibold text-link hover:underline">← All articles</Link>
      <header className="mt-5">
        <div className={clsx('h-1.5 w-16 rounded-full', ACCENT_BAR[post.accent])} />
        <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <time dateTime={post.publish_at ?? post.created_at}>{postDate(post)}</time>
          {post.category && <Badge tone="blue">{post.category}</Badge>}
          {post.tags.map((t) => <Badge key={t}>{t}</Badge>)}
        </div>
        {post.layout !== 'minimal' && post.excerpt && <p className="mt-5 text-xl text-muted">{post.excerpt}</p>}
      </header>
      {cover && post.layout !== 'minimal' && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-card">
          <Image src={cover} alt="" fill priority sizes="(min-width: 1024px) 960px, 100vw" className="object-cover" />
        </div>
      )}
      <div className="mt-8 text-lg">
        <Markdown source={post.body_md} />
      </div>
      <footer className="mt-12 rounded-card bg-surface p-6 text-center shadow-card">
        <p className="font-heading text-xl font-semibold">Would your child benefit from personal tutoring?</p>
        <div className="mt-4 flex justify-center"><ButtonLink href="/apply">Apply for Tutoring</ButtonLink></div>
      </footer>
    </article>
  );
}
