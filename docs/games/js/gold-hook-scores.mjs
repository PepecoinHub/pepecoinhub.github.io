// Pepe Gold Hook high scores, in the shared PEP Games arcade table (games.arcade_scores).
// One call per round, and only when the player presses "Submit score". The top 10 is read at most
// once a minute. The browser sends the list of caught objects, never a point total: the server
// function public.gry_goldhook_submit (games/supabase/update_gold_hook.sql) counts the points itself.
import { GAME_ID } from './gold-hook-config.mjs';
import { validateRun } from './gold-hook-validation.mjs';

export const TOP_CACHE_MS = 60_000;

// Arguments for public.gry_goldhook_submit: no score field on purpose.
export function buildSubmission(result, nick) {
  return {
    p_nick: String(nick ?? ''),
    p_catches: result.run.catches.map((c) => ({ id: c.id, t: c.t })),
    p_ms: Math.round((result.durationSec - result.timeLeft) * 1000),
  };
}

// The PEP Games sign-in (Discord) keeps its session in this browser, like in PondOS (meme.js sbSession).
export function readSession(cfg, storage = globalThis.localStorage) {
  try {
    const ref = new URL(cfg.supabaseUrl).hostname.split('.')[0];
    const s = JSON.parse(storage.getItem(`sb-${ref}-auth-token`) || 'null');
    if (s && s.access_token && s.expires_at * 1000 > Date.now() + 30000 && !(s.user && s.user.is_anonymous)) {
      const ids = (s.user && s.user.identities) || [];
      return { token: s.access_token, discord: ids.some((i) => i.provider === 'discord') };
    }
  } catch { /* no storage or a broken value: play as a guest */ }
  return null;
}

// RPC over plain fetch (no library), with the public URL and publishable key from js/config.js.
export function fetchRpc(cfg, { fetchImpl = globalThis.fetch, storage } = {}) {
  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) return null;
  return async (name, args) => {
    const s = readSession(cfg, storage);
    const headers = { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' };
    if (s) headers.Authorization = `Bearer ${s.token}`;
    const r = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j && j.message) || 'The high score server did not answer');
    return j;
  };
}

// A missing server function (the SQL is not deployed yet) reads as "coming soon", as in PondOS LEADERS.
export function isNotDeployed(err) {
  return /function|PGRST|schema cache/i.test(String(err && err.message));
}

export function createScores(rpc, { now = () => Date.now() } = {}) {
  let cache = null;
  let inFlight = null;
  return {
    enabled: typeof rpc === 'function',
    async submit(result, nick) {
      const v = validateRun(result.run);
      if (!v.ok) throw new Error('That round does not add up');
      if (v.score <= 0) throw new Error('Nothing to submit');
      const data = await rpc('gry_goldhook_submit', buildSubmission(result, nick));
      cache = null;
      return data;                         // { nick, verified, place, score }
    },
    async top({ force = false } = {}) {
      if (!force && cache && now() - cache.at < TOP_CACHE_MS) return cache.rows;
      if (inFlight) return inFlight;
      inFlight = rpc('gry_arcade_top', { p_game: GAME_ID })
        .then((rows) => { cache = { at: now(), rows: Array.isArray(rows) ? rows : [] }; return cache.rows; })
        .finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
