import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAILS } from '../docs/meme/pepegochi-rumors.mjs';
import { cluesUnlocked, nextClueDay, wellKept, createNotebook, clueOrder, readNotes, notesKey, TRUST_NOTE } from '../docs/meme/pepegochi-notes.mjs';
import { describeTaskbarFrog } from '../docs/meme/pepegochi-taskbar.mjs';
import { roomScene, renderRoom } from '../docs/games/js/pepegochi-room.mjs';

const DAY = 86400000;
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const pet = (extra = {}) => ({ life_id: 'life-1', status: 'healthy', stage: 'adult', name: 'Fren', care_days: 60, good_days: 50,
  needs: { hunger: 90, hygiene: 90, mood: 90, energy: 90 }, ...extra });
const view = extra => ({ ...describeTaskbarFrog({ pet: pet(extra) }) });
const ALL = TRAILS.map(t => t[0]);

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

test('day 50 brings the trust note and one clue about a secret not found yet; both lie on the table', () => {
  const s = storage(); let time = 100 * DAY;
  const nb = createNotebook({ storage: s, now: () => time, random: () => 0 });
  nb.observe('user-a', pet());
  assert.equal(nb.due(view()), true);
  const first = clueOrder('life-1')[0];
  const talk = nb.deliver(view(), [first], 'life-1');
  assert.equal(talk.kind, 'clue'); assert.notEqual(talk.secret, first);
  assert.match(talk.text, /I trust you now/); assert.match(talk.text, /table in my room/);
  const notes = readNotes(s, notesKey('user-a', 'life-1')).notes;
  assert.deepEqual(notes.map(n => n.kind), ['trust', 'clue']);
  assert.equal(notes[0].text, TRUST_NOTE); assert.equal(notes[1].secret, talk.secret);
  // the same day, or day 59: nothing more
  assert.equal(nb.due(view({ good_days: 59 })), false);
  assert.equal(nb.deliver(view({ good_days: 59 }), [], 'life-1'), null);
  // day 60: the second clue, different secret, no second trust note
  const second = nb.deliver(view({ good_days: 60 }), [], 'life-1');
  assert.notEqual(second.secret, talk.secret); assert.match(second.text, /Just between us/);
  assert.deepEqual(readNotes(s, notesKey('user-a', 'life-1')).notes.map(n => n.kind), ['trust', 'clue', 'clue']);
});

test('a player who found every secret gets no clue and no tease', () => {
  const nb = createNotebook({ storage: storage(), now: () => 100 * DAY, random: () => 0 });
  nb.observe('user-a', pet());
  assert.equal(nb.deliver(view(), ALL, 'life-1'), null);
  nb.observe('user-a', pet({ good_days: 10 }));
  assert.equal(nb.due(view({ good_days: 10 })), true);
  assert.equal(nb.deliver(view({ good_days: 10 }), ALL, 'life-1'), null);
});

test('clues never repeat and stop once every open secret has its note', () => {
  const nb = createNotebook({ storage: storage(), now: () => 100 * DAY, random: () => 0 });
  nb.observe('user-a', pet({ good_days: 200 }));
  const found = ALL.slice(0, 10), seen = new Set();
  for (let i = 0; i < 5; i++) { const t = nb.deliver(view({ good_days: 200 }), found, 'life-1'); if (t) seen.add(t.secret); }
  assert.deepEqual([...seen].sort(), ALL.slice(10).sort());
});

test('before day 50: at most one "not yet" every three days, never a clue, never written on the table', () => {
  const s = storage(); let time = 100 * DAY, roll = 0;
  const nb = createNotebook({ storage: s, now: () => time, random: () => roll });
  nb.observe('user-a', pet({ good_days: 20 }));
  const v = view({ good_days: 20 });
  assert.equal(nb.deliver(v, [], 'life-1'), null, 'no tease without the day\'s roll');
  assert.equal(nb.due(v), true);
  const t = nb.deliver(v, [], 'life-1');
  assert.equal(t.kind, 'tease'); assert.match(t.text, /trust|sure|Give it time|tell you/);
  assert.equal(nb.deliver(v, [], 'life-1'), null, 'once');
  assert.equal(nb.due(v), false);
  time += 2 * DAY; assert.equal(nb.due(v), false);
  time += DAY; assert.equal(nb.due(v), true); assert.equal(nb.deliver(v, [], 'life-1').kind, 'tease');
  // an unlucky roll uses up the day, so refreshing does not roll again
  time += 3 * DAY; roll = 0.9; assert.equal(nb.due(v), false); roll = 0; assert.equal(nb.due(v), false);
  assert.deepEqual(readNotes(s, notesKey('user-a', 'life-1')).notes, []);
});

test('notes belong to one account and one frog life; no storage means no secret talk', () => {
  const s = storage();
  const nb = createNotebook({ storage: s, now: () => 100 * DAY, random: () => 0 });
  nb.observe('user-a', pet()); nb.deliver(view(), [], 'life-1');
  nb.observe('user-b', pet()); assert.deepEqual(nb.notes, []);
  nb.observe('user-a', pet({ life_id: 'life-2' })); assert.deepEqual(nb.notes, []);
  nb.observe('user-a', pet({ status: 'departed' })); assert.equal(nb.due(view()), false);
  const none = createNotebook({ now: () => 100 * DAY, random: () => 0 }); none.observe('user-a', pet());
  assert.equal(none.deliver(view(), [], 'life-1'), null);
});

test('the room shows the notes envelope on the table only for a living frog with notes', () => {
  assert.equal(roomScene({ notes: 0 }).notes, null);
  assert.equal(roomScene({ mode: 'departed', notes: 3 }).notes, null);
  const sc = roomScene({ notes: 3 });
  assert.equal(sc.notes.count, 3);
  assert.ok(sc.notes.left > 60 && sc.notes.left < 70 && sc.notes.top > 65 && sc.notes.top < 72, 'on the side table, left of the mug');
});
