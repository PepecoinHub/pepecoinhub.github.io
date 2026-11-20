import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAILS } from '../docs/meme/pepegochi-rumors.mjs';
import { cluesUnlocked, nextClueDay, wellKept, createNotebook, clueOrder, readNotes, notesKey, TRUST_NOTE, NEW_PUZZLES, NEW_CLUES, IDLE_HUNT_DAYS } from '../docs/meme/pepegochi-notes.mjs';
import { describeTaskbarFrog } from '../docs/meme/pepegochi-taskbar.mjs';
import { roomScene, renderRoom } from '../docs/games/js/pepegochi-room.mjs';

const DAY = 86400000;
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const pet = (extra = {}) => ({ life_id: 'life-1', status: 'healthy', stage: 'adult', name: 'Fren', care_days: 60, good_days: 50,
  needs: { hunger: 90, hygiene: 90, mood: 90, energy: 90 }, ...extra });
const view = extra => ({ ...describeTaskbarFrog({ pet: pet(extra) }) });
const ALL = TRAILS.map(t => t[0]);
// Passport progress as rumorProgress returns it
const prog = (ids = [], lastFoundAt = null) => ({ allFoundIds: ids, foundIds: ids.filter(id => ALL.includes(id)), lastFoundAt });
// the new puzzles' clue texts are written when the puzzles ship; tests fill them in for a moment
const withNewClues = fn => { NEW_PUZZLES.forEach((id, i) => { NEW_CLUES[id] = 'New puzzle clue ' + (i + 1) + ', gently.'; });
  try { return fn(); } finally { for (const id of NEW_PUZZLES) delete NEW_CLUES[id]; } };

test('owner schedule: the first clue on good care day 50, then one every 10 good care days', () => {
  assert.deepEqual([0, 49, 50, 59, 60, 69, 70, 100, 160].map(cluesUnlocked), [0, 0, 1, 1, 2, 2, 3, 6, 12]);
  assert.deepEqual([0, 1, 2, 5].map(nextClueDay), [50, 60, 70, 100]);
  // the 100 good-day Super Parent stamp counts the same thing
  const catalog = JSON.parse(readFileSync(new URL('../docs/meme/passport-catalog.json', import.meta.url), 'utf8'));
  assert.match(JSON.stringify(catalog), /100 good-care days/);
});

test('only a healthy, well kept froglet or adult talks about secrets', () => {
  assert.equal(wellKept(view()), true);
  assert.equal(wellKept(view({ stage: 'froglet' })), true);
  for (const bad of [{ stage: 'egg' }, { stage: 'tadpole' }, { status: 'neglected' }, { status: 'recovering' }, { status: 'packing' },
    { needs: { hunger: 60, hygiene: 90, mood: 90, energy: 90 } }]) assert.equal(wellKept(view(bad)), false, JSON.stringify(bad));
  assert.equal(view().goodDays, 50);
});

test('day 50 brings the trust note and one clue about a NEW puzzle not solved yet; both lie on the table', () => withNewClues(() => {
  const s = storage(); let time = 100 * DAY;
  const nb = createNotebook({ storage: s, now: () => time, random: () => 0 });
  nb.observe('user-a', pet());
  assert.equal(nb.due(view()), true);
  const talk = nb.deliver(view(), prog([...ALL, 'pond_map_1']), 'life-1');
  assert.equal(talk.kind, 'clue'); assert.equal(talk.secret, 'pond_map_2', 'never a solved puzzle, never one of the 12');
  assert.match(talk.text, /I trust you now/); assert.match(talk.text, /table in my room/);
  const notes = readNotes(s, notesKey('user-a', 'life-1')).notes;
  assert.deepEqual(notes.map(n => n.kind), ['trust', 'clue']);
  assert.equal(notes[0].text, TRUST_NOTE); assert.equal(notes[1].secret, 'pond_map_2');
  assert.equal(nb.due(view({ good_days: 59 })), false);
  assert.equal(nb.deliver(view({ good_days: 59 }), prog(), 'life-1'), null);
  const second = nb.deliver(view({ good_days: 60 }), prog(), 'life-1');
  assert.equal(second.secret, 'pond_map_1'); assert.match(second.text, /Just between us/);
  assert.deepEqual(readNotes(s, notesKey('user-a', 'life-1')).notes.map(n => n.kind), ['trust', 'clue', 'clue']);
}));

