/**
 * Time-zone helpers. Instants are stored in UTC (timestamptz). The Owner enters
 * lesson times as wall-clock time in the academy's time zone; viewers see them in
 * their own local time via <LocalTime>.
 */

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** "2026-03-14T16:30" interpreted in `timeZone` → UTC Date. Returns null if malformed. */
export function zonedToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle instants near a daylight-saving change.
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  utc = guess - tzOffsetMs(new Date(utc), timeZone);
  const result = new Date(utc);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** UTC instant → "YYYY-MM-DDTHH:mm" in `timeZone`, for datetime-local inputs. */
export function utcToZonedInput(iso: string | Date, timeZone: string): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const shifted = new Date(date.getTime() + tzOffsetMs(date, timeZone));
  return shifted.toISOString().slice(0, 16);
}

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function zonedDate(iso: string | Date, timeZone: string): string {
  return utcToZonedInput(iso, timeZone).slice(0, 10);
}

export function formatDateTime(iso: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function formatDate(iso: string | Date): string {
  // Date-only values (YYYY-MM-DD) are formatted as calendar dates, not instants.
  const d = typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** Monday 00:00 (academy time) of the week containing `date`, as YYYY-MM-DD. */
export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Do two sessions overlap? Used to flag scheduling conflicts. */
export function overlaps(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number): boolean {
  const aEnd = aStart.getTime() + aMinutes * 60000;
  const bEnd = bStart.getTime() + bMinutes * 60000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}
