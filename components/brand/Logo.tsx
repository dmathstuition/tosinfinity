import Image from 'next/image';
import clsx from 'clsx';

/**
 * Tosinfinity Academy logo, built from the supplied artwork
 * (public/brand/emblem.png and wordmark-*.png, extracted from logo-original.jpeg).
 * To update the brand, replace those files; proportions below match the originals.
 *
 * - variant "full": emblem + wordmark;  "emblem": cap-and-infinity only.
 * - tone "light": for light backgrounds. The emblem's infinity is white, so it sits on
 *   a navy tile to stay visible, with the navy wordmark.
 * - tone "dark": for navy/dark backgrounds: bare emblem with the white wordmark.
 */
const EMBLEM = { w: 410, h: 157 };
const WORDMARK = { w: 410, h: 79 };

type Props = {
  variant?: 'full' | 'emblem';
  tone?: 'light' | 'dark';
  /** Emblem height in pixels; everything else scales from it. */
  size?: number;
  className?: string;
  priority?: boolean;
};

export function Logo({ variant = 'full', tone = 'light', size = 40, className, priority }: Props) {
  const emblemH = tone === 'light' ? Math.round(size * 0.62) : size;
  const emblemW = Math.round((emblemH * EMBLEM.w) / EMBLEM.h);
  const wordH = Math.round(size * 0.6);
  const wordW = Math.round((wordH * WORDMARK.w) / WORDMARK.h);

  const emblem = (
    <Image
      src="/brand/emblem.png"
      alt={variant === 'emblem' ? 'Tosinfinity Academy' : ''}
      width={emblemW}
      height={emblemH}
      priority={priority}
    />
  );

  return (
    <span className={clsx('inline-flex shrink-0 items-center gap-2.5', className)}>
      {tone === 'light' ? (
        <span
          className="inline-flex items-center justify-center rounded-xl bg-navy"
          style={{ height: size, paddingInline: Math.round(size * 0.16) }}
        >
          {emblem}
        </span>
      ) : (
        emblem
      )}
      {variant === 'full' && (
        <Image
          src={tone === 'light' ? '/brand/wordmark-navy.png' : '/brand/wordmark-white.png'}
          alt="Tosinfinity Academy"
          width={wordW}
          height={wordH}
          priority={priority}
        />
      )}
    </span>
  );
}
