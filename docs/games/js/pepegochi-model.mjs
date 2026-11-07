// PepeGochi v2 rules in plain JavaScript, for the browser test simulator (PR B1).
//
// The reference is games/supabase/update_pepegochi_v2.sql. This file copies its rules so a whole frog
// life can be played in a browser tab with a fast-forward clock, without a server. It must give exactly
// the same answers: tests/pepegochi-parity.test.mjs replays the same calls on the real SQL and on this
// file and compares every response.
//
// LOCAL ONLY. This module has no network access, no storage and no Supabase or Passport calls. Nothing it
// does is saved anywhere or reaches a player's account, and its milestones are never stamps.
//
// Exactness: needs are kept in 1/10000 units (the SQL numeric(7,4)), times in whole microseconds, and
// every rounding step follows PostgreSQL (numeric rounds half away from zero, interval * float rounds half
// to even). Decay is kept as an integer A = units * K - elapsed_us * per_day, K = 8 640 000.

export const DEFAULT_RULES = Object.freeze({
  version: 2,
  playtest: true,
  meaningful_below: 90,
  neglected_h: 48,
  packing_h: 120,
  departs_h: 168,
  rescue_from_h: 120,
  recovery_days: 1,
  recovery_departs_h: 72,
  recovery_min_gap_h: 8,
  max_actions_per_utc_day: 12,
  min_gap_s: 2,
  cooldown_min: Object.freeze({ feed: 30, clean: 20, play: 45, rest: 60 }),
  decay_per_day: Object.freeze({ hunger: 20, hygiene: 15, mood: 18, energy: 10 }),
  froglet_care_days: 2,
  adult_care_days: 7,
  history_limit: 10,
});

export const KINDS = ['feed', 'clean', 'play', 'rest'];
const NEED = { feed: 'hunger', clean: 'hygiene', play: 'mood', rest: 'energy' };
const NEEDS = ['hunger', 'hygiene', 'mood', 'energy'];
const DUE = { hunger: 'hunger_due_at', hygiene: 'hygiene_due_at', mood: 'mood_due_at', energy: 'energy_due_at' };
const LAST = { feed: 'last_feed_at', clean: 'last_clean_at', play: 'last_play_at', rest: 'last_rest_at' };
const COUNT = { feed: 'feeds', clean: 'cleans', play: 'plays', rest: 'rests' };

const UNIT = 10000;                  // 1 need point = 10000 units (numeric(7,4))
const K = 8640000;                   // A = units * K - elapsed_us * per_day
const POINT_A = UNIT * K;            // one need point in A
const MAX_A = 100 * POINT_A;
const US_DAY = 86400e6, US_HOUR = 3600e6, US_MIN = 60e6, US_SEC = 1e6;

// ---------- errors (same messages and codes as the SQL) ----------
export class PepegochiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
export const MESSAGES = {
  unknown_action: ['Unknown care action', '22023'],
  adopt_first: ['Adopt a Fren first', 'P0001'],
  wait: ['Wait a moment before the next care action', 'P0001'],
  limit: ['Daily care action limit reached', 'P0001'],
  cooldown: ['That action is cooling down', 'P0001'],
  not_needed: ['Your Fren does not need that right now', 'P0001'],
  bad_name: ['Name must be 2-18 letters, numbers, spaces, dots, dashes or underscores', '22023'],
};
const fail = k => { throw new PepegochiError(...MESSAGES[k]); };

// ---------- integer helpers ----------
const fdiv = (a, b) => { const r = ((a % b) + b) % b; return (a - r) / b; };     // floor(a / b), exact
const roundHalfAway = (n, d) => {                                                  // round(n / d), d > 0
  const s = n < 0 ? -1 : 1, m = Math.abs(n), r = m % d, q = (m - r) / d;
  return s * (2 * r >= d ? q + 1 : q);
};
const rint = x => {                                                                 // C rint(): half to even
  const f = Math.floor(x), diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};
const span = (n, unit) => rint(Number(n) * unit);    // PostgreSQL numeric * interval (via float8)
const num = v => Number(v);

