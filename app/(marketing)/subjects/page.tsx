import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { CtaBand, PageHero, ProgrammeCard, ProgrammeGroups } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/Button';
import { CATEGORY_LABEL, type Programme } from '@/lib/programmes';
import { getProgrammes } from '@/lib/programmes';
import { getSiteSettings } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Subjects and Programmes',
  description: 'Mathematics, Physics, Chemistry, Biology and examination preparation for WAEC, IGCSE and UTME topics.',
  alternates: { canonical: '/subjects' },
};

/** Words in the search that all appear somewhere in the programme's text. */
function matches(p: Programme, q: string): boolean {
  const text = `${p.title} ${p.summary} ${p.description} ${p.level ?? ''} ${CATEGORY_LABEL[p.category]}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.includes(w.replace(/[^a-z0-9]/g, '')));
}

export default async function SubjectsPage({ searchParams }: { searchParams: { q?: string } }) {
  const [programmes, { academy }] = await Promise.all([getProgrammes(), getSiteSettings()]);
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const found = q ? programmes.filter((p) => matches(p, q)) : [];
  return (
    <>
      <PageHero
        eyebrow="Subjects and programmes"
        title="Find the right programme"
        intro="Every programme is available as home tutoring or online tutoring."
      >
        <form action="/subjects" method="get" role="search" className="flex w-full max-w-lg items-center gap-2 rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <Search size={18} aria-hidden="true" className="ml-2 shrink-0 text-muted" />
          <label htmlFor="subjects-q" className="sr-only">Search programmes</label>
          <input id="subjects-q" name="q" type="search" defaultValue={q} placeholder="Search, e.g. Physics, WAEC, JSS" className="min-h-[44px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70" />
          <button type="submit" className="min-h-[44px] shrink-0 rounded-lg bg-royal px-5 text-sm font-semibold text-white hover:bg-[#2a22d6]">Search</button>
        </form>
      </PageHero>
      <div className="container-page py-14">
        {q ? (
          <section aria-labelledby="results-h">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 id="results-h" className="text-xl font-semibold">{found.length} programme{found.length === 1 ? '' : 's'} for “{q}”</h2>
              <Link href="/subjects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-link hover:underline"><X size={16} aria-hidden="true" /> Show all</Link>
            </div>
            {found.length ? (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {found.map((p) => <li key={p.slug}><ProgrammeCard programme={p} /></li>)}
              </ul>
            ) : (
              <div className="card p-8 text-center">
                <p className="font-semibold">No programme matches that search.</p>
                <p className="mt-1 text-muted">Try a subject such as Mathematics or Physics, or ask us directly.</p>
                <div className="mt-5 flex justify-center gap-3"><ButtonLink href="/subjects" variant="outline">See all programmes</ButtonLink><ButtonLink href="/contact">Contact us</ButtonLink></div>
              </div>
            )}
          </section>
        ) : (
          <ProgrammeGroups programmes={programmes} />
        )}
      </div>
      <CtaBand academy={academy} />
    </>
  );
}
