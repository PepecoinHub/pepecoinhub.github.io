// Authoritative game logic for Sub Says. It talks to storage only through the KV interface,
// so it runs against Devvit Redis in production and in memory in tests.
import {
  type AnswerResponse,
  type ArchiveView,
  type BonusNote,
  type BoardRow,
  type CollectView,
  type GuessEntry,
  type GuessMark,
  type GuessResponse,
  type GuessResult,
  type GuessView,
  type State,
  shareText,
} from '../shared/api.js';
import { MAX_ANSWER_LEN, bestMatch, cleanAnswer, keyOf, sameAnswer } from '../shared/text.js';
import { HOUR, dayKey, weekEnd, weekKey } from '../shared/time.js';

export interface KV {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<string>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hMGet(key: string, fields: string[]): Promise<(string | null)[]>;
  hSet(key: string, fieldValues: { [field: string]: string }): Promise<number>;
  hSetNX(key: string, field: string, value: string): Promise<number>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  hDel(key: string, fields: string[]): Promise<number>;
  hLen(key: string): Promise<number>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zScore(key: string, member: string): Promise<number | undefined>;
  zCard(key: string): Promise<number>;
  zRank(key: string, member: string): Promise<number | undefined>;
  zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean },
  ): Promise<{ member: string; score: number }[]>;
}

export const MIN_SUPPORT = 3; // an answer needs this many different people to reach the board
export const NEEDED_ANSWERS = 3; // a player gives exactly this many different answers
export const MAX_GUESSES = 3;
export const ANSWER_POINTS = 10;
export const BONUS_SHARE = 0.5; // an answer that makes the board earns this share of its percentage
const LOCK_STALE_MS = 4000;

const R = (n: number) => `ss:r:${n}`;
const K = {
  meta: 'ss:meta',
  posts: 'ss:posts',
  used: 'ss:used', // question -> round it was last used in
  names: 'ss:un',
  lock: 'ss:lock',
  user: (uid: string) => `ss:user:${uid}`,
  lb: (week: string) => `ss:lb:${week}`,
  resp: (n: number) => `${R(n)}:resp`,
  ck: (n: number) => `${R(n)}:ck`, // matching key -> cluster id
  cn: (n: number) => `${R(n)}:cn`, // cluster id -> number of different people
  cv: (n: number) => `${R(n)}:cv`, // `${id}|${display}` -> times typed
  cu: (n: number) => `${R(n)}:cu`, // `${id}:${uid}` -> 1, counts each person once per cluster
  hid: (n: number) => `${R(n)}:hid`, // hidden cluster ids
  g: (n: number) => `${R(n)}:g`, // uid -> guess result
  ua: (n: number) => `${R(n)}:ua`, // uid -> cluster ids of the player's answers
  sett: (n: number) => `${R(n)}:sett`, // uid -> crowd bonus already paid
};

// ---------- rounds ----------

export type BoardCap = 'auto' | '5' | '8';
export type NewRound = { q: string; now: number; intervalMs: number; minPlayers: number; cap: BoardCap };

type BoardEntry = { id: string; text: string; count: number; pct: number; keys: string[] };
type Result = { void: true; reason: 'few' | 'thin'; n: number } | { void: false; n: number; board: BoardEntry[] };
export type Round = { n: number; q: string; openAt: number; interval: number; min: number; cap: BoardCap; postId?: string };
export type Phase = 'upcoming' | 'collect' | 'guess' | 'done';

export async function openRound(kv: KV, r: NewRound): Promise<number> {
  const n = await kv.hIncrBy(K.meta, 'count', 1);
  await kv.hSet(R(n), { q: r.q, openAt: String(r.now), interval: String(r.intervalMs), min: String(r.minPlayers), cap: r.cap });
  await kv.hSet(K.meta, { lastOpenAt: String(r.now) });
  await kv.hSet(K.used, { [r.q]: String(n) });
  return n;
}

export async function setPost(kv: KV, n: number, postId: string) {
  await kv.hSet(R(n), { postId });
  await kv.hSet(K.posts, { [postId]: String(n) });
  await kv.hSet(K.meta, { lastPostId: postId });
}

