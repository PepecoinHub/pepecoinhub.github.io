const DAY = 86_400_000;
export const HOUR = 3_600_000;

export const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** ISO week in UTC, e.g. "2026-W42" (Monday 00:00 UTC to the next Monday). */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((t.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function weekEnd(ms: number): number {
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return start + (7 - ((d.getUTCDay() + 6) % 7)) * DAY;
}
