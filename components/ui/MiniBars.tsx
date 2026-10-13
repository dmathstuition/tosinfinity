/**
 * Small bar chart built from plain elements (no chart library). It is drawn only
 * from the values passed in, which come from real records. The picture itself is
 * hidden from assistive technology; a text list with every value is provided instead.
 */
export function MiniBars({
  data, label, format = (n) => String(n), highlight, emptyText = 'No data yet.',
}: {
  data: Array<{ label: string; value: number }>;
  /** What the chart shows, e.g. "Classes per day this week". */
  label: string;
  format?: (n: number) => string;
  /** Index of the bar to emphasise (for example, today). */
  highlight?: number;
  emptyText?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (max === 0) return <p className="py-8 text-center text-sm text-ink/60">{emptyText}</p>;
  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div aria-hidden="true" className="flex h-32 items-end gap-2">
        {data.map((d, i) => (
          <div key={d.label + i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[0.65rem] font-semibold tabular-nums text-ink/70">{d.value ? format(d.value) : ''}</span>
            <div
              className={`w-full max-w-[2.25rem] rounded-t-lg rounded-b-sm ${i === highlight ? 'bg-brand-cta' : 'bg-royal/70'}`}
              style={{ height: `${Math.max(d.value ? 6 : 2, (d.value / max) * 78)}%` }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-2 flex gap-2 border-t border-ink/10 pt-2">
        {data.map((d, i) => (
          <span key={d.label + i} className={`min-w-0 flex-1 truncate text-center text-[0.7rem] ${i === highlight ? 'font-bold text-ink' : 'text-ink/60'}`}>{d.label}</span>
        ))}
      </div>
      <ul className="sr-only">
        {data.map((d, i) => <li key={d.label + i}>{d.label}: {format(d.value)}</li>)}
      </ul>
    </figure>
  );
}

/** Circular progress for a single percentage. */
export function Ring({ percent, label, size = 96 }: { percent: number | null; label: string; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const p = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={percent === null ? `${label}: no data yet` : `${label}: ${Math.round(p)} percent`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-surface/70" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (p / 100) * c} className="stroke-[rgb(var(--royal))] dark:stroke-[rgb(var(--link))]" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-lg font-semibold tabular-nums" style={{ color: 'rgb(var(--heading))' }}>
        {percent === null ? '—' : `${Math.round(p)}%`}
      </span>
    </div>
  );
}
