'use client';

import { useEffect, useState } from 'react';

const FORMATS = {
  datetime: { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  date: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * Shows an instant in the viewer's own time zone. The server renders it in the
 * academy's zone (fallback) and the browser corrects it after hydration, so a family
 * abroad sees lesson times that are right for where they are.
 */
export function LocalTime({ iso, format = 'datetime', fallbackZone = 'Africa/Lagos' }: { iso: string; format?: keyof typeof FORMATS; fallbackZone?: string }) {
  const render = (timeZone?: string) => new Intl.DateTimeFormat('en-GB', { ...FORMATS[format], timeZone }).format(new Date(iso));
  const [text, setText] = useState(() => render(fallbackZone));
  useEffect(() => setText(render()), [iso, format]); // eslint-disable-line react-hooks/exhaustive-deps
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