export async function roundOfPost(kv: KV, postId: string | undefined): Promise<number | undefined> {
  if (!postId) return undefined;
  const v = await kv.hGet(K.posts, postId);
  return v ? Number(v) : undefined;
}

export async function loadRound(kv: KV, n: number): Promise<Round | undefined> {
  if (n < 1) return undefined;
  const h = await kv.hGetAll(R(n));
  if (!h['q']) return undefined;
  return { n, q: h['q'], openAt: Number(h['openAt']), interval: Number(h['interval']), min: Number(h['min']), cap: (h['cap'] as BoardCap) ?? 'auto', postId: h['postId'] };
}

export const phaseOf = (r: Round, now: number): Phase =>
  now < r.openAt ? 'upcoming' : now < r.openAt + r.interval ? 'collect' : now < r.openAt + 2 * r.interval ? 'guess' : 'done';

async function recentRounds(kv: KV, k = 4): Promise<Round[]> {
  const count = Number((await kv.hGet(K.meta, 'count')) ?? 0);
  const rounds = await Promise.all(Array.from({ length: Math.min(k, count) }, (_, i) => loadRound(kv, count - i)));
  return rounds.filter((r): r is Round => !!r);
}

// ---------- collecting ----------

async function takeLock(kv: KV, uid: string, now: number): Promise<boolean> {
  if (await kv.hSetNX(K.lock, uid, String(now))) return true;
  const since = Number(await kv.hGet(K.lock, uid));
  if (Number.isFinite(since) && now - since < LOCK_STALE_MS) return false;
  await kv.hSet(K.lock, { [uid]: String(now) });
  return true;
}

/** Finds the cluster an answer belongs to, creating it if nobody has said anything like it yet. */
async function assignCluster(kv: KV, n: number, key: string): Promise<string> {
  const exact = await kv.hGet(K.ck(n), key);
  if (exact) return exact;
  const all = await kv.hGetAll(K.ck(n));
  const near = bestMatch(key, Object.keys(all));
  if (near) {
    const id = all[near]!;
    await kv.hSetNX(K.ck(n), key, id);
    return id;
  }
  const fresh = String(await kv.hIncrBy(R(n), 'cid', 1));
  if (await kv.hSetNX(K.ck(n), key, fresh)) return fresh;
  return (await kv.hGet(K.ck(n), key)) ?? fresh;
}

export type AnswerInput = { uid?: string; name?: string; n: unknown; answers: unknown; now: number };

export async function submitAnswers(kv: KV, i: AnswerInput): Promise<AnswerResponse> {
  const { uid, name, now } = i;
  if (!uid || !name) return { ok: false, error: 'login' };
  const round = typeof i.n === 'number' ? await loadRound(kv, i.n) : undefined;
  if (!round || phaseOf(round, now) !== 'collect') return { ok: false, error: 'closed' };
  if (!Array.isArray(i.answers)) return { ok: false, error: 'invalid' };

  const seen = new Set<string>();
  const cleaned = [];
  for (const raw of i.answers.slice(0, 6)) {
    const c = cleanAnswer(raw);
    if (c && !seen.has(c.key)) {
      seen.add(c.key);
      cleaned.push(c);
    }
  }
  if (cleaned.length < NEEDED_ANSWERS) return { ok: false, error: 'need3' };
  cleaned.length = NEEDED_ANSWERS;

  if (!(await takeLock(kv, uid, now))) return { ok: false, error: 'busy' };
  try {
    if (await kv.hGet(K.resp(round.n), uid)) return { ok: false, error: 'already' };
    // Spelling variants of one answer must not count as three answers.
    const ids = [];
    for (const c of cleaned) ids.push(await assignCluster(kv, round.n, c.key));
    if (new Set(ids).size < NEEDED_ANSWERS) return { ok: false, error: 'same' };
    if (!(await kv.hSetNX(K.resp(round.n), uid, '1'))) return { ok: false, error: 'already' };
    for (const [idx, c] of cleaned.entries()) {
      const id = ids[idx]!;
      if (await kv.hSetNX(K.cu(round.n), `${id}:${uid}`, '1')) await kv.hIncrBy(K.cn(round.n), id, 1);
      await kv.hIncrBy(K.cv(round.n), `${id}|${c.text}`, 1);
    }
    await kv.hSet(K.ua(round.n), { [uid]: JSON.stringify(ids) });
    await kv.hSet(K.names, { [uid]: name });
    await credit(kv, uid, ANSWER_POINTS, now);
    return { ok: true, accepted: NEEDED_ANSWERS, points: ANSWER_POINTS, streak: await touch(kv, uid, now) };
  } finally {
    await kv.hDel(K.lock, [uid]);
  }
}

