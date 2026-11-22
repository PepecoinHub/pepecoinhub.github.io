// PepeGochi read cache (2026-11-22). Wraps an rpc(name, args) function used by the taskbar frog (pepegochi-taskbar.mjs)
// and by PEPEGOCHI.EXE in its iframe (docs/games/js/pepegochi-live.mjs) so that:
//  * identical reads in flight at the same time become one request (dedupe), also across the PondOS page and the
//    same-origin room iframe (the store lives on the top window when it is reachable);
//  * a read answered in the last few seconds is reused per account (short TTL, never across accounts);
//  * a write (care action, adopt, trip, ...) drops that account's cached reads, and a write that answers with the
//    full state seeds the state cache, so the "changed" ping between room and taskbar does not cost another read;
//  * a function that the database does not have (PostgREST 404 / PGRST202) is not called again for a while
//    (capability gate), instead of a 404 on every refresh.
// The server stays the only source of truth: nothing here is persisted except the "function missing" flag,
// cached values live seconds, and every write goes straight to the server.

// read -> milliseconds a fresh answer may be reused
export const READ_TTL = {
  gry_pepegochi_state: 15000,
  gry_pepegochi_life: 60000,
  gry_pepegochi_room_state: 60000,
  gry_map_notes: 5 * 60000,
};
// writes that answer with the full pet state (pepegochi-live-view.mjs: rpc -> full state)
export const STATE_WRITES = new Set(['gry_pepegochi_action', 'gry_pepegochi_adopt', 'gry_pepegochi_letter_read', 'gry_pepegochi_settle']);
// writes that answer with the life state (pepegochi-live.mjs takeLife)
export const LIFE_WRITES = new Set(['gry_pepegochi_trip_start', 'gry_pepegochi_trip_claim', 'gry_pepegochi_water']);
// optional functions: when missing, skip them for this long (a deploy is picked up after a reload or this window)
export const MISSING_MS = 6 * 3600e3;
// writes that can change what the cached reads return (any other function passes straight through)
export const isWrite = fn => (/^gry_pepegochi_/.test(fn) && !Object.hasOwn(READ_TTL, fn)) || fn === 'gry_map_note' || fn === 'gry_quiz_answer';
// gry_quiz_today and gry_quiz_board are deduplicated but not cached here (the taskbar caches the day's question)
const DEDUPE_ONLY = new Set(['gry_quiz_today', 'gry_quiz_board']);
const MISSING_RE = /PGRST202|could not find the function/i;
const MISSING_KEY = 'pepegochi:missing-rpc';
const INFLIGHT_MS = 15000, LATE = Symbol('late');

export function isMissingFunction(e) {
  return !!e && (e.status === 404 || e.code === 'PGRST202' || MISSING_RE.test(String(e.message || e)));
}

function hostWindow(win) {
  try { if (win.top && win.top !== win && win.top.location.origin === win.location.origin) return win.top; } catch (_) { /* cross-origin top */ }
  return win;
}
function sharedStore(win) {
  const host = win ? hostWindow(win) : null;
  if (!host) return { cache: new Map(), inflight: new Map(), missing: new Map(), gen: new Map() };
  // built with the top window's own Map, so it outlives a closed room iframe
  const M = host.Map || Map;
  if (!host.__pepegochiRpc) host.__pepegochiRpc = { cache: new M(), inflight: new M(), missing: new M(), gen: new M() };
  return host.__pepegochiRpc;
}
const clone = v => { try { return v == null ? v : structuredClone(v); } catch (_) { return JSON.parse(JSON.stringify(v)); } };
const keyOf = (who, fn, args) => who + '|' + fn + '|' + JSON.stringify(args || {});

