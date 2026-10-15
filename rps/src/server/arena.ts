// Authoritative game logic for Subreddit Wars. It talks to storage only through the KV
// interface, so it runs against Devvit Redis in production and in memory in tests.
import type { DuelAcceptResponse, DuelOpenResponse, DuelRow, Duelist, MyThrow, Rivalry, State, Tick, TeamRow, ThrowResponse } from '../shared/api.js';
import {
  type Move,
  POINTS,
  type Result,
  dayKey,
  invert,
  isMove,
  outcome,
  pairOf,
  seasonEnd,
  seasonKey,
} from '../shared/rules.js';

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
  zAdd(key: string, ...members: { member: string; score: number }[]): Promise<number>;
  zRem(key: string, members: string[]): Promise<number>;
  zIncrBy(key: string, member: string, value: number): Promise<number>;
  zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean },
  ): Promise<{ member: string; score: number }[]>;
  expire(key: string, seconds: number): Promise<void>;
}

const POOL = 'rps:pool'; // zset: waiting team throws by time
const DUELS = 'rps:duels'; // zset: open duels by time
const KEEP_THROW_SEC = 30 * 24 * 3600;
const MAX_PENDING = 3;
const SCAN = 50; // how many of the oldest waiting throws a new throw looks at
const LOCK_STALE_MS = 4000;

const K = {
  user: (uid: string) => `rps:user:${uid}`,
  rec: (uid: string) => `rps:rec:${uid}`,
  mine: (uid: string) => `rps:mine:${uid}`,
  thr: (id: string) => `rps:t:${id}`,
  day: (d: string) => `rps:day:${d}`,
  names: 'rps:tn',
  pending: 'rps:pc',
  lock: 'rps:lock',
  feed: 'rps:feed',
  lb: (s: string) => `rps:lb:${s}`,
  ts: (s: string) => `rps:ts:${s}`,
  seen: (s: string) => `rps:pl:${s}`,
  un: 'rps:un', // uid -> username, for duel boards
  dl: (s: string) => `rps:dl:${s}`, // duel ladder: uid -> points
  dr: (s: string) => `rps:dr:${s}`, // duel ladder: `${uid}:w|l|d` counts
  rv: (s: string) => `rps:rv:${s}`,
  rvz: (s: string) => `rps:rvz:${s}`,
};
const ALL = 'all';

type Throw = {
  id: string;
  kind: 'team' | 'duel';
  uid: string;
  name?: string;
  team: string;
  move: Move;
  at: number;
  res?: Result; // from this throw's owner's point of view
  oppTeam?: string;
  oppName?: string;
  oppMove?: Move;
  resAt?: number;
  waited?: boolean; // settled by someone else's request while this player was away
};

async function loadThrow(kv: KV, id: string): Promise<Throw | undefined> {
  const h = await kv.hGetAll(K.thr(id));
  if (!h['uid'] || !h['move']) return undefined;
  return {
    id,
    kind: h['kind'] === 'duel' ? 'duel' : 'team',
    uid: h['uid'],
    name: h['name'],
    team: h['team'] ?? '',
    move: h['move'] as Move,
    at: Number(h['at']),
    res: h['res'] as Result | undefined,
    oppTeam: h['oppTeam'],
    oppName: h['oppName'],
    oppMove: h['oppMove'] as Move | undefined,
    resAt: h['resAt'] ? Number(h['resAt']) : undefined,
    waited: h['waited'] === '1',
  };
}

// ---------- teams ----------

export type SetTeamInput = { uid: string; team: string; display: string; now: number };