/** Most typed spelling of every cluster. On a tie the longer one wins (a typo is usually the shorter one), then alphabetical. */
function topVariants(variants: Record<string, string>): Map<string, { text: string; times: number }> {
  const best = new Map<string, { text: string; times: number }>();
  for (const [field, times] of Object.entries(variants)) {
    const cut = field.indexOf('|');
    const id = field.slice(0, cut);
    const text = field.slice(cut + 1);
    const t = Number(times);
    const cur = best.get(id);
    const better = !cur || t > cur.times || (t === cur.times && (text.length > cur.text.length || (text.length === cur.text.length && text < cur.text)));
    if (better) best.set(id, { text, times: t });
  }
  return best;
}

/** Answers already given in this round that start like `q`, in alphabetical order (no counts, no ranking). */
export async function suggest(kv: KV, q: string, now: number): Promise<string[]> {
  const prefix = q.trim().toLowerCase();
  if (prefix.length < 2 || prefix.length > MAX_ANSWER_LEN) return [];
  const round = (await recentRounds(kv, 4)).find((r) => phaseOf(r, now) === 'collect');
  if (!round) return [];
  const [variants, hidden] = await Promise.all([kv.hGetAll(K.cv(round.n)), kv.hGetAll(K.hid(round.n))]);
  return [...topVariants(variants).entries()]
    .filter(([id, v]) => !hidden[id] && v.text.toLowerCase().startsWith(prefix))
    .map(([, v]) => v.text)
    .sort((x, y) => x.localeCompare(y))
    .slice(0, 5);
}

// ---------- the board ----------

async function frozenResult(kv: KV, r: Round, now: number): Promise<Result | undefined> {
  if (phaseOf(r, now) === 'collect' || phaseOf(r, now) === 'upcoming') return undefined;
  const have = await kv.hGet(R(r.n), 'result');
  if (have) return JSON.parse(have) as Result;
  const computed = await computeResult(kv, r);
  await kv.hSetNX(R(r.n), 'result', JSON.stringify(computed)); // the first writer wins; everyone reads the same board
  return JSON.parse((await kv.hGet(R(r.n), 'result')) ?? JSON.stringify(computed)) as Result;
}

async function computeResult(kv: KV, r: Round): Promise<Result> {
  const n = await kv.hLen(K.resp(r.n));
  if (n < r.min) return { void: true, reason: 'few', n };
  const [counts, hidden, variants, keyMap] = await Promise.all([kv.hGetAll(K.cn(r.n)), kv.hGetAll(K.hid(r.n)), kv.hGetAll(K.cv(r.n)), kv.hGetAll(K.ck(r.n))]);
  const display = topVariants(variants);
  const cap = r.cap === '5' ? 5 : r.cap === '8' ? 8 : n >= 200 ? 8 : 5;
  const ranked = Object.entries(counts)
    .map(([id, c]) => ({ id, count: Number(c), text: display.get(id)?.text ?? '' }))
    .filter((e) => e.count >= MIN_SUPPORT && e.text && !hidden[e.id])
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, cap);
  if (ranked.length < 3) return { void: true, reason: 'thin', n };
  const board: BoardEntry[] = ranked.map((e) => ({
    ...e,
    pct: Math.max(1, Math.round((100 * e.count) / n)),
    keys: Object.entries(keyMap).filter(([, id]) => id === e.id).map(([k]) => k),
  }));
  return { void: false, n, board };
}

const publicBoard = (b: BoardEntry[]): BoardRow[] => b.map((e) => ({ text: e.text, pct: e.pct, count: e.count }));

// ---------- guessing ----------

type Saved = { guesses: GuessEntry[]; points: number; done: boolean };