// ---------- time ----------
export const toUs = v => {
  if (typeof v === 'number') return Math.round(v) * 1000;             // milliseconds
  if (v instanceof Date) return v.getTime() * 1000;
  if (typeof v === 'string') return parseTimestampUs(v);
  throw new TypeError('time: use a Date, milliseconds or an ISO string');
};
// "2026-11-16T07:12:00.432+00:00", "...Z", "infinity" -> microseconds since 1970 (UTC)
export function parseTimestampUs(s) {
  if (s === 'infinity') return Infinity;
  if (s === '-infinity') return -Infinity;
  const m = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d):(\d\d)(?:\.(\d{1,6}))?(Z|[+-]\d\d(?::?\d\d)?)?$/.exec(s);
  if (!m) throw new TypeError('not a timestamp: ' + s);
  let us = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) * 1000 + Number((m[7] || '').padEnd(6, '0') || 0);
  if (m[8] && m[8] !== 'Z') {
    const sign = m[8][0] === '-' ? -1 : 1;
    const hh = Number(m[8].slice(1, 3)), mm = Number(m[8].slice(3).replace(':', '') || 0);
    us -= sign * (hh * 60 + mm) * US_MIN;
  }
  return us;
}
const p2 = n => String(n).padStart(2, '0');
// the way PostgreSQL writes a timestamptz into JSON in a UTC session
export function isoUs(us) {
  if (us === Infinity) return 'infinity';
  if (us === -Infinity) return '-infinity';
  const sec = fdiv(us, US_SEC), d = new Date(sec * 1000);
  const micro = String(us - sec * US_SEC).padStart(6, '0').replace(/0+$/, '');
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`
    + (micro ? '.' + micro : '') + '+00:00';
}
const dayOf = us => fdiv(us, US_DAY);                                  // UTC day number
const dayText = day => new Date(day * 86400e3).toISOString().slice(0, 10);

// ---------- rules ----------
// Base rules plus overrides with dotted keys, like scripts/pepegochi_sim.mjs --rule.
export function makeRules(overrides = {}) {
  const r = JSON.parse(JSON.stringify(DEFAULT_RULES));
  for (const [k, v] of Object.entries(overrides)) {
    const path = k.split('.'); let o = r;
    while (path.length > 1) { const p = path.shift(); if (typeof o[p] !== 'object') throw new Error('Unknown rule ' + k); o = o[p]; }
    if (!(path[0] in o)) throw new Error('Unknown rule ' + k);
    o[path[0]] = v;
  }
  return r;
}

// ---------- one local player ----------
export function createWorld() {
  return { owner: null, lives: [], milestones: [] };
}
const newest = w => w.lives[w.lives.length - 1] || null;

// When a need starts waiting for care (games.pepegochi_due).
function due(A, prev, t, acted, perDay, thrA) {
  if (A >= thrA) return perDay > 0 ? t + roundHalfAway(A - thrA, perDay) : Infinity;
  if (acted) return t;
  return Math.min(prev, t);
}

// Current needs (A form), the most neglected need, the departure moment and the status (games.pepegochi_eval).
export function evaluate(l, t, r) {
  const clocks = NEEDS.map(n => l[DUE[n]] ?? l.adopted_at);
  let oldestKind = 'feed', oldestAt = clocks[0];
  for (let i = 1; i < 4; i++) if (clocks[i] < oldestAt) { oldestKind = KINDS[i]; oldestAt = clocks[i]; }
  const careAt = l.last_action_at ?? l.adopted_at;
  if (l.status === 'departed') {
    const A = {}; for (const n of NEEDS) A[n] = l[n] * K;
    return { A, oldestKind, oldestAt, careAt, departsAt: l.departed_at, reason: l.departure_reason, status: 'departed' };
  }
  let departsAt = oldestAt + span(r.departs_h, US_HOUR), reason = oldestKind;
  if (l.recovery_days_left > 0) {
    const byRecovery = careAt + span(r.recovery_departs_h, US_HOUR);
    if (byRecovery < departsAt) { departsAt = byRecovery; reason = 'recovery'; }
  }
  const E = Math.max(0, Math.min(t, departsAt) - l.needs_at);
  const A = {};
  for (const n of NEEDS) A[n] = Math.max(0, l[n] * K - E * num(r.decay_per_day[n]));
  const age = t - oldestAt, idle = t - careAt;
  let status;
  if (t >= departsAt) status = 'departed';
  else if (l.recovery_days_left > 0) status = idle >= span(r.neglected_h, US_HOUR) ? 'packing' : 'recovering';
  else if (age >= span(r.packing_h, US_HOUR)) status = 'packing';
  else if (age >= span(r.neglected_h, US_HOUR)) status = 'neglected';
  else status = 'healthy';
  return { A, oldestKind, oldestAt, careAt, departsAt, reason, status };
}
const pts = A => fdiv(A, POINT_A);                                           // floor(need) for the UI
const storeUnits = A => roundHalfAway(A, K);                                 // numeric(7,4)

const stageOf = (l, r) => (l.care_days >= r.adult_care_days ? 'adult' : l.care_days >= r.froglet_care_days ? 'froglet' : 'tadpole');
const daysBetween = (a, b) => fdiv(b - a, US_DAY);

// The full state, the same JSON as games.pepegochi_view.
export function view(w, t, r) {
  const l = newest(w);
  if (!l) {
    return { version: 2, server_now: isoUs(t), rules: r, has_pet: false, can_adopt: true, pet: null, history: [],
      summary: { frens_adopted: 0, former_frens: 0, longest_friendship_days: 0, first_departed_at: null } };
  }
  const e = evaluate(l, t, r);
  const departed = e.status === 'departed';
  const stage = stageOf(l, r);
  let pet;
  if (departed) {
    pet = {
      life_id: l.life_id, generation: l.generation, name: l.pet_name, adopted_at: isoUs(l.adopted_at),
      stage, care_days: l.care_days, status: 'departed', departed_at: isoUs(e.departsAt),
      departure_saved: l.status === 'departed', departure_reason: e.reason,
      days_together: daysBetween(l.adopted_at, e.departsAt),
      letter: { variant: l.letter_variant ?? 'classic', seen: l.letter_seen_at != null },
    };
  } else {
    const age = t - e.oldestAt;
    const overdue = l.recovery_days_left === 0
      ? KINDS.filter((k, i) => t - (l[DUE[NEEDS[i]]] ?? l.adopted_at) >= span(r.neglected_h, US_HOUR)) : [];
    const today = l.action_day_utc === dayOf(t) ? l.actions_today : 0;
    const plus = (at, n, unit) => (at == null ? null : isoUs(at + span(n, unit)));
    pet = {
      life_id: l.life_id, generation: l.generation, name: l.pet_name, adopted_at: isoUs(l.adopted_at),
      life_day: daysBetween(l.adopted_at, t) + 1,
      stage,
      next_growth_care_days: stage === 'tadpole' ? r.froglet_care_days : stage === 'froglet' ? r.adult_care_days : null,
      care_days: l.care_days,
      last_care_day_utc: l.last_care_day_utc == null ? null : dayText(l.last_care_day_utc),
      status: e.status,
      needs: { hunger: pts(e.A.hunger), hygiene: pts(e.A.hygiene), mood: pts(e.A.mood), energy: pts(e.A.energy) },
      waiting_since: Object.fromEntries(KINDS.map((k, i) => [k, isoUs(l[DUE[NEEDS[i]]] ?? l.adopted_at)])),
      most_neglected: e.oldestKind,
      most_neglected_since: isoUs(e.oldestAt),
      overdue,
      rescue_starts_recovery: l.recovery_days_left === 0 && (l.rescue_pending || age >= span(r.rescue_from_h, US_HOUR)),
      recovery: l.recovery_days_left > 0 ? {
        days_left: l.recovery_days_left, last_day_utc: l.recovery_day_utc == null ? null : dayText(l.recovery_day_utc),
        counts_from: isoUs(Math.max((l.recovery_day_utc + 1) * US_DAY, l.recovery_since + span(r.recovery_min_gap_h, US_HOUR))),
      } : null,
      departs_at: isoUs(e.departsAt),
      departure_reason: e.reason,
      cooldowns: {
        feed: plus(l.last_feed_at, r.cooldown_min.feed, US_MIN), clean: plus(l.last_clean_at, r.cooldown_min.clean, US_MIN),
        play: plus(l.last_play_at, r.cooldown_min.play, US_MIN), rest: plus(l.last_rest_at, r.cooldown_min.rest, US_MIN),
        any_action: plus(l.last_action_at, r.min_gap_s, US_SEC),
      },
      action_budget: { accepted_today: today, max_per_utc_day: r.max_actions_per_utc_day },
    };
  }
  const earlier = w.lives.filter(x => x.generation < l.generation);
  const history = earlier.slice().sort((a, b) => b.generation - a.generation).slice(0, r.history_limit).map(h => ({
    generation: h.generation, name: h.pet_name, adopted_at: isoUs(h.adopted_at), departed_at: isoUs(h.departed_at),
    days_together: daysBetween(h.adopted_at, h.departed_at), care_days: h.care_days, departure_reason: h.departure_reason,
  }));
  let former = earlier.length;
  let longest = earlier.reduce((m, h) => Math.max(m, daysBetween(h.adopted_at, h.departed_at)), 0);
  let firstLeft = earlier.reduce((m, h) => (m == null || h.departed_at < m ? h.departed_at : m), null);
  if (departed) { former += 1; firstLeft = firstLeft == null ? e.departsAt : Math.min(firstLeft, e.departsAt); }
  longest = Math.max(longest, daysBetween(l.adopted_at, departed ? e.departsAt : t));
  return {
    version: 2, server_now: isoUs(t), rules: r, has_pet: !departed,
    can_adopt: departed && l.letter_seen_at != null,
    pet, history,
    summary: { frens_adopted: l.generation, former_frens: former, longest_friendship_days: longest,
      first_departed_at: firstLeft == null ? null : isoUs(firstLeft) },
  };
}

// Writes "moved out" once if the frog is due (games.pepegochi_settle).
function settle(l, t, r) {
  if (l.status !== 'active') return false;
  const e = evaluate(l, t, r);
  if (e.status !== 'departed') return false;
  Object.assign(l, { status: 'departed', departed_at: e.departsAt, departure_reason: e.reason, letter_variant: 'classic',
    needs_at: e.departsAt });
  for (const n of NEEDS) l[n] = storeUnits(e.A[n]);
  return true;
}

function milestone(w, m, l, t) {
  if (!w.milestones.some(x => x.milestone === m)) w.milestones.push({ milestone: m, generation: l.generation, reached_at: t });
}

const NAME = /^[\p{L}\p{N} _.-]+$/u;   // the server's [[:alnum:] _.-]; the server has the final word
function cleanName(p) {
  const raw = p == null ? '' : String(p);
  const chars = [...raw];
  const cleaned = chars.slice(0, 64).join('').replace(/^ +| +$/g, '');
  const n = [...cleaned].length;
  if (chars.length > 64 || n < 2 || n > 18 || !NAME.test(cleaned)) fail('bad_name');
  return cleaned;
}

// ---------- the four RPCs ----------
export function adopt(w, pName, t, r) {
  const name = cleanName(pName);
  if (!w.owner) w.owner = { created_at: t };
  const l = newest(w);
  if (l) {
    if (l.status === 'active') {
      if (!settle(l, t, r)) return { ...view(w, t, r), adopt_result: 'already_have_fren' };
      return { ...view(w, t, r), adopt_result: 'read_the_letter_first' };
    }
    if (l.letter_seen_at == null) return { ...view(w, t, r), adopt_result: 'read_the_letter_first' };
  }
  const gen = (l?.generation ?? 0) + 1;
  const life = {
    life_id: 'local-' + gen, generation: gen, pet_name: name, adopted_at: t,
    hunger: 75 * UNIT, hygiene: 80 * UNIT, mood: 80 * UNIT, energy: 75 * UNIT, needs_at: t,
    care_days: 0, last_care_day_utc: null,
    hunger_due_at: null, hygiene_due_at: null, mood_due_at: null, energy_due_at: null,
    last_feed_at: null, last_clean_at: null, last_play_at: null, last_rest_at: null, last_action_at: null,
    rescue_pending: false, recovery_days_left: 0, recovery_day_utc: null, recovery_since: null,
    action_day_utc: null, actions_today: 0, feeds: 0, cleans: 0, plays: 0, rests: 0,
    status: 'active', departed_at: null, departure_reason: null, letter_variant: null, letter_seen_at: null,
  };
  w.lives.push(life);
  milestone(w, 'first_adoption', life, t);
  return { ...view(w, t, r), adopt_result: 'adopted' };
}

export function action(w, kind, t, r) {
  if (kind == null || !KINDS.includes(kind)) fail('unknown_action');
  if (!w.owner) fail('adopt_first');
  const l = newest(w);
  if (!l || l.status !== 'active') return { ...view(w, t, r), action_result: 'moved_out' };
  const e = evaluate(l, t, r);
  if (e.status === 'departed') { settle(l, t, r); return { ...view(w, t, r), action_result: 'moved_out' }; }

  const day = dayOf(t);
  const todayCount = l.action_day_utc === day ? l.actions_today : 0;
  if (l.last_action_at != null && t < l.last_action_at + span(r.min_gap_s, US_SEC)) fail('wait');
  if (todayCount >= r.max_actions_per_utc_day) fail('limit');
  const lastKind = l[LAST[kind]];
  if (lastKind != null && t < lastKind + span(r.cooldown_min[kind], US_MIN)) fail('cooldown');
  const thrA = Math.round(num(r.meaningful_below) * UNIT) * K;
  if (e.A[NEED[kind]] >= thrA) fail('not_needed');

  const A = { ...e.A };
  const add = (n, p) => { A[n] = Math.min(MAX_A, A[n] + p * POINT_A); };
  const sub = (n, p) => { A[n] = Math.max(0, A[n] - p * POINT_A); };
  if (kind === 'feed') add('hunger', 35);
  else if (kind === 'clean') add('hygiene', 40);
  else if (kind === 'play') { add('mood', 35); sub('energy', 10); sub('hunger', 3); }
  else { add('energy', 40); add('mood', 5); }

  const dues = {};
  for (const n of NEEDS)
    dues[n] = due(A[n], l[DUE[n]] ?? l.adopted_at, t, NEED[kind] === n, num(r.decay_per_day[n]), thrA);
  const newOldest = Math.min(...NEEDS.map(n => dues[n]));
  const wasAge = t - e.oldestAt;
  const newCareDay = l.last_care_day_utc !== day;
  let rescue = l.rescue_pending, recLeft = l.recovery_days_left, recDay = l.recovery_day_utc, recSince = l.recovery_since;
  if (recLeft > 0) {
    if ((recDay == null || day > recDay) && (recSince == null || t >= recSince + span(r.recovery_min_gap_h, US_HOUR))) {
      recLeft -= 1; recDay = day; recSince = t;
    }
  } else {
    if (wasAge >= span(r.rescue_from_h, US_HOUR)) rescue = true;
    if (rescue && t - newOldest < span(r.neglected_h, US_HOUR)) {
      rescue = false; recLeft = r.recovery_days; recDay = day; recSince = t;
    }
  }

  for (const n of NEEDS) { l[n] = storeUnits(A[n]); l[DUE[n]] = dues[n]; }
  l.needs_at = t;
  l.last_action_at = t;
  l[LAST[kind]] = t;
  l[COUNT[kind]] += 1;
  l.action_day_utc = day;
  l.actions_today = todayCount + 1;
  if (newCareDay) l.care_days += 1;
  l.last_care_day_utc = day;
  Object.assign(l, { rescue_pending: rescue, recovery_days_left: recLeft, recovery_day_utc: recDay, recovery_since: recSince });
  if (newCareDay) {
    if (l.care_days >= r.froglet_care_days) milestone(w, 'froglet', l, t);
    if (l.care_days >= r.adult_care_days) milestone(w, 'adult', l, t);
  }
  return { ...view(w, t, r), action_result: 'accepted' };
}

export function letterRead(w, t, r) {
  if (!w.owner) return view(w, t, r);
  const l = newest(w);
  if (l) {
    if (l.status === 'active') settle(l, t, r);
    if (l.status === 'departed' && l.letter_seen_at == null) l.letter_seen_at = t;
  }
  return view(w, t, r);
}

export function state(w, t, r) { return view(w, t, r); }

// Calls one RPC by its server name, at time t (microseconds).
export function call(w, name, args, t, r) {
  switch (name) {
    case 'gry_pepegochi_state': return state(w, t, r);
    case 'gry_pepegochi_adopt': return adopt(w, args?.p_name, t, r);
    case 'gry_pepegochi_action': return action(w, args?.p_action, t, r);
    case 'gry_pepegochi_letter_read': return letterRead(w, t, r);
    default: throw new Error('Unknown PepeGochi RPC ' + name);
  }
}

// A local player with a virtual clock, for the test simulator page and tests. Every response says
// local_preview: true. It keeps everything in memory: a reload starts again.
export class LocalPepegochi {
  constructor({ start = Date.UTC(2026, 10, 9, 18), rules = {} } = {}) {
    this.world = createWorld();
    this.now = toUs(start);
    this.rules = makeRules(rules);
  }
  setRules(overrides = {}) { this.rules = makeRules(overrides); }
  advance(ms) { this.now += Math.round(ms) * 1000; }
  rpc(name, args = {}, at = null) {
    const t = at == null ? this.now : toUs(at);
    try {
      return { ok: true, value: { ...call(this.world, name, args, t, this.rules), local_preview: true } };
    } catch (e) {
      if (e instanceof PepegochiError) return { ok: false, error: e.message, code: e.code };
      throw e;
    }
  }
}