/** A player fights for one subreddit per season. Switching is allowed until their first throw of the season. */
export async function setTeam(kv: KV, i: SetTeamInput): Promise<{ ok: true } | { ok: false; error: 'locked' }> {
  const season = seasonKey(i.now);
  const u = await kv.hGetAll(K.user(i.uid));
  if (u['team'] && u['team'] !== i.team && u['tSeason'] === season && Number(u['tCount'] ?? 0) > 0) {
    return { ok: false, error: 'locked' };
  }
  await kv.hSet(K.names, { [i.team]: i.display });
  const sameSeason = u['tSeason'] === season && u['team'] === i.team;
  await kv.hSet(K.user(i.uid), { team: i.team, tSeason: season, tCount: sameSeason ? (u['tCount'] ?? '0') : '0' });
  return { ok: true };
}

async function canChangeTeam(kv: KV, uid: string, now: number): Promise<boolean> {
  const u = await kv.hGetAll(K.user(uid));
  return !(u['team'] && u['tSeason'] === seasonKey(now) && Number(u['tCount'] ?? 0) > 0);
}

// ---------- throwing ----------

export type ThrowInput = { uid?: string; move: unknown; now: number; dailyLimit: number };
export type Notify = { uid: string; result: Result; oppTeam: string; throwId: string; duel?: boolean };
export type ThrowOutcome = { response: ThrowResponse; tick?: Tick; notify?: Notify };

export async function throwMove(kv: KV, i: ThrowInput): Promise<ThrowOutcome> {
  const { uid, now } = i;
  if (!uid) return { response: { ok: false, error: 'login' } };
  if (!isMove(i.move)) return { response: { ok: false, error: 'invalid' } };
  if (!(await takeLock(kv, uid, now))) return { response: { ok: false, error: 'busy' } };
  try {
    return await doThrow(kv, uid, i.move, now, i.dailyLimit);
  } finally {
    await kv.hDel(K.lock, [uid]);
  }
}

/** One daily throw budget is shared by team throws and duels. */
async function spendThrow(kv: KV, uid: string, now: number, dailyLimit: number, checkPending: boolean): Promise<{ ok: true; left: number } | { ok: false; error: 'limit' | 'pending' }> {
  const today = dayKey(now);
  const used = Number((await kv.hGet(K.day(today), uid)) ?? 0);
  if (used >= dailyLimit) return { ok: false, error: 'limit' };
  if (checkPending && Number((await kv.hGet(K.pending, uid)) ?? 0) >= MAX_PENDING) return { ok: false, error: 'pending' };
  await kv.hIncrBy(K.day(today), uid, 1);
  await kv.expire(K.day(today), 2 * 24 * 3600);
  return { ok: true, left: dailyLimit - used - 1 };
}

async function takeLock(kv: KV, uid: string, now: number): Promise<boolean> {
  if (await kv.hSetNX(K.lock, uid, String(now))) return true;
  const since = Number(await kv.hGet(K.lock, uid));
  if (Number.isFinite(since) && now - since < LOCK_STALE_MS) return false;
  await kv.hSet(K.lock, { [uid]: String(now) }); // stale lock from a crashed request
  return true;
}

