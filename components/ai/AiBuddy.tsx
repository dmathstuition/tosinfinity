import clsx from 'clsx';

/**
 * The study assistant's face: a green orb with headphones and a chat-bubble face.
 * Pure SVG, so it is sharp at any size and needs no image files. Decorative.
 */
export function AiBuddy({ size = 96, className, listening = false }: { size?: number; className?: string; listening?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className={clsx('shrink-0', listening && 'animate-[pulse_1.6s_ease-in-out_infinite]', className)}>
      <defs>
        <radialGradient id="buddy-body" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#d9f99d" />
          <stop offset="45%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#3f8f1c" />
        </radialGradient>
        <linearGradient id="buddy-cup" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#2f6e15" />
        </linearGradient>
        <filter id="buddy-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#16351a" floodOpacity="0.25" />
        </filter>
      </defs>
      {/* headband */}
      <path d="M22 58 C22 22, 98 22, 98 58" fill="none" stroke="url(#buddy-cup)" strokeWidth="7" strokeLinecap="round" />
      <g filter="url(#buddy-shadow)">
        <circle cx="60" cy="64" r="40" fill="url(#buddy-body)" />
      </g>
      {/* ear cups */}
      <rect x="10" y="50" width="16" height="28" rx="8" fill="url(#buddy-cup)" />
      <rect x="94" y="50" width="16" height="28" rx="8" fill="url(#buddy-cup)" />
      {/* chat-bubble face */}
      <path d="M38 50 h44 a10 10 0 0 1 10 10 v12 a10 10 0 0 1 -10 10 h-22 l-9 8 v-8 h-13 a10 10 0 0 1 -10 -10 v-12 a10 10 0 0 1 10 -10 z" fill="#f7fee7" />
      <ellipse cx="50" cy="64" rx="4.5" ry="5.5" fill="#16351a" />
      <ellipse cx="70" cy="64" rx="4.5" ry="5.5" fill="#16351a" />
      <path d="M54 73 q6 5 12 0" fill="none" stroke="#16351a" strokeWidth="3" strokeLinecap="round" />
      {/* highlight */}
      <ellipse cx="42" cy="38" rx="9" ry="5" fill="#ffffff" opacity="0.45" transform="rotate(-25 42 38)" />
    </svg>
  );
}

/** Voice waveform bars either side of the assistant. Animated while `active`. */
export function Waveform({ bars = 9, active = false, className }: { bars?: number; active?: boolean; className?: string }) {
  const heights = Array.from({ length: bars }, (_, i) => {
    const mid = (bars - 1) / 2;
    return 22 + Math.round(70 * (1 - Math.abs(i - mid) / (mid + 1)) * (i % 2 ? 0.6 : 1));
  });
  return (
    <span aria-hidden="true" className={clsx('flex h-16 items-center gap-1', className)}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={clsx('w-1.5 rounded-full bg-gradient-to-b from-gold to-orange', active && 'animate-[wave_1s_ease-in-out_infinite]')}
          style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </span>
  );
}
