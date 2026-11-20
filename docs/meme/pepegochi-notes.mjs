// PepeGochi's notes: the secret clues the frog gives and the table in its room where they stay.
// Owner rules (byl, 2026-11-20):
//  - From 50 good care days of the same frog, one clue every 10 good care days (50, 60, 70...), strictly about
//    the NEW puzzles (the six Map Fragment secrets of the golden-foot painting), one unsolved puzzle each.
//  - Before day 50: a player who clearly is not hunting the 12 PondOS secrets gets gentle nudges about them
//    ("they exist, have a look"), at most once every few days. A player who is hunting may hear, just as rarely,
//    that the frog would tell a bigger secret but does not trust them enough yet; not if they solved the new
//    puzzles already, and only once those puzzles exist (otherwise day 50 would break the promise).
//  - Only while the frog is a healthy, well looked after froglet or adult.
//  - Every important message (clues, nudges, the "I trust you now" note) lies on the table in the room.
// Cosmetic only: no reward, no RPC of its own. Notes live in this browser (per account and per frog life).
import { TRAILS } from './pepegochi-rumors.mjs?v=20261120notes3';

// The new puzzles (passport-catalog.json pond_map_1..6, "planned"). Their clue texts go here when the puzzles
// ship; an empty text means "not written yet" and the frog stays quiet about it.
export const NEW_PUZZLES = ['pond_map_1', 'pond_map_2', 'pond_map_3', 'pond_map_4', 'pond_map_5', 'pond_map_6'];
export const NEW_CLUES = {};
const newClue = id => typeof NEW_CLUES[id] === 'string' && NEW_CLUES[id].length > 0 ? NEW_CLUES[id] : null;
// "clearly not hunting": no PondOS secret found yet, or none for this long
export const IDLE_HUNT_DAYS = 14;

export const CLUE_FROM = 50, CLUE_EVERY = 10, TEASE_GAP_DAYS = 3, WELL_KEPT = 75;
const NUDGE_INTRO = 'Psst, fren. PondOS hides a dozen little secrets, and you have not been looking. Here is one to start with:\n\n';
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
export const TRUST_NOTE = 'You have looked after me for 50 good days. I trust you now, fren. The golden foot on my wall is not just a painting. From today, every ten good days I will tell you one thing about the puzzles behind it. I will leave each one here on the table, so you can read it again.';

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
    (n.kind === 'trust' || ((n.kind === 'clue' || n.kind === 'nudge') && (TRAILS.some(t => t[0] === n.secret) || NEW_PUZZLES.includes(n.secret))))).slice(0, 40) : [];
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
      const d = load();
      if (view.goodDays >= CLUE_FROM) {
        const clues = d.notes.filter(n => n.kind === 'clue').length;
        return clues < cluesUnlocked(view.goodDays) && NEW_PUZZLES.some(newClue);
      }
      // before day 50: one roll a day, at least TEASE_GAP_DAYS days apart, rolled here so the Passport is
      // read only on the rare greeting that may really say something
      const today = Math.floor(now() / DAY);
      if (d.teaseDay === today || (d.teaseAt != null && now() - d.teaseAt < TEASE_GAP_DAYS * DAY)) return false;
      d.teaseDay = today; d.teaseWon = random() < 0.5;
      return save(d) && d.teaseWon;
    },
    // progress: this account's Passport (rumorProgress): allFoundIds, foundIds (the 12), lastFoundAt.
    // Returns { kind: 'clue' | 'nudge' | 'tease', text } or null.
    deliver(view, progress, lifeId) {
      if (!key || !wellKept(view) || !Array.isArray(progress?.allFoundIds)) return null;
      const found = new Set(progress.allFoundIds), d = load();
      if (view.goodDays >= CLUE_FROM) {
        const clued = new Set(d.notes.filter(n => n.kind === 'clue').map(n => n.secret));
        if (clued.size >= cluesUnlocked(view.goodDays)) return null;
        const id = NEW_PUZZLES.find(s => newClue(s) && !found.has(s) && !clued.has(s));
        if (!id) return null;                            // nothing written yet, or every open puzzle has its note
        const first = !d.notes.some(n => n.kind === 'trust');
        if (first) d.notes.push({ kind: 'trust', text: TRUST_NOTE, day: view.goodDays, at: now() });
        d.notes.push({ kind: 'clue', secret: id, text: newClue(id), day: view.goodDays, at: now() });
        if (!save(d)) return null;
        return { kind: 'clue', secret: id, text: (first ? 'Fifty good days together. I trust you now, fren.\n\n' : 'Just between us, fren…\n\n') +
          newClue(id) + '\n\nI left a note about it on the table in my room.' };
      }
      // before day 50: only after today's roll in due() came up, and only once
      const today = Math.floor(now() / DAY);
      if (d.teaseDay !== today || !d.teaseWon) return null;
      const last = Number.isFinite(progress.lastFoundAt) ? progress.lastFoundAt : null;
      const idle = last === null || now() - last >= IDLE_HUNT_DAYS * DAY;
      const open = TRAILS.filter(t => !found.has(t[0]));
      let talk = null;
      if (idle && open.length) {
        const nudged = new Set(d.notes.filter(n => n.kind === 'nudge').map(n => n.secret));
        const id = clueOrder(lifeId).find(s => !found.has(s) && !nudged.has(s));
        if (id) {
          const text = TRAILS.find(t => t[0] === id)[2];
          d.notes.push({ kind: 'nudge', secret: id, text, day: view.goodDays, at: now() });
          talk = { kind: 'nudge', secret: id, text: NUDGE_INTRO + text + '\n\nI left a note about it on the table in my room.' };
        } else talk = { kind: 'nudge', text: 'There are still a few secrets hidden in PondOS, fren. The notes on my table might help.' };
      } else if (!idle && NEW_PUZZLES.some(newClue) && !NEW_PUZZLES.every(id => found.has(id))) {
        talk = { kind: 'tease', text: TEASES[today % TEASES.length] };
      }
      if (!talk) return null;
      d.teaseWon = false; d.teaseAt = now();
      return save(d) ? talk : null;
    },
  };
}
