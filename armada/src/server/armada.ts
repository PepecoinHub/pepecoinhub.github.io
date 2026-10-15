// Authoritative game logic. Talks to storage only through the small KV interface below,
// so it runs against Devvit Redis in production and an in-memory map in tests.
import {
  type Charge,
  type GameConfig,
  POINTS,
  type Ship,
  configFor,
  placeFleet,
  regen,
} from '../shared/game.js';
import type { FireResponse, Finish, GameState, LeaderRow, Mark, SunkShip } from '../shared/api.js';

export interface KV {
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
  zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean },
  ): Promise<{ member: string; score: number }[]>;
  expire(key: string, seconds: number): Promise<void>;
}

const k = (postId: string, part: string) => `a:${postId}:${part}`;
const KEEP_AFTER_FINISH_SEC = 7 * 24 * 3600;
const LOCK_STALE_MS = 4000;

type Stored = { cfg: GameConfig; ships: Ship[] };

export type NewGameOpts = { subscribers: number; sizeOverride?: number; seed?: number };

/** Creates the hidden fleet for a post. Safe to call twice: the first call wins. */
export async function ensureGame(kv: KV, postId: string, opts: NewGameOpts): Promise<Stored> {
  const existing = await loadGame(kv, postId);
  if (existing) return existing;
  const cfg = configFor(opts.subscribers, opts.sizeOverride);
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);
  const stored: Stored = { cfg, ships: placeFleet(cfg, seed) };
  await kv.hSetNX(k(postId, 'game'), 'init', JSON.stringify(stored));
  return (await loadGame(kv, postId)) ?? stored;
}

async function loadGame(kv: KV, postId: string): Promise<Stored | undefined> {
  const raw = await kv.hGet(k(postId, 'game'), 'init');
  return raw ? (JSON.parse(raw) as Stored) : undefined;
}

export type FireInput = { postId: string; uid?: string; name?: string; cell: number; now: number };
export type FireOutcome = { response: FireResponse; finish?: Finish };

export async function fire(kv: KV, input: FireInput): Promise<FireOutcome> {
  const { postId, uid, name, cell, now } = input;
  if (!uid || !name) return { response: { ok: false, error: 'login' } };
  const game = await loadGame(kv, postId);
  if (!game || !Number.isInteger(cell) || cell < 0 || cell >= game.cfg.size ** 2) {
    return { response: { ok: false, error: 'invalid' } };
  }
  if (await kv.hGet(k(postId, 'game'), 'finish')) return { response: { ok: false, error: 'finished' } };

  const lockKey = k(postId, 'lock');
  if (!(await takeLock(kv, lockKey, uid, now))) return { response: { ok: false, error: 'busy' } };
  try {
    return await resolveShot(kv, game, { postId, uid, name, cell, now });
  } finally {
    await kv.hDel(lockKey, [uid]);
  }
}

async function takeLock(kv: KV, key: string, field: string, now: number): Promise<boolean> {
  if (await kv.hSetNX(key, field, String(now))) return true;
  const since = Number(await kv.hGet(key, field));
  if (Number.isFinite(since) && now - since < LOCK_STALE_MS) return false;
  await kv.hSet(key, { [field]: String(now) }); // stale lock from a crashed request
  return true;
}

