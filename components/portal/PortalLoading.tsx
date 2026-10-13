/** Skeleton shown while a portal page loads. Fixed heights avoid layout shift. */
export function PortalLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-line" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-line" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-card bg-line" />)}
      </div>
      <div className="mt-6 h-64 rounded-card bg-line" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
