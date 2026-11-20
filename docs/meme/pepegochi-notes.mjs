// PepeGochi's notes: the secret clues the frog gives and the table in its room where they stay.
// Owner rules (byl, 2026-11-20):
//  - Clues start at 50 good care days of the same frog, then one every 10 good care days (50, 60, 70...),
//    only while the frog is healthy and well looked after. One clue is about one secret the player has not found.
//  - Before day 50 the frog may, at most once every few days, say it would like to tell a secret but does not
//    trust you enough yet.
//  - A player who has found every secret gets neither.
//  - Every important message (the clues, the "I trust you now" note) lies on the table in the room, to read again.
// Cosmetic only: no reward, no RPC of its own. Notes live in this browser (per account and per frog life).
import { TRAILS } from './pepegochi-rumors.mjs?v=20261120notes1';

export const CLUE_FROM = 50, CLUE_EVERY = 10, TEASE_GAP_DAYS = 3, WELL_KEPT = 75;
const DAY = 86400000;

// clues unlocked by this many good care days: 50 -> 1, 59 -> 1, 60 -> 2 ...
export const cluesUnlocked = goodDays => goodDays >= CLUE_FROM ? Math.floor((goodDays - CLUE_FROM) / CLUE_EVERY) + 1 : 0;
// the good care day the next clue arrives on
export const nextClueDay = given => CLUE_FROM + given * CLUE_EVERY;

// "healthy and well looked after": a living froglet or adult, no warning, every need at 75 or more
export const wellKept = view => view?.hasPet === true && !view.warning && view.healthy === true &&
  (view.stage === 'froglet' || view.stage === 'adult') && view.needsOk === true;

export const notesKey = (owner, lifeId) => owner && lifeId ? 'pepegochi:notes:v1:' + owner + ':' + lifeId : null;

const TEASES = [
  'Psst… I know something about this pond that most frens never notice. Not yet, though. I still have to trust you a little more.',
  'Some day I will tell you a secret, fren. A frog has to be sure first. Keep looking after me.',
  'There are things in PondOS I have never told anyone. Maybe, if you keep coming back, I will tell you one.',
  'I almost told you something just now. Almost. Give it time, fren.',
];
export const TRUST_NOTE = 'You have looked after me for 50 good days. I trust you now, fren. From today, every ten good days I will tell you one little thing about this pond that most frens never find. I will leave each one here on the table, so you can read it again.';

// A stable order of the secrets for each frog life, so two frogs do not always start with the same clue.
export function clueOrder(lifeId) {
  let h = 2166136261;
  for (const ch of String(lifeId || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const ids = TRAILS.map(t => t[0]);
  for (let i = ids.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

const clean = raw => {
  const notes = Array.isArray(raw?.notes) ? raw.notes.filter(n => n && typeof n.text === 'string' &&
    (n.kind === 'trust' || (n.kind === 'clue' && TRAILS.some(t => t[0] === n.secret)))).slice(0, 40) : [];
  return { notes, teaseDay: Number.isInteger(raw?.teaseDay) ? raw.teaseDay : null, teaseWon: raw?.teaseWon === true,
    teaseAt: Number.isFinite(raw?.teaseAt) ? raw.teaseAt : null };
};

export function readNotes(storage, key) {
  if (!storage || !key) return clean(null);
  try { return clean(JSON.parse(storage.getItem(key) || 'null')); } catch { return clean(null); }
}

// Read only, for the room page (pepegochi-live.mjs): the notes of this account's frog in this browser.
export function notesFor(owner, lifeId) {
  let storage = null;
  try { storage = globalThis.localStorage; } catch {}
  return readNotes(storage, notesKey(owner, lifeId)).notes;
}

// The notebook of the frog the taskbar shows: decides when the frog brings up a secret, and writes the notes.
export function createNotebook({ storage, now = () => Date.now(), random = Math.random } = {}) {
  let key = null;
  const load = () => readNotes(storage, key);
  const save = data => { if (!key || !storage) return false; try { storage.setItem(key, JSON.stringify(data)); return true; } catch { return false; } };
  return {
    observe(owner, pet) { key = pet && pet.status !== 'departed' ? notesKey(owner, pet.life_id) : null; },
    reset() { key = null; },
    get notes() { return load().notes; },
    // Is it worth reading the Passport to maybe say something? Cheap and local; deliver() makes the final call.
    due(view) {
      if (!key || !wellKept(view)) return false;
      const d = load(), clues = d.notes.filter(n => n.kind === 'clue').length;
      if (view.goodDays >= CLUE_FROM) return clues < cluesUnlocked(view.goodDays);
      // before day 50: one roll a day, at least TEASE_GAP_DAYS days apart, rolled here so the Passport is
      // read only on the rare greeting that may really say "not yet"
      const today = Math.floor(now() / DAY);
      if (d.teaseDay === today || (d.teaseAt != null && now() - d.teaseAt < TEASE_GAP_DAYS * DAY)) return false;
      d.teaseDay = today; d.teaseWon = random() < 0.5;
      return save(d) && d.teaseWon;
    },
    // foundIds: the secrets this account has found (from its Passport). Returns { kind, text } or null.
    deliver(view, foundIds, lifeId) {
      if (!key || !wellKept(view) || !Array.isArray(foundIds)) return null;
      const found = new Set(foundIds), left = TRAILS.filter(t => !found.has(t[0]));
      const d = load();
      if (!left.length) return null;                     // every secret found: a hint would be silly
      if (view.goodDays >= CLUE_FROM) {
        const clued = new Set(d.notes.filter(n => n.kind === 'clue').map(n => n.secret));
        if (clued.size >= cluesUnlocked(view.goodDays)) return null;
        const id = clueOrder(lifeId).find(s => !found.has(s) && !clued.has(s));
        if (!id) return null;                            // every secret still open already has its note
        const trail = TRAILS.find(t => t[0] === id);
        const first = !d.notes.some(n => n.kind === 'trust');
        if (first) d.notes.push({ kind: 'trust', text: TRUST_NOTE, day: view.goodDays, at: now() });
        d.notes.push({ kind: 'clue', secret: id, title: trail[1], text: trail[2], day: view.goodDays, at: now() });
        if (!save(d)) return null;
        return { kind: 'clue', secret: id, text: (first ? 'Fifty good days together. I trust you now, fren.\n\n' : 'Just between us, fren…\n\n') +
          trail[2] + '\n\nI left a note about it on the table in my room.' };
      }
      // before day 50: only after today's roll in due() came up, and only once
      const today = Math.floor(now() / DAY);
      if (d.teaseDay !== today || !d.teaseWon) return null;
      d.teaseWon = false; d.teaseAt = now();
      if (!save(d)) return null;
      return { kind: 'tease', text: TEASES[today % TEASES.length] };
    },
  };
}
