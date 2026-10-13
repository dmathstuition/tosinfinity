import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/primitives';
import { type BlogPost, coverUrl, postDate } from '@/lib/blog';

const ACCENT: Record<BlogPost['accent'], string> = {
  royal: 'from-royal to-navy',
  navy: 'from-navy to-royal',
  gold: 'from-gold to-orange',
  orange: 'from-orange to-ember',
};

export function PostCard({ post }: { post: BlogPost }) {
  const cover = coverUrl(post.cover_path);
  return (
    <Link href={`/blog/${post.slug}`} className="card group flex h-full flex-col overflow-hidden p-0 hover:border-royal">
      <div className={`relative aspect-[16/9] bg-gradient-to-br ${ACCENT[post.accent]}`}>
        {cover && <Image src={cover} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {post.category && <Badge tone="blue">{post.category}</Badge>}
          <time>{postDate(post)}</time>
        </div>
        <h3 className="mt-3 text-lg font-semibold group-hover:underline">{post.title}</h3>
        <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{post.excerpt}</p>
      </div>
    </Link>
  );
}