async function doThrow(kv: KV, uid: string, move: Move, now: number, dailyLimit: number): Promise<ThrowOutcome> {
  const season = seasonKey(now);
  const user = await kv.hGetAll(K.user(uid));
  const team = user['team'];
  if (!team) return { response: { ok: false, error: 'noteam' } };

  const spent = await spendThrow(kv, uid, now, dailyLimit, true);
  if (!spent.ok) return { response: { ok: false, error: spent.error } };
  const left = spent.left;

  // Count the season's throws (locks the team choice) and unique players per team.
  await kv.hSet(K.user(uid), { tSeason: season, tCount: String(Number(user['tSeason'] === season ? (user['tCount'] ?? 0) : 0) + 1) });
  if (await kv.hSetNX(K.seen(season), `${team}:${uid}`, '1')) await kv.hIncrBy(K.ts(season), `${team}:p`, 1);
  if (await kv.hSetNX(K.seen(ALL), `${team}:${uid}`, '1')) await kv.hIncrBy(K.ts(ALL), `${team}:p`, 1);

  const id = `${String(now).padStart(13, '0')}_${Math.random().toString(36).slice(2, 8)}`;
  const me: Throw = { id, kind: 'team', uid, team, move, at: now };
  await kv.hSet(K.thr(id), { uid, team, move, at: String(now) });
  await kv.expire(K.thr(id), KEEP_THROW_SEC);
  await kv.zAdd(K.mine(uid), { member: id, score: now });

  // 1) Try to take someone else's waiting throw.
  const opp = await claimOpponent(kv, me);
  if (opp) return resolve(kv, me, opp, now, left, false);

  // 2) Nobody to fight: wait in the pool.
  await kv.zAdd(POOL, { member: id, score: now });
  await kv.hIncrBy(K.pending, uid, 1);

  // 3) Look again: a throw that arrived while we were joining the pool may be waiting for us.
  const late = await claimOpponent(kv, me);
  if (late) {
    if ((await kv.zRem(POOL, [id])) === 1) return resolve(kv, me, late, now, left, true);
    await kv.zAdd(POOL, { member: late.id, score: late.at }); // someone else already took us; give theirs back
  }
  const taken = await loadThrow(kv, id);
  if (taken?.res && taken.oppTeam && taken.oppMove) {
    // The other request resolved us while we were looking around.
    return {
      response: { ok: true, status: 'matched', id, result: taken.res, oppTeam: taken.oppTeam, oppMove: taken.oppMove, throwsLeft: left },
    };
  }
  return { response: { ok: true, status: 'waiting', id, throwsLeft: left } };
}

/** Takes the oldest waiting throw from a different team. zRem is the arbiter when several requests race. */
async function claimOpponent(kv: KV, me: Throw): Promise<Throw | undefined> {
  const waiting = await kv.zRange(POOL, 0, SCAN - 1, { by: 'rank' });
  for (const { member } of waiting) {
    if (member === me.id) continue;
    const opp = await loadThrow(kv, member);
    if (!opp || opp.team === me.team || opp.uid === me.uid) continue;
    if ((await kv.zRem(POOL, [member])) === 1) return opp;
  }
  return undefined;
}

async function resolve(kv: KV, me: Throw, opp: Throw, now: number, left: number, meWasQueued: boolean): Promise<ThrowOutcome> {
  const myRes = outcome(me.move, opp.move);
  const oppRes = invert(myRes);
  await kv.hSet(K.thr(me.id), { res: myRes, oppTeam: opp.team, oppMove: opp.move, resAt: String(now) });
  await kv.hSet(K.thr(opp.id), { res: oppRes, oppTeam: me.team, oppMove: me.move, resAt: String(now), waited: '1' });

  await kv.hIncrBy(K.pending, opp.uid, -1);
  if (meWasQueued) await kv.hIncrBy(K.pending, me.uid, -1);

  const season = seasonKey(now);
  for (const s of [season, ALL]) {
    await score(kv, s, me.team, myRes);
    await score(kv, s, opp.team, oppRes);
    await rivalry(kv, s, me.team, opp.team, myRes);
  }
  await kv.hIncrBy(K.rec(me.uid), myRes, 1);
  await kv.hIncrBy(K.rec(opp.uid), oppRes, 1);

  const tick: Tick = { at: now, a: me.team, b: opp.team, r: myRes };
  await pushFeed(kv, tick);

  return {
    response: { ok: true, status: 'matched', id: me.id, result: myRes, oppTeam: opp.team, oppMove: opp.move, throwsLeft: left },
    tick,
    notify: { uid: opp.uid, result: oppRes, oppTeam: me.team, throwId: opp.id },
  };
}

async function score(kv: KV, season: string, team: string, r: Result) {
  await kv.zIncrBy(K.lb(season), team, POINTS[r]);
  await kv.hIncrBy(K.ts(season), `${team}:${r}`, 1);
}

