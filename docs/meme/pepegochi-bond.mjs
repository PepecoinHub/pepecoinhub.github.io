// Browser-local memories, scoped to the signed-in owner and this frog's life.
// These are conversation cues, never care, growth, currency or achievement state.
export function createBond({ storage, now = () => Date.now() } = {}) {
  let key = null, memory = {}, previous = null, pending = null;
  const save = () => { if (key) try { storage?.setItem(key, JSON.stringify(memory)); } catch {} };
  function observe(owner, pet) {
    let event = null;
    const next = owner && pet?.life_id && pet.status !== 'departed'
      ? 'pepegochi:bond:v1:' + owner + ':' + pet.life_id : null;
    if (next !== key) {
      key = next; memory = {}; previous = null; pending = null;
      if (key) try {
        const raw = JSON.parse(storage?.getItem(key) || '{}');
        if (raw && typeof raw === 'object') memory = {
          seen: Number.isFinite(raw.seen) ? raw.seen : 0,
          pets: Number.isFinite(raw.pets) ? Math.max(0, Math.min(1000, raw.pets)) : 0,
          muted: raw.muted === true,
        };
      } catch {}
    }
    if (!key) return null;
    if (memory.seen > 0 && now() - memory.seen >= 30 * 60000) event = 'return';
    if (previous) {
      if (previous.stage !== pet.stage) event = 'grown';
      else {
        const care = ['hunger', 'hygiene', 'mood', 'energy'].find(n =>
          Number.isFinite(pet.needs?.[n]) && Number.isFinite(previous.needs?.[n]) && pet.needs[n] > previous.needs[n] + 5);
        if (care) event = { hunger: 'fed', hygiene: 'clean', mood: 'played', energy: 'rested' }[care];
      }
    }
    previous = { stage: pet.stage, needs: { ...pet.needs } };
    memory.seen = now(); save();
    if (event) pending = event;
    return event;
  }
  return {
    observe,
    reset() { key = null; memory = {}; previous = null; pending = null; },
    remember(event) { if (key) pending = event; },
    take() { const event = pending; pending = null; return event; },
    touch() { if (key) { memory.seen = now(); save(); } },
    pet() { if (key) { memory.pets = Math.min(1000, (memory.pets || 0) + 1); save(); } },
    get familiar() { return (memory.pets || 0) >= 3; },
    get muted() { return memory.muted === true; },
    toggleMute() { memory.muted = !memory.muted; save(); return memory.muted; },
  };
}
