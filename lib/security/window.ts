const memory = new Map<string, { windowStart: number; count: number }>();

/** Fixed-window limiter held in process memory. Fallback store; also unit-tested. */
export function memoryRateLimit(key: string, max: number, windowSeconds: number, now = Date.now()): boolean {
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const entry = memory.get(key);
  if (!entry || entry.windowStart !== windowStart) {
    memory.set(key, { windowStart, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}

/** How many times the key was used in the current window, without counting a use. */
export function memoryUsage(key: string, windowSeconds: number, now = Date.now()): number {
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const entry = memory.get(key);
  return entry && entry.windowStart === windowStart ? entry.count : 0;
}