async function rivalry(kv: KV, season: string, x: string, y: string, rx: Result) {
  const [a, b] = pairOf(x, y);
  const ra = x === a ? rx : invert(rx);
  const field = ra === 'w' ? 'aw' : ra === 'l' ? 'bw' : 'd';
  await kv.hIncrBy(K.rv(season), `${a}|${b}:${field}`, 1);
  await kv.zIncrBy(K.rvz(season), `${a}|${b}`, 1);
}

// The ticker is only decoration, so a lost update under concurrency is acceptable.
async function pushFeed(kv: KV, t: Tick) {
  const cur = JSON.parse((await kv.get(K.feed)) ?? '[]') as Tick[];
  await kv.set(K.feed, JSON.stringify([t, ...cur].slice(0, 8)));
}


// ---------- duels ----------
// An open duel is a hidden move with a name on it. Anyone else on the sub can take it on from the list.

export type DuelOpenInput = { uid?: string; name?: string; move: unknown; now: number; dailyLimit: number };

export async function openDuel(kv: KV, i: DuelOpenInput): Promise<{ response: DuelOpenResponse }> {
  const { uid, name, now } = i;
  if (!uid || !name) return { response: { ok: false, error: 'login' } };
  if (!isMove(i.move)) return { response: { ok: false, error: 'invalid' } };
  const move = i.move;
  if (!(await takeLock(kv, uid, now))) return { response: { ok: false, error: 'busy' } };
  try {
    const spent = await spendThrow(kv, uid, now, i.dailyLimit, true);
    if (!spent.ok) return { response: { ok: false, error: spent.error } };
    const id = `${String(now).padStart(13, '0')}_${Math.random().toString(36).slice(2, 8)}`;
    await kv.hSet(K.thr(id), { kind: 'duel', uid, name, move, at: String(now) });
    await kv.expire(K.thr(id), KEEP_THROW_SEC);
    await kv.hSet(K.un, { [uid]: name });
    await kv.zAdd(K.mine(uid), { member: id, score: now });
    await kv.zAdd(DUELS, { member: id, score: now });
    await kv.hIncrBy(K.pending, uid, 1);
    return { response: { ok: true, id, throwsLeft: spent.left } };
  } finally {
    await kv.hDel(K.lock, [uid]);
  }
}

export type DuelAcceptInput = { uid?: string; name?: string; id: unknown; move: unknown; now: number; dailyLimit: number };
export type DuelAcceptOutcome = { response: DuelAcceptResponse; tick?: Tick; notify?: Notify };

export async function acceptDuel(kv: KV, i: DuelAcceptInput): Promise<DuelAcceptOutcome> {
  const { uid, name, now } = i;
  if (!uid || !name) return { response: { ok: false, error: 'login' } };
  if (!isMove(i.move) || typeof i.id !== 'string') return { response: { ok: false, error: 'invalid' } };
  const move = i.move;
  if (!(await takeLock(kv, uid, now))) return { response: { ok: false, error: 'busy' } };
  try {
    const opp = await loadThrow(kv, i.id);
    if (!opp || opp.kind !== 'duel' || opp.res) return { response: { ok: false, error: 'gone' } };
    if (opp.uid === uid) return { response: { ok: false, error: 'self' } };
    const spent = await spendThrow(kv, uid, now, i.dailyLimit, false);
    if (!spent.ok) return { response: { ok: false, error: 'limit' } };
    // zRem is the arbiter when two players go for the same duel.
    if ((await kv.zRem(DUELS, [i.id])) !== 1) {
      await kv.hIncrBy(K.day(dayKey(now)), uid, -1); // the shot was not used
      return { response: { ok: false, error: 'gone' } };
    }
    const id = `${String(now).padStart(13, '0')}_${Math.random().toString(36).slice(2, 8)}`;
    const myRes = outcome(move, opp.move);
    const oppRes = invert(myRes);
    const oppName = opp.name ?? 'someone';
    await kv.hSet(K.thr(id), { kind: 'duel', uid, name, move, at: String(now), res: myRes, oppName, oppMove: opp.move, resAt: String(now) });
    await kv.expire(K.thr(id), KEEP_THROW_SEC);
    await kv.zAdd(K.mine(uid), { member: id, score: now });
    await kv.hSet(K.thr(opp.id), { res: oppRes, oppName: name, oppMove: move, resAt: String(now), waited: '1' });
    await kv.hSet(K.un, { [uid]: name });
    await kv.hIncrBy(K.pending, opp.uid, -1);

    const season = seasonKey(now);
    await ladder(kv, season, uid, myRes);
    await ladder(kv, season, opp.uid, oppRes);
    await kv.hIncrBy(K.rec(uid), myRes, 1);
    await kv.hIncrBy(K.rec(opp.uid), oppRes, 1);

    const tick: Tick = { at: now, a: name, b: oppName, r: myRes, duel: true };
    await pushFeed(kv, tick);
    return {
      response: { ok: true, result: myRes, oppName, oppMove: opp.move, throwsLeft: spent.left },
      tick,
      notify: { uid: opp.uid, result: oppRes, oppTeam: name, throwId: opp.id, duel: true },
    };
  } finally {
    await kv.hDel(K.lock, [uid]);
  }
}

