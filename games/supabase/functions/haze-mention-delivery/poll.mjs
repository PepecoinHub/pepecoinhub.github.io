// Adaptive polling hint for the Haze mention worker. Shared by the Edge Function and node tests.
// The sender heartbeat (games.haze_mention_sender) must stay younger than 3 minutes for phone registration to
// work, so the slowest hint (IDLE) is well inside that window even if one poll is lost.
export const IDLE = 60, DRAINING = 5, BURST = 1, BATCH = 10;
const clamp = n => { const v = Math.round(Number(n)); return Number.isFinite(v) && n !== null && n !== '' ? Math.max(BURST, Math.min(IDLE, v)) : IDLE; };

// rpc: either the legacy array of claimed items, or {items, poll_after} from update_haze_mentions_adaptive.sql.
export function pollAfter(rpc) {
  if (rpc && !Array.isArray(rpc) && Array.isArray(rpc.items)) {
    const items = rpc.items;
    const seconds = items.length >= BATCH ? BURST : clamp(rpc.poll_after);
    return { body: items, seconds };
  }
  const items = Array.isArray(rpc) ? rpc : [];
  return { body: items, seconds: items.length >= BATCH ? BURST : items.length ? DRAINING : IDLE };
}