async function resolveShot(
  kv: KV,
  game: Stored,
  i: { postId: string; uid: string; name: string; cell: number; now: number },
): Promise<FireOutcome> {
  const { postId, uid, name, cell, now } = i;
  const { cfg, ships } = game;
  const shotsKey = k(postId, 'shots');

  const chargeRaw = await kv.hGet(k(postId, 'chg'), uid);
  const bank = regen(chargeRaw ? (JSON.parse(chargeRaw) as Charge) : undefined, now, cfg);
  if (bank.c < 1) return { response: { ok: false, error: 'cooldown', nextAt: bank.nextAt } };

  const prior = await kv.hGet(shotsKey, String(cell));
  if (prior) return { response: { ok: false, error: 'taken', existing: prior as Mark } };

  const shipIdx = ships.findIndex((s) => s.cells.includes(cell));
  const result: Mark = shipIdx >= 0 ? 'h' : 'm';
  // hSetNX is the arbiter when two players fire at the same cell at once.
  if (!(await kv.hSetNX(shotsKey, String(cell), result))) {
    const winner = await kv.hGet(shotsKey, String(cell));
    return { response: { ok: false, error: 'taken', existing: (winner as Mark) ?? result } };
  }

  // Spend the shot only now, so a rejected tap never costs anything.
  const after: Charge = { c: bank.c - 1, t: bank.t };
  await kv.hSet(k(postId, 'chg'), { [uid]: JSON.stringify(after) });
  await kv.hSet(k(postId, 'names'), { [uid]: name });
  await kv.hIncrBy(k(postId, 'cnt'), uid, 1);
  const total = await kv.hIncrBy(k(postId, 'meta'), 'shots', 1);
  await kv.zIncrBy(k(postId, 'lb'), uid, 0); // registers the player even after a miss

  let points = 0;
  let sunk: SunkShip | undefined;
  let finish: Finish | undefined;
  if (result === 'h') {
    points += POINTS.hit;
    const ship = ships[shipIdx]!;
    const marks = await kv.hGetAll(shotsKey);
    if (ship.cells.every((c) => marks[String(c)] === 'h')) {
      // Only one request gets to claim the sinking, however many saw the last hit.
      if (await kv.hSetNX(k(postId, 'sunk'), String(shipIdx), JSON.stringify({ by: name }))) {
        points += POINTS.sink;
        sunk = { len: ship.len, cells: ship.cells, by: name };
        if ((await kv.hLen(k(postId, 'sunk'))) >= ships.length) {
          const candidate: Finish = {
            at: now,
            shots: total,
            players: await kv.zCard(k(postId, 'lb')),
            finisher: name,
          };
          if (await kv.hSetNX(k(postId, 'game'), 'finish', JSON.stringify(candidate))) {
            points += POINTS.finish;
            finish = candidate;
          }
        }
      }
    }
  }
  if (points > 0) await kv.zIncrBy(k(postId, 'lb'), uid, points);

  if (finish) {
    for (const part of ['game', 'shots', 'sunk', 'lb', 'names', 'chg', 'cnt', 'meta', 'lock']) {
      await kv.expire(k(postId, part), KEEP_AFTER_FINISH_SEC);
    }
  }

  const next = regen(after, now, cfg);
  return {
    response: { ok: true, cell, result, sunk, won: !!finish, points, charges: next.c, nextAt: next.nextAt },
    finish,
  };
}

export type StateOpts = {
  uid?: string;
  name?: string;
  now: number;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
  subreddit: string;
};

export async function getState(kv: KV, postId: string, o: StateOpts): Promise<GameState | undefined> {
  const game = await loadGame(kv, postId);
  if (!game) return undefined;
  const { cfg, ships } = game;

  const [marks, sunkRaw, finishRaw, meta, players] = await Promise.all([
    kv.hGetAll(k(postId, 'shots')),
    kv.hGetAll(k(postId, 'sunk')),
    kv.hGet(k(postId, 'game'), 'finish'),
    kv.hGetAll(k(postId, 'meta')),
    kv.zCard(k(postId, 'lb')),
  ]);

  const shots: Record<string, Mark> = {};
  for (const [cell, m] of Object.entries(marks)) shots[cell] = m as Mark;

  const sunk: SunkShip[] = [];
  const sunkIdx = new Set<number>();
  for (const [idx, raw] of Object.entries(sunkRaw)) {
    const ship = ships[Number(idx)];
    if (!ship) continue;
    sunkIdx.add(Number(idx));
    sunk.push({ len: ship.len, cells: ship.cells, by: (JSON.parse(raw) as { by: string }).by });
  }
  const remaining = ships.filter((_, idx) => !sunkIdx.has(idx)).map((s) => s.len).sort((a, b) => b - a);

  const top = await kv.zRange(k(postId, 'lb'), 0, 4, { by: 'rank', reverse: true });
  const topNames = top.length ? await kv.hMGet(k(postId, 'names'), top.map((t) => t.member)) : [];
  const leaders: LeaderRow[] = top.map((t, n) => ({ name: topNames[n] ?? 'someone', score: t.score }));

  const me: GameState['me'] = { loggedIn: !!o.uid, name: o.name, charges: cfg.maxCharges, nextAt: null, score: 0, shots: 0 };
  if (o.uid) {
    const [raw, score, count] = await Promise.all([
      kv.hGet(k(postId, 'chg'), o.uid),
      kv.zScore(k(postId, 'lb'), o.uid),
      kv.hGet(k(postId, 'cnt'), o.uid),
    ]);
    const bank = regen(raw ? (JSON.parse(raw) as Charge) : undefined, o.now, cfg);
    me.charges = bank.c;
    me.nextAt = bank.nextAt;
    me.score = score ?? 0;
    me.shots = Number(count ?? 0);
  }

  return {
    size: cfg.size,
    shots,
    sunk,
    remaining,
    totalShots: Number(meta['shots'] ?? 0),
    players,
    leaders,
    regenSec: cfg.regenSec,
    maxCharges: cfg.maxCharges,
    theme: o.theme,
    sponsorNote: o.sponsorNote,
    subreddit: o.subreddit,
    finish: finishRaw ? (JSON.parse(finishRaw) as Finish) : undefined,
    me,
  };
}