async function ladder(kv: KV, season: string, uid: string, r: Result) {
  await kv.zIncrBy(K.dl(season), uid, POINTS[r]);
  await kv.hIncrBy(K.dr(season), `${uid}:${r}`, 1);
}

async function openDuels(kv: KV, uid: string | undefined): Promise<DuelRow[]> {
  const ids = await kv.zRange(DUELS, 0, 7, { by: 'rank', reverse: true });
  const rows = await Promise.all(ids.map((r) => loadThrow(kv, r.member)));
  return rows
    .filter((t): t is Throw => !!t && !t.res)
    .map((t) => ({ id: t.id, name: t.name ?? 'someone', at: t.at, mine: t.uid === uid }));
}

async function topDuelists(kv: KV, season: string, n: number): Promise<Duelist[]> {
  const top = await kv.zRange(K.dl(season), 0, n - 1, { by: 'rank', reverse: true });
  if (!top.length) return [];
  const [names, vals] = await Promise.all([
    kv.hMGet(K.un, top.map((t) => t.member)),
    kv.hMGet(K.dr(season), top.flatMap((t) => ['w', 'l', 'd'].map((f) => `${t.member}:${f}`))),
  ]);
  return top.map((t, i) => ({
    name: names[i] ?? 'someone',
    points: t.score,
    w: Number(vals[i * 3] ?? 0),
    l: Number(vals[i * 3 + 1] ?? 0),
    d: Number(vals[i * 3 + 2] ?? 0),
  }));
}

// ---------- reading ----------

export type StateOpts = {
  uid?: string;
  now: number;
  dailyLimit: number;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
  featured: string[];
};