const parseSaved = (raw: string | undefined): Saved | undefined => (raw ? (JSON.parse(raw) as Saved) : undefined);

export type GuessInput = { uid?: string; name?: string; n: unknown; guess: unknown; now: number; sub: string };

/** One guess at a time: the player sees whether it is on the board before typing the next one. */
export async function submitGuess(kv: KV, i: GuessInput): Promise<GuessResponse> {
  const { uid, name, now } = i;
  if (!uid || !name) return { ok: false, error: 'login' };
  const round = typeof i.n === 'number' ? await loadRound(kv, i.n) : undefined;
  if (!round || phaseOf(round, now) !== 'guess') return { ok: false, error: 'closed' };
  const result = await frozenResult(kv, round, now);
  if (!result || result.void) return { ok: false, error: 'void' };
  const c = cleanAnswer(i.guess);
  if (!c) return { ok: false, error: 'invalid' };

  if (!(await takeLock(kv, uid, now))) return { ok: false, error: 'busy' };
  try {
    const saved = parseSaved(await kv.hGet(K.g(round.n), uid)) ?? { guesses: [], points: 0, done: false };
    if (saved.done) return { ok: false, error: 'already' };
    // Typing the same thing again, or another spelling of an answer already found, costs nothing.
    if (saved.guesses.some((g) => keyOf(g.text) === c.key)) return { ok: false, error: 'repeat' };
    const idx = result.board.findIndex((e) => e.keys.includes(c.key) || e.keys.some((k) => sameAnswer(c.key, k)));
    if (idx >= 0 && saved.guesses.some((g) => g.rank === idx)) return { ok: false, error: 'repeat' };

    const entry: GuessEntry =
      idx < 0
        ? { text: c.text, mark: 'miss', points: 0 }
        : { text: c.text, mark: idx === 0 ? 'top' : 'board', points: result.board[idx]!.pct, matched: result.board[idx]!.text, rank: idx };
    saved.guesses.push(entry);
    saved.points += entry.points;
    saved.done = saved.guesses.length >= MAX_GUESSES;
    await kv.hSet(K.g(round.n), { [uid]: JSON.stringify(saved) });
    await kv.hSet(K.names, { [uid]: name });
    await credit(kv, uid, entry.points, now);
    const streak = await touch(kv, uid, now);
    const view: GuessResult = { guesses: saved.guesses, points: saved.points };
    return {
      ok: true,
      guess: entry,
      result: view,
      guessesLeft: MAX_GUESSES - saved.guesses.length,
      done: saved.done,
      board: saved.done ? publicBoard(result.board) : undefined,
      shareText: saved.done ? shareText(i.sub, round.n, saved.points, saved.guesses.map((g) => g.mark)) : undefined,
      streak,
    };
  } finally {
    await kv.hDel(K.lock, [uid]);
  }
}


// ---------- crowd bonus ----------

/**
 * Pays, once per round, half the percentage of each of the player's answers that reached the board.
 * It runs when the player opens the game, so nothing heavy happens when a round closes.
 */
async function settleBonuses(kv: KV, uid: string, now: number): Promise<BonusNote[]> {
  const notes: BonusNote[] = [];
  for (const r of await recentRounds(kv, 4)) {
    const ph = phaseOf(r, now);
    if (ph !== 'guess' && ph !== 'done') continue;
    const raw = await kv.hGet(K.ua(r.n), uid);
    if (!raw || (await kv.hGet(K.sett(r.n), uid))) continue;
    const res = await frozenResult(kv, r, now);
    if (!res || !(await kv.hSetNX(K.sett(r.n), uid, '1'))) continue;
    if (res.void) continue;
    const ids = JSON.parse(raw) as string[];
    const hits = res.board.filter((e) => ids.includes(e.id)).map((e) => ({ text: e.text, pct: e.pct }));
    if (!hits.length) continue;
    const points = hits.reduce((sum, h) => sum + Math.round(h.pct * BONUS_SHARE), 0);
    await credit(kv, uid, points, now);
    notes.push({ n: r.n, points, hits });
  }
  return notes;
}

// ---------- points and streaks ----------

async function credit(kv: KV, uid: string, points: number, now: number) {
  await kv.zIncrBy(K.lb(weekKey(now)), uid, points); // adds the player to the board even at 0
  await kv.zIncrBy(K.lb('all'), uid, points);
}

