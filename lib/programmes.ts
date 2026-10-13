import 'server-only';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';

export type ProgrammeCategory = 'mathematics' | 'science' | 'exam_prep';

export type Programme = {
  id: string;
  slug: string;
  category: ProgrammeCategory;
  title: string;
  summary: string;
  description: string;
  level: string | null;
  sort_order: number;
};

export const CATEGORY_LABEL: Record<ProgrammeCategory, string> = {
  mathematics: 'Mathematics',
  science: 'Science',
  exam_prep: 'Examination preparation',
};

export const PROGRAMMES_TAG = 'programmes';

/** Mirrors the database seed so the site renders before Supabase is connected. */
const FALLBACK: Programme[] = (
  [
    ['primary-mathematics', 'mathematics', 'Primary Mathematics', 'Years 5–6', 'Number sense, fractions, problem solving and confident foundations for upper primary learners.'],
    ['junior-secondary-mathematics', 'mathematics', 'Junior Secondary Mathematics', 'JSS1–JSS3', 'Algebra, geometry and reasoning skills built step by step through junior secondary.'],
    ['senior-secondary-mathematics', 'mathematics', 'Senior Secondary Mathematics', 'SS1–SS3', 'Structured coverage of the senior secondary syllabus with regular practice and review.'],
    ['igcse-mathematics', 'mathematics', 'IGCSE Mathematics', 'IGCSE', 'Syllabus-aligned teaching and past-paper practice for IGCSE Mathematics.'],
    ['sat-mathematics-foundation', 'mathematics', 'SAT Mathematics Foundation', 'SAT', 'Core SAT Math concepts, question strategies and timed practice.'],
    ['further-mathematics', 'mathematics', 'Further Mathematics', 'Senior secondary', 'Advanced topics for learners who want to go beyond the core syllabus.'],
    ['physics', 'science', 'Physics', null, 'Concepts, calculations and practical understanding explained clearly.'],
    ['chemistry', 'science', 'Chemistry', null, 'From atomic structure to reactions and calculations, taught for understanding.'],
    ['biology', 'science', 'Biology', null, 'Living systems explained with clear diagrams, recall practice and exam technique.'],
    ['waec', 'exam_prep', 'WAEC Preparation', 'WAEC', 'Targeted revision, past questions and exam technique for WAEC candidates.'],
    ['igcse', 'exam_prep', 'IGCSE Preparation', 'IGCSE', 'Past-paper driven preparation matched to the IGCSE assessment style.'],
    ['utme-selected-topics', 'exam_prep', 'UTME Selected Topics', 'UTME', 'Focused support on selected UTME topics where learners need the most help.'],
  ] as const
).map(([slug, category, title, level, summary], i) => ({
  id: slug,
  slug,
  category,
  title,
  level,
  summary,
  description: '',
  sort_order: i,
}));

export const getProgrammes = unstable_cache(
  async (): Promise<Programme[]> => {
    const supabase = createPublicClient();
    if (!supabase) return FALLBACK;
    const { data, error } = await supabase
      .from('programmes')
      .select('id, slug, category, title, summary, description, level, sort_order')
      .eq('is_published', true)
      .order('sort_order');
    if (error || !data) return FALLBACK;
    return data as Programme[];
  },
  ['programmes'],
  { tags: [PROGRAMMES_TAG], revalidate: 300 },
);

export async function getProgramme(slug: string): Promise<Programme | null> {
  return (await getProgrammes()).find((p) => p.slug === slug) ?? null;
}
