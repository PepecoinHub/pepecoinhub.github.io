// Pure rules shared by server and client. No Devvit imports.

export type Move = 'r' | 'p' | 's'; // rock | paper | scissors
export type Result = 'w' | 'l' | 'd'; // from one player's point of view

export const MOVES: readonly Move[] = ['r', 'p', 's'];
export const POINTS: Record<Result, number> = { w: 3, d: 1, l: 0 };

export const isMove = (m: unknown): m is Move => m === 'r' || m === 'p' || m === 's';

export function outcome(mine: Move, theirs: Move): Result {
  if (mine === theirs) return 'd';
  return (mine === 'r' && theirs === 's') || (mine === 's' && theirs === 'p') || (mine === 'p' && theirs === 'r') ? 'w' : 'l';
}

export const invert = (r: Result): Result => (r === 'w' ? 'l' : r === 'l' ? 'w' : 'd');

/** "r/Gaming", "/r/gaming ", "gaming" -> "gaming". Undefined if it cannot be a subreddit name. */
export function normalizeTeam(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().replace(/^\/?r\//i, '').toLowerCase();
  return /^[a-z0-9_]{3,21}$/.test(t) ? t : undefined;
}

/** Team pair in a fixed order, so r/a vs r/b and r/b vs r/a share one record. */
export const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

const DAY = 86_400_000;

/** ISO week in UTC, e.g. "2026-W42". A season is one ISO week (Monday 00:00 UTC to Monday 00:00 UTC). */
export function seasonKey(ms: number): string {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); // Thursday of this week decides the year
  const year = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((t.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function seasonEnd(ms: number): number {
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return start + (7 - sinceMonday) * DAY;
}

export const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