/** Days in a row with at least one action. */
async function touch(kv: KV, uid: string, now: number): Promise<number> {
  const u = await kv.hGetAll(K.user(uid));
  const today = dayKey(now);
  if (u['lastDay'] === today) return Number(u['streak'] ?? 1);
  const streak = u['lastDay'] === dayKey(now - 24 * HOUR) ? Number(u['streak'] ?? 0) + 1 : 1;
  await kv.hSet(K.user(uid), { lastDay: today, streak: String(streak) });
  return streak;
}

export async function markIntroSeen(kv: KV, uid: string) {
  await kv.hSet(K.user(uid), { intro: '1' });
}

// ---------- moderation ----------

/** Hides one answer from the board (and from suggestions). Works on the rounds that are still in play. */
export async function hideAnswer(kv: KV, text: string, now: number): Promise<{ ok: boolean; hidden: number }> {
  const c = cleanAnswer(text);
  if (!c) return { ok: false, hidden: 0 };
  let hidden = 0;
  for (const r of await recentRounds(kv, 4)) {
    if (phaseOf(r, now) === 'done') continue;
    const all = await kv.hGetAll(K.ck(r.n));
    const near = all[c.key] ? c.key : bestMatch(c.key, Object.keys(all));
    if (!near) continue;
    const id = all[near]!;
    await kv.hSet(K.hid(r.n), { [id]: '1' });
    hidden++;
    const have = await kv.hGet(R(r.n), 'result');
    if (have) {
      const res = JSON.parse(have) as Result;
      if (!res.void) {
        res.board = res.board.filter((e) => e.id !== id);
        if (res.board.length < 3) Object.assign(res, { void: true, reason: 'thin' });
        await kv.hSet(R(r.n), { result: JSON.stringify(res) });
      }
    }
  }
  return { ok: hidden > 0, hidden };
}

// ---------- the daily tick ----------

export type Tick = { due: boolean; finished: number[] };

/** What the daily job needs to know: is it time for a new round, and which rounds just ended. */
export async function dailyTick(kv: KV, now: number, intervalMs: number): Promise<Tick> {
  const rounds = await recentRounds(kv, 5);
  const finished: number[] = [];
  for (const r of rounds) {
    if (phaseOf(r, now) !== 'done') continue;
    await frozenResult(kv, r, now);
    if (await kv.hSetNX(R(r.n), 'announced', '1')) finished.push(r.n);
  }
  const latest = rounds[0];
  const due = !latest || now >= latest.openAt + intervalMs - 2 * HOUR;
  return { due, finished: finished.sort((a, b) => a - b) };
}

export async function usedQuestions(kv: KV): Promise<Map<string, number>> {
  return new Map(Object.entries(await kv.hGetAll(K.used)).map(([q, n]) => [q, Number(n)]));
}

export async function finalBoard(kv: KV, n: number, now: number): Promise<{ q: string; respondents: number; board: BoardRow[] } | undefined> {
  const r = await loadRound(kv, n);
  if (!r) return undefined;
  const res = await frozenResult(kv, r, now);
  if (!res || res.void) return undefined;
  return { q: r.q, respondents: res.n, board: publicBoard(res.board) };
}

export async function weeklyTop(kv: KV, week: string, n: number): Promise<{ name: string; points: number }[]> {
  const top = await kv.zRange(K.lb(week), 0, n - 1, { by: 'rank', reverse: true });
  if (!top.length) return [];
  const names = await kv.hMGet(K.names, top.map((t) => t.member));
  return top.map((t, i) => ({ name: names[i] ?? 'someone', points: t.score }));
}

// ---------- state for the client ----------

export type StateOpts = {
  uid?: string;
  name?: string;
  postId?: string;
  now: number;
  sub: string;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
};

