import Link from 'next/link';
import clsx from 'clsx';
import { EmptyState } from '@/components/ui/primitives';
import type { Child } from '@/lib/family';

/** Child selector for parents with more than one linked child. Hidden when there is only one. */
export function ChildSwitcher({ childList, current, path }: { childList: Child[]; current: Child; path: string }) {
  if (childList.length < 2) {
    return <p className="mb-5 text-sm text-muted">Showing {current.full_name}{current.school_year ? ` · ${current.school_year}` : ''}</p>;
  }
  return (
    <nav aria-label="Choose a child" className="mb-5 flex flex-wrap gap-2">
      {childList.map((c) => (
        <Link
          key={c.id}
          href={`${path}?child=${c.id}`}
          aria-current={c.id === current.id ? 'true' : undefined}
          className={clsx(
            'min-h-[40px] rounded-full border px-4 py-2 text-sm font-medium',
            c.id === current.id ? 'border-royal bg-royal text-white' : 'border-line bg-surface text-ink hover:border-royal',
          )}
        >
          {c.full_name}
        </Link>
      ))}
    </nav>
  );
}

export function NoChildren() {
  return (
    <EmptyState title="No child is linked to your account yet">
      The academy links a parent account to a learner after confirming the relationship. Please send a message if you expected to see your child here.
    </EmptyState>
  );
}
