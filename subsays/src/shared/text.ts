// Answer cleaning, matching and the fuzzy-merge rules. Pure code, shared by server and tests.

export const MAX_ANSWER_LEN = 40;
export const MAX_WORDS = 6;

// A small built-in filter. Moderators can hide anything else from the mod menu.
const BLOCKED = new Set([
  'fuck', 'fucking', 'fucker', 'shit', 'bullshit', 'cunt', 'bitch', 'asshole', 'dick', 'dickhead', 'cock', 'pussy',
  'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'retard', 'retarded', 'rape', 'rapist', 'porn', 'cum', 'kys',
]);

const ARTICLES = new Set(['a', 'an', 'the']);

export type Cleaned = { text: string; key: string };

/** Turns what a player typed into a display form and a matching key. Undefined if it cannot be used. */
export function cleanAnswer(raw: unknown): Cleaned | undefined {
  if (typeof raw !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > MAX_ANSWER_LEN) return undefined;
  // Never store links, addresses or phone numbers: this is a public board.
  if (/(https?:|www\.|\.(com|net|org|io|ru|cn)\b|@|\d{6,})/i.test(text)) return undefined;
  if (text.split(' ').length > MAX_WORDS) return undefined;
  const key = keyOf(text);
  if (!key) return undefined;
  const tokens = key.split(' ');
  if (tokens.length > MAX_WORDS) return undefined;
  if (tokens.some((t) => BLOCKED.has(t))) return undefined;
  return { text: text.charAt(0).toUpperCase() + text.slice(1), key };
}

/** Lowercase, no accents or punctuation, no articles, singular, words sorted. */
export function keyOf(text: string): string {
  const words = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w && !ARTICLES.has(w))
    .map(singular);
  return words.sort().join(' ');
}

export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}

/** Edit distance counting a swap of two neighbours as one edit. Stops early above `max`. */
export function distance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m]!;
}

/** Typos only: short keys must match exactly, long ones may differ by one or two letters. */
export function sameAnswer(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.max(a.length, b.length); // "tenis" is one letter away from "tennis" even though it is short
  const allowed = len >= 11 ? 2 : len >= 6 ? 1 : 0;
  if (allowed === 0) return false;
  if (a[0] !== b[0]) return false; // a different first letter is a different word far more often than a typo
  return distance(a, b, allowed) <= allowed;
}

export function bestMatch(key: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestD = 99;
  for (const c of candidates) {
    if (!sameAnswer(key, c)) continue;
    const d = distance(key, c, 3);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}