export async function getState(kv: KV, o: StateOpts): Promise<State> {
  const { uid, now } = o;
  const rounds = await recentRounds(kv, 4);
  const collectRound = rounds.find((r) => phaseOf(r, now) === 'collect');
  const guessRound = rounds.find((r) => phaseOf(r, now) === 'guess');
  const week = weekKey(now);

  const state: State = {
    subreddit: o.sub,
    theme: o.theme,
    sponsorNote: o.sponsorNote,
    week,
    weekEndsAt: weekEnd(now),
    weekly: await weeklyTop(kv, week, 20),
    allTime: await weeklyTop(kv, 'all', 20),
    me: { loggedIn: !!uid, name: o.name, streak: 0, weekPoints: 0, allPoints: 0, bonus: [] },
    nextRoundAt: rounds[0] ? rounds[0].openAt + rounds[0].interval : undefined,
  };

  if (collectRound) {
    const view: CollectView = {
      n: collectRound.n,
      question: collectRound.q,
      closesAt: collectRound.openAt + collectRound.interval,
      respondents: await kv.hLen(K.resp(collectRound.n)),
      answered: uid ? !!(await kv.hGet(K.resp(collectRound.n), uid)) : false,
    };
    state.collect = view;
  }

  if (guessRound) {
    const res = await frozenResult(kv, guessRound, now);
    const view: GuessView = {
      n: guessRound.n,
      question: guessRound.q,
      closesAt: guessRound.openAt + 2 * guessRound.interval,
      status: !res || res.void ? 'void' : 'open',
      voidReason: res?.void ? (res.reason === 'few' ? 'Not enough people answered yesterday, so there is no board this time.' : 'Answers were too scattered to build a board.') : undefined,
      boardSize: res && !res.void ? res.board.length : 0,
      respondents: res?.n ?? 0,
      guessesLeft: MAX_GUESSES,
      done: false,
    };
    if (uid && res && !res.void) {
      const mine = parseSaved(await kv.hGet(K.g(guessRound.n), uid));
      if (mine) {
        view.mine = { guesses: mine.guesses, points: mine.points };
        view.guessesLeft = MAX_GUESSES - mine.guesses.length;
        view.done = mine.done;
        if (mine.done) view.board = publicBoard(res.board);
      }
    }
    state.guess = view;
  }

  // The post's own round once it is over, otherwise the latest round that finished.
  const own = await roundOfPost(kv, o.postId);
  const candidates = rounds.filter((r) => phaseOf(r, now) === 'done');
  const archiveRound = (own !== undefined ? candidates.find((r) => r.n === own) : undefined) ?? candidates[0];
  if (archiveRound) {
    const res = await frozenResult(kv, archiveRound, now);
    if (res) {
      const a: ArchiveView = res.void
        ? { n: archiveRound.n, question: archiveRound.q, respondents: res.n, board: [], status: 'void' }
        : { n: archiveRound.n, question: archiveRound.q, respondents: res.n, board: publicBoard(res.board), status: 'done' };
      state.archive = a;
    }
  }

  if (uid) {
    state.me.bonus = await settleBonuses(kv, uid, now);
    const [u, score, rank, card, allScore, allRank, allCard] = await Promise.all([
      kv.hGetAll(K.user(uid)),
      kv.zScore(K.lb(week), uid),
      kv.zRank(K.lb(week), uid),
      kv.zCard(K.lb(week)),
      kv.zScore(K.lb('all'), uid),
      kv.zRank(K.lb('all'), uid),
      kv.zCard(K.lb('all')),
    ]);
    const today = dayKey(now);
    const alive = u['lastDay'] === today || u['lastDay'] === dayKey(now - 24 * HOUR);
    state.me.streak = alive ? Number(u['streak'] ?? 0) : 0;
    state.me.weekPoints = score ?? 0;
    if (score !== undefined && rank !== undefined) state.me.weekRank = card - rank;
    state.me.allPoints = allScore ?? 0;
    if (allScore !== undefined && allRank !== undefined) state.me.allRank = allCard - allRank;
    state.weekly = await weeklyTop(kv, week, 20); // after the bonus, so the board is current
    state.allTime = await weeklyTop(kv, 'all', 20);
  }
  return state;
}

export async function latestPostId(kv: KV): Promise<string | undefined> {
  return kv.hGet(K.meta, 'lastPostId');
}

export async function lastOpenAt(kv: KV): Promise<number | undefined> {
  const v = await kv.hGet(K.meta, 'lastOpenAt');
  return v ? Number(v) : undefined;
}
