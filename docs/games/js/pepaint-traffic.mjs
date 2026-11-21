// One in-flight drawing request per turn. The production RPC is the authority
// for the shared budget; the client merely batches edits and follows its pace.
export function makeDrawPump({ take, send, restore, closed = () => {}, now = Date.now }) {
  let epoch = 0, busy = false, nextAt = 0;
  return {
    reset(delay = 0) { epoch++; busy = false; nextAt = now() + delay; },
    async tick() {
      if (busy || now() < nextAt) return;
      const packet = take();
      if (!packet) return;
      const turn = epoch;
      busy = true;
      try {
        const result = await send(packet);
        if (turn !== epoch) return;
        if (result?.closed) { nextAt = Infinity; closed(); return; }
        if (result?.ok) nextAt = now() + Math.max(250, result.interval_ms || 250);
        else {
          restore(packet, false);
          nextAt = now() + Math.max(250, result?.retry_ms || 1000);
        }
      } catch {
        if (turn !== epoch) return;
        // Unknown transport outcome: resynchronize with the complete canvas
        // rather than replaying strokes that might already have arrived.
        restore(packet, true);
        nextAt = now() + 1500;
      } finally {
        if (turn === epoch) busy = false;
      }
    },
  };
}

// Leave headroom for the Realtime envelope and the server's JSON encoding.
export const MAX_DRAW_JSON = 200_000;