export async function getState(kv: KV, o: StateOpts): Promise<State> {
  const season = seasonKey(o.now);
  const [teams, rivalries, feedRaw, duels, duelists] = await Promise.all([
    topTeams(kv, season, 10),
    topRivalries(kv, season, 5),
    kv.get(K.feed),
    openDuels(kv, o.uid),
    topDuelists(kv, season, 10),
  ]);

  const me: State['me'] = {
    loggedIn: !!o.uid,
    canChangeTeam: true,
    throwsLeft: o.dailyLimit,
    dailyLimit: o.dailyLimit,
    record: { w: 0, l: 0, d: 0 },
    pending: 0,
    recent: [],
    news: [],
  };
  if (o.uid) {
    const uid = o.uid;
    const [user, rec, used, pend, ids] = await Promise.all([
      kv.hGetAll(K.user(uid)),
      kv.hGetAll(K.rec(uid)),
      kv.hGet(K.day(dayKey(o.now)), uid),
      kv.hGet(K.pending, uid),
      kv.zRange(K.mine(uid), 0, 9, { by: 'rank', reverse: true }),
    ]);
    if (user['team']) {
      me.team = (await kv.hGet(K.names, user['team'])) ?? user['team'];
      me.canChangeTeam = !(user['tSeason'] === season && Number(user['tCount'] ?? 0) > 0);
    }
    me.record = { w: Number(rec['w'] ?? 0), l: Number(rec['l'] ?? 0), d: Number(rec['d'] ?? 0) };
    me.throwsLeft = Math.max(0, o.dailyLimit - Number(used ?? 0));
    me.pending = Math.max(0, Number(pend ?? 0));
    const throws = (await Promise.all(ids.map((r) => loadThrow(kv, r.member)))).filter((t): t is Throw => !!t);
    me.recent = throws.map(toMine);
    const seenAt = Number(user['seen'] ?? 0);
    const waitedIds = new Set(throws.filter((t) => t.waited).map((t) => t.id));
    me.news = me.recent.filter((t) => t.status === 'done' && waitedIds.has(t.id) && (t.resolvedAt ?? 0) > seenAt);
  }

  return {
    season,
    seasonEndsAt: seasonEnd(o.now),
    theme: o.theme,
    sponsorNote: o.sponsorNote,
    featured: o.featured,
    teams,
    rivalries,
    duels,
    duelists,
    ticker: feedRaw ? (JSON.parse(feedRaw) as Tick[]) : [],
    me,
  };
}

/** Marks everything resolved so far as seen. */
export async function ack(kv: KV, uid: string, now: number) {
  await kv.hSet(K.user(uid), { seen: String(now) });
}

function toMine(t: Throw): MyThrow {
  return t.res
    ? { id: t.id, kind: t.kind, move: t.move, at: t.at, status: 'done', result: t.res, oppTeam: t.oppTeam, oppName: t.oppName, oppMove: t.oppMove, resolvedAt: t.resAt }
    : { id: t.id, kind: t.kind, move: t.move, at: t.at, status: 'waiting' };
}

export async function topTeams(kv: KV, season: string, n: number): Promise<TeamRow[]> {
  const top = await kv.zRange(K.lb(season), 0, n - 1, { by: 'rank', reverse: true });
  if (!top.length) return [];
  const fields = top.flatMap((t) => ['w', 'l', 'd', 'p'].map((f) => `${t.member}:${f}`));
  const [vals, names] = await Promise.all([kv.hMGet(K.ts(season), fields), kv.hMGet(K.names, top.map((t) => t.member))]);
  return top.map((t, i) => ({
    name: names[i] ?? t.member,
    points: t.score,
    w: Number(vals[i * 4] ?? 0),
    l: Number(vals[i * 4 + 1] ?? 0),
    d: Number(vals[i * 4 + 2] ?? 0),
    players: Number(vals[i * 4 + 3] ?? 0),
  }));
}

async function topRivalries(kv: KV, season: string, n: number): Promise<Rivalry[]> {
  const top = await kv.zRange(K.rvz(season), 0, n - 1, { by: 'rank', reverse: true });
  if (!top.length) return [];
  const fields = top.flatMap((t) => ['aw', 'bw', 'd'].map((f) => `${t.member}:${f}`));
  const vals = await kv.hMGet(K.rv(season), fields);
  const ab = top.map((t) => t.member.split('|') as [string, string]);
  const names = await kv.hMGet(K.names, ab.flat());
  return top.map((_, i) => ({
    a: names[i * 2] ?? ab[i]![0],
    b: names[i * 2 + 1] ?? ab[i]![1],
    aw: Number(vals[i * 3] ?? 0),
    bw: Number(vals[i * 3 + 1] ?? 0),
    d: Number(vals[i * 3 + 2] ?? 0),
  }));
}
