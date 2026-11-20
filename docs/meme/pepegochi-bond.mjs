import { TOYS, MEMORIES, favouriteToy } from './pepegochi-personality.mjs?v=20261116sass1';
// Browser-local memories, scoped to the signed-in owner and this frog's life.
// These are conversation cues, never care, growth, currency or achievement state.
export function createBond({ storage, now = () => Date.now() } = {}) {
  let key = null, memory = {}, previous = null, pending = null;
  let awardCue = null;
  const save = () => { if (key) try { storage?.setItem(key, JSON.stringify(memory)); } catch {} };
  function observe(owner, pet) {
    let event = null;
    const next = owner && pet?.life_id && pet.status !== 'departed'
      ? 'pepegochi:bond:v1:' + owner + ':' + pet.life_id : null;
    if (next !== key) {
      key = next; memory = {}; previous = null; pending = null; awardCue = null;
      if (key) try {
        const raw = JSON.parse(storage?.getItem(key) || '{}');
        if (raw && typeof raw === 'object') memory = {
          seen: Number.isFinite(raw.seen) ? raw.seen : 0,
          pets: Number.isFinite(raw.pets) ? Math.max(0, Math.min(1000, raw.pets)) : 0,
          muted: raw.muted === true,
          plays: Number.isFinite(raw.plays) ? Math.max(0, Math.min(1000, raw.plays)) : 0,
          playedAt: Number.isFinite(raw.playedAt) ? raw.playedAt : 0,
          invitedAt: Number.isFinite(raw.invitedAt) ? raw.invitedAt : 0,
          journal: Array.isArray(raw.journal) ? [...new Set(raw.journal.filter(k => Object.hasOwn(MEMORIES, k)))].slice(0, 4) : [],
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
  function keep(event) {
    if (!key || !Object.hasOwn(MEMORIES, event)) return;
    memory.journal = [...new Set([...(memory.journal || []), event])].slice(0, 4); save();
  }
  return {
    observe,
    get favourite() { return key ? favouriteToy(key) : null; },
    get discovered() { return (memory.plays || 0) >= 3; },
    get journal() { return (memory.journal || []).map(k => MEMORIES[k]); },
    keep,
    play(toy) {
      if (!key || !Object.hasOwn(TOYS, toy)) return null;
      if (memory.playedAt && now() - memory.playedAt < 30000) return 'toyAgain';
      memory.playedAt = now(); memory.plays = Math.min(1000, (memory.plays || 0) + 1);
      const favourite = toy === favouriteToy(key);
      if (favourite && memory.plays >= 3) keep('toy');
      save(); return favourite ? 'toyFavourite' : 'toyOkay';
    },
    invite() {
      if (!key || memory.muted || (memory.invitedAt && now() - memory.invitedAt < 8 * 60000)) return false;
      memory.invitedAt = now(); save(); return true;
    },
    reset() { key = null; memory = {}; previous = null; pending = null; awardCue = null; },
    remember(event) {
      if (!key) return;
      if (['stamp', 'stampBatch', 'secret'].includes(event)) awardCue = event;
      else pending = event;
    },
    take() { if (awardCue) { const event = awardCue; awardCue = null; return event; } const event = pending; pending = null; return event; },
    consumeCare(event) { if (pending === event) pending = null; },
    touch() { if (key) { memory.seen = now(); save(); } },
    pet() { if (key) { memory.pets = Math.min(1000, (memory.pets || 0) + 1); save(); } },
    get familiar() { return (memory.pets || 0) >= 3; },
    get muted() { return memory.muted === true; },
    toggleMute() { memory.muted = !memory.muted; save(); return memory.muted; },
  };
}
