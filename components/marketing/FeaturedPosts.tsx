import { PostCard } from '@/components/marketing/PostCard';
import { Section } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { getPublishedPosts } from '@/lib/blog';

/** Homepage strip. Renders nothing until the Owner features at least one article. */
export async function FeaturedPosts() {
  const posts = (await getPublishedPosts()).filter((p) => p.featured).slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <Section id="articles" eyebrow="From the blog" title="Learning tips and guidance">
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
      <div className="mt-6">
        <ButtonLink href="/blog" variant="outline">All articles</ButtonLink>
      </div>
    </Section>
  );
}
