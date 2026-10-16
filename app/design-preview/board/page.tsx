import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BoardPreview } from './BoardPreview';

export const metadata: Metadata = { title: 'Board preview', robots: { index: false, follow: false } };

/** DEVELOPMENT ONLY. Draws sample board pages with every tool, without a database. 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="container-page space-y-6 py-10">
      <h1 className="text-2xl font-semibold">Class board preview</h1>
      <BoardPreview />
    </main>
  );
}