// rpc: the page's own rpc(name, args); who(): the signed-in account id (null for none)
export function cachedRpc(rpc, who, { win = typeof window === 'undefined' ? null : window, now = () => Date.now(), storage, stats } = {}) {
  const store = sharedStore(win);
  let ls = storage;
  if (ls === undefined) { try { ls = win && win.localStorage; } catch (_) { ls = null; } }
  // the missing-function flags survive a reload, so a closed and reopened PondOS does not 404 again at once
  try {
    const saved = JSON.parse((ls && ls.getItem(MISSING_KEY)) || '{}');
    for (const [fn, at] of Object.entries(saved)) if (now() - at < MISSING_MS && !store.missing.has(fn)) store.missing.set(fn, at);
  } catch (_) { /* no storage */ }
  const saveMissing = () => { try { ls && ls.setItem(MISSING_KEY, JSON.stringify(Object.fromEntries(store.missing))); } catch (_) {} };
  const count = k => { if (stats) stats[k] = (stats[k] || 0) + 1; };
  const gen = id => store.gen.get(id) || 0;
  const invalidate = id => {
    store.gen.set(id, gen(id) + 1);
    for (const k of [...store.cache.keys()]) if (k.startsWith(id + '|')) store.cache.delete(k);
    for (const k of [...store.inflight.keys()]) if (k.startsWith(id + '|')) store.inflight.delete(k);
  };
  const put = (id, fn, args, value) => store.cache.set(keyOf(id, fn, args), { at: now(), value: clone(value), ttl: READ_TTL[fn] });

  async function call(fn, args = {}) {
    const id = (who && who()) || 'anon';
    const at = store.missing.get(fn);
    if (at != null) {
      if (now() - at < MISSING_MS) { count('gated'); const e = new Error('Not installed on the server yet: ' + fn); e.missing = true; e.status = 404; throw e; }
      store.missing.delete(fn); saveMissing();
    }
    const read = Object.hasOwn(READ_TTL, fn) || DEDUPE_ONLY.has(fn);
    const key = keyOf(id, fn, args);
    if (read) {
      const hit = store.cache.get(key);
      if (hit && now() - hit.at < hit.ttl) { count('cached'); return clone(hit.value); }
      const live = store.inflight.get(key);
      if (live && now() - live.at < INFLIGHT_MS) {
        // a request started by a room iframe that was closed meanwhile never settles: wait at most until it is
        // INFLIGHT_MS old, then ask ourselves
        let timer;
        const late = new Promise(resolve => { timer = setTimeout(resolve, Math.max(0, INFLIGHT_MS - (now() - live.at)), LATE); });
        try {
          const v = await Promise.race([live.p, late]);
          if (v !== LATE) { count('deduped'); return clone(v); }
        } finally { clearTimeout(timer); }   // a failed shared request fails here too (no second request)
        if (store.inflight.get(key) === live) store.inflight.delete(key);
      }
    }
    const g = gen(id);
    count('sent');
    const p = Promise.resolve().then(() => rpc(fn, args));
    if (read) store.inflight.set(key, { p, at: now() });
    try {
      const v = await p;
      if (read) {
        if (Object.hasOwn(READ_TTL, fn) && gen(id) === g) put(id, fn, args, v);
      } else if (isWrite(fn)) {
        // any write may change what the reads return: drop them, then keep what the write itself told us
        invalidate(id);
        if (STATE_WRITES.has(fn) && v && typeof v === 'object' && v.pet !== undefined) put(id, 'gry_pepegochi_state', {}, v);
        if (LIFE_WRITES.has(fn) && v && typeof v === 'object') put(id, 'gry_pepegochi_life', {}, v);
      }
      return clone(v);
    } catch (e) {
      if (isMissingFunction(e)) { store.missing.set(fn, now()); saveMissing(); count('missing'); }
      throw e;
    } finally {
      const cur = store.inflight.get(key);
      if (cur && cur.p === p) store.inflight.delete(key);
    }
  }
  call.invalidate = (id = (who && who()) || 'anon') => invalidate(id);
  call.forget = () => { store.cache.clear(); store.inflight.clear(); };
  call.isMissing = fn => { const at = store.missing.get(fn); return at != null && now() - at < MISSING_MS; };
  return call;
}