test('after day 50 the 12 PondOS secrets are never hinted, and nothing is said while the new clues are unwritten', () => {
  const nb = createNotebook({ storage: storage(), now: () => 100 * DAY, random: () => 0 });
  nb.observe('user-a', pet({ good_days: 80 }));
  assert.equal(nb.due(view({ good_days: 80 })), false);
  assert.equal(nb.deliver(view({ good_days: 80 }), prog(), 'life-1'), null);
  withNewClues(() => {
    for (let i = 0; i < 8; i++) { const t = nb.deliver(view({ good_days: 200 }), prog(NEW_PUZZLES.slice(0, 4)), 'life-1'); if (t) assert.ok(NEW_PUZZLES.includes(t.secret)); }
    assert.deepEqual(nb.notes.filter(n => n.kind === 'clue').map(n => n.secret).sort(), ['pond_map_5', 'pond_map_6'], 'only the open puzzles, once each');
  });
});

test('before day 50 a player who is not hunting gets gentle nudges about the 12, kept on the table', () => {
  const s = storage(); let time = 100 * DAY;
  const nb = createNotebook({ storage: s, now: () => time, random: () => 0 });
  nb.observe('user-a', pet({ good_days: 20 }));
  const v = view({ good_days: 20 });
  assert.equal(nb.deliver(v, prog(), 'life-1'), null, 'nothing without the day\'s roll');
  assert.equal(nb.due(v), true);
  const t = nb.deliver(v, prog(), 'life-1');
  assert.equal(t.kind, 'nudge'); assert.ok(ALL.includes(t.secret)); assert.match(t.text, /dozen little secrets/);
  assert.equal(nb.deliver(v, prog(), 'life-1'), null, 'once');
  time += 2 * DAY; assert.equal(nb.due(v), false);
  // three days later, someone whose last find is old is still "not hunting": a different secret
  time += DAY; assert.equal(nb.due(v), true);
  const u = nb.deliver(v, prog(['wrong_frog'], time - IDLE_HUNT_DAYS * DAY), 'life-1');
  assert.equal(u.kind, 'nudge'); assert.notEqual(u.secret, t.secret); assert.notEqual(u.secret, 'wrong_frog');
  assert.deepEqual(readNotes(s, notesKey('user-a', 'life-1')).notes.map(n => n.kind), ['nudge', 'nudge']);
  // an unlucky roll uses up the day, so refreshing does not roll again
  time += 3 * DAY; let roll = 0.9; const nb2 = createNotebook({ storage: s, now: () => time, random: () => roll }); nb2.observe('user-a', pet({ good_days: 20 }));
  assert.equal(nb2.due(v), false); roll = 0; assert.equal(nb2.due(v), false);
});

test('before day 50 a player who is hunting gets no hint: only a rare "not yet", once the new puzzles exist', () => {
  let time = 100 * DAY;
  const nb = createNotebook({ storage: storage(), now: () => time, random: () => 0 });
  nb.observe('user-a', pet({ good_days: 20 }));
  const v = view({ good_days: 20 }), hunting = prog(['wrong_frog'], time - DAY);
  assert.equal(nb.due(v), true); assert.equal(nb.deliver(v, hunting, 'life-1'), null, 'no new puzzles yet: no promise');
  withNewClues(() => {
    time += 3 * DAY; assert.equal(nb.due(v), true);
    const t = nb.deliver(v, prog(['wrong_frog'], time - DAY), 'life-1');
    assert.equal(t.kind, 'tease'); assert.match(t.text, /trust|sure|Give it time|tell you/);
    time += 3 * DAY; assert.equal(nb.due(v), true);
    assert.equal(nb.deliver(v, prog(['wrong_frog', ...NEW_PUZZLES], time - DAY), 'life-1'), null, 'puzzles solved: a tease would be silly');
  });
  assert.deepEqual(nb.notes, []);
});

test('notes belong to one account and one frog life; no storage means no secret talk', () => {
  const s = storage();
  const nb = createNotebook({ storage: s, now: () => 100 * DAY, random: () => 0 });
  nb.observe('user-a', pet()); withNewClues(() => nb.deliver(view(), prog(), 'life-1'));
  nb.observe('user-b', pet()); assert.deepEqual(nb.notes, []);
  nb.observe('user-a', pet({ life_id: 'life-2' })); assert.deepEqual(nb.notes, []);
  nb.observe('user-a', pet({ status: 'departed' })); assert.equal(nb.due(view()), false);
  const none = createNotebook({ now: () => 100 * DAY, random: () => 0 }); none.observe('user-a', pet());
  assert.equal(withNewClues(() => none.deliver(view(), prog(), 'life-1')), null);
});

test('the room shows the notes envelope on the table only for a living frog with notes', () => {
  assert.equal(roomScene({ notes: 0 }).notes, null);
  assert.equal(roomScene({ mode: 'departed', notes: 3 }).notes, null);
  const sc = roomScene({ notes: 3 });
  assert.equal(sc.notes.count, 3);
  assert.ok(sc.notes.left > 60 && sc.notes.left < 70 && sc.notes.top > 65 && sc.notes.top < 72, 'on the side table, left of the mug');
});
