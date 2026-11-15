// The PEPEGOCHI.EXE window draws the room with the same slot and item IDs as the room SQL (Room-2),
// the layered room art from #222 and the frog art from the pixel art pack v2 (#227), all from files in
// the repo. Runs in CI without a database or a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  SLOTS, ITEMS, STARTER_ROOM, BACKGROUND, FROG, ROOM_W, ROOM_H, FROG_PX, FOOT_Y, HOME, SPRITES, spriteSrc,
  DEPART_FRAMES, DEPART_FOOT, IMG, DEPART_MS, SUITCASE, LETTER, TAKEN_BY_LETTER, LOOK_BELOW,
  DEPART_DX, HATCH_FRAMES, HATCH_MS, CARE, careFrames,
  frogLook, roomScene, departTimeline, renderRoom, playDeparture, playFrames,
} from '../docs/games/js/pepegochi-room.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const sql = read('games/supabase/update_pepegochi_room_v1.sql');
const file = src => new URL('../docs/games/' + src, import.meta.url);
const pngSize = src => { const b = readFileSync(file(src)); assert.equal(b.toString('latin1', 1, 4), 'PNG', src); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const needs = (low = {}) => ['hunger', 'hygiene', 'mood', 'energy'].map(n => ({ need: n, value: low[n] ?? 95 }));

test('slots: same IDs and anchors as games.pepegochi_room_slots', () => {
  const rows = [...sql.matchAll(/\('([a-z_]+)','[^']*',(\d+),(\d+),(\d+),array\[/g)].map(m => [m[1], +m[2], +m[3], +m[4]]);
  assert.equal(rows.length, 11);
  assert.deepEqual(Object.keys(SLOTS).sort(), rows.map(r => r[0]).sort());
  for (const [id, x, y, z] of rows) assert.deepEqual([SLOTS[id].x, SLOTS[id].y, SLOTS[id].z], [x, y, z], id);
});

test('starter props: same items in the same slots as the room SQL catalog', () => {
  const starters = [...sql.matchAll(/\('([a-z_]+)','[^']*','[a-z]+','[a-z_]+',(?:true|false),true,'([a-z_]+)'\)/g)];
  assert.equal(starters.length, 6);
  assert.deepEqual(Object.fromEntries(starters.map(m => [m[2], m[1]])), STARTER_ROOM);
  for (const id of Object.values(STARTER_ROOM)) assert.ok(ITEMS[id], id);
});

test('every image the window draws is a file in docs/games, at the size the art packs give', () => {
  const sprites = Object.keys(SPRITES).map(spriteSrc);
  const all = [BACKGROUND, FROG, ...sprites, ...DEPART_FRAMES, SUITCASE.src, LETTER.envelope, LETTER.open, ...roomScene().items.map(i => i.src)];
  for (const f of all) assert.ok(existsSync(file(f)), f);
  assert.deepEqual(pngSize(BACKGROUND), [ROOM_W, ROOM_H]);
  for (const f of [...sprites, ...DEPART_FRAMES, SUITCASE.src, LETTER.envelope, LETTER.open]) assert.deepEqual(pngSize(f), [128, 128], f);
  // the window uses the item IDs of #222 unchanged, plus the four earned decorations (update_pepegochi_rewards.sql)
  assert.deepEqual(Object.keys(ITEMS).sort(), ['crt_tv', 'floppy_disk', 'golden_fly', 'lava_lamp', 'moon_rock', 'mug', 'p_poster',
    'paper_crown', 'potted_plant', 'rubber_duck']);
  for (const id of Object.keys(ITEMS)) { assert.ok(existsSync(file(IMG + id + '.png')), id); assert.deepEqual(pngSize(IMG + id + '.png'), [128, 128], id); }
});

test('the frog: one scale for every stage, standing on its feet at the same spot', () => {
  for (const stage of ['tadpole', 'froglet', 'adult']) {
    const f = roomScene({ stage }).frog;
    assert.equal(f.width, FROG_PX / ROOM_W * 100, stage + ': 1 sprite pixel = 1 room pixel, nothing resized');
    assert.equal(f.left, HOME.x / ROOM_W * 100);
    assert.equal(f.top, HOME.y / ROOM_H * 100);
  }
  assert.equal(roomScene({ mode: 'adopt' }).frog.sprite, 'egg_idle', 'an egg waits for a name');
  assert.equal(roomScene({ mode: 'adopt' }).frog.bubble, '');
  // feet: the art pack's line, except the older froglet, which is moved down instead of floating
  for (const [id, [top, foot]] of Object.entries(SPRITES)) {
    assert.ok(top < foot, id);
    assert.equal(foot, FOOT_Y, id);
  }
  assert.equal(roomScene({ stage: 'froglet' }).frog.foot, FOOT_Y);
  // the bubble sits above the head of the sprite that is shown
  const b = roomScene({ status: 'packing' }).frog;
  assert.equal(b.bubbleTop, (HOME.y - (124 - 9) - 6) / ROOM_H * 100);
});

test('which sprite: packing, recovering and neglected first, then the need the adult wants most', () => {
  const look = (o) => frogLook(o).sprite;
  assert.equal(look({ needs: needs() }), 'adult_idle');
  assert.equal(look({ needs: needs({ hunger: 60 }) }), 'adult_hungry');
  assert.equal(look({ needs: needs({ hygiene: 60 }) }), 'adult_dirty');
  assert.equal(look({ needs: needs({ mood: 60 }) }), 'adult_moody');
  assert.equal(look({ needs: needs({ energy: 60 }) }), 'adult_tired');
  assert.equal(look({ needs: needs({ hunger: 70, energy: 50 }) }), 'adult_tired', 'the lowest need');
  assert.equal(look({ needs: needs({ hygiene: 50, mood: 50 }) }), 'adult_dirty', 'a tie: the first need');
  assert.equal(look({ needs: needs({ hunger: LOOK_BELOW }) }), 'adult_idle', 'only below ' + LOOK_BELOW);
  assert.equal(look({ needs: needs({ hunger: LOOK_BELOW - 0.5 }) }), 'adult_hungry');
  for (const status of ['neglected', 'recovering', 'packing']) assert.equal(look({ status, needs: needs({ hunger: 0 }) }), 'adult_' + status);
  // the young frogs have their own state sprites since art pack A5 (their packing sprite carries its own suitcase)
  assert.deepEqual(frogLook({ stage: 'tadpole', status: 'packing', needs: needs({ hunger: 0 }) }), { sprite: 'tadpole_packing', look: null, suitcase: false, fallback: false });
  assert.deepEqual(frogLook({ stage: 'froglet', status: 'neglected' }), { sprite: 'froglet_neglected', look: null, suitcase: false, fallback: false });
  assert.deepEqual(frogLook({ stage: 'froglet', needs: needs({ hunger: 10 }) }), { sprite: 'froglet_hungry', look: 'hungry', suitcase: false, fallback: false });
  assert.equal(frogLook({ stage: 'tadpole', needs: needs({ energy: 10 }) }).sprite, 'tadpole_tired');
  for (const st of ['tadpole', 'froglet']) for (const k of ['hungry', 'dirty', 'moody', 'tired', 'neglected', 'packing', 'recovering'])
    assert.ok(SPRITES[st + '_' + k], st + '_' + k);
  assert.deepEqual(frogLook({ stage: 'froglet', needs: needs() }), { sprite: 'froglet_idle', look: null, suitcase: false, fallback: false });
  for (const s of ['healthy', 'recovering']) assert.equal(frogLook({ stage: 'egg', status: s }).fallback, false, 'the egg greys only when neglected or packing');
  assert.equal(frogLook({ stage: 'egg', status: 'packing' }).fallback, true);
  assert.equal(frogLook({ status: 'packing' }).fallback, false, 'the adult has its own packing sprite');
  assert.match(roomScene({ status: 'packing' }).frog.bubble, /Packing/);
  assert.match(roomScene({ status: 'neglected' }).frog.bubble, /miss you/);
  assert.match(roomScene({ needs: needs({ mood: 10 }) }).label, /healthy and in a bad mood/);
});

test('after moving out: no frog, the TV the letter mentions is hidden, everything else stays, the letter lies on the rug', () => {
  const d = roomScene({ mode: 'departed' });
  assert.equal(d.frog, null);
  assert.equal(TAKEN_BY_LETTER, 'crt_tv');
  assert.match(read('docs/games/js/pepegochi-beta-view.mjs'), /P\.S\. I took the TV\./, 'the letter says which item is gone');
  assert.deepEqual(d.items.map(i => i.itemId).sort(), ['lava_lamp', 'mug', 'p_poster', 'potted_plant', 'rubber_duck']);
  assert.equal(d.letter.src, LETTER.envelope); assert.equal(d.letter.read, false);
  assert.equal(roomScene({ mode: 'departed', letterSeen: true }).letter.src, LETTER.open);
  assert.match(d.label, /TV is gone too/);
  // the letter is where the envelope of props/room_departed_overlay.png is (x 309-354, y 331-361)
  assert.ok(LETTER.x >= 309 && LETTER.x <= 354 && LETTER.y >= 331 && LETTER.y <= 361);
  // only hidden in the picture: a new frog moves in and the TV is back; a room without a TV hides nothing
  assert.equal(roomScene({ mode: 'pet', stage: 'tadpole' }).items.length, 6);
  const noTv = { ...STARTER_ROOM }; delete noTv.tv_stand;
  assert.equal(roomScene({ mode: 'departed', placements: noTv }).items.length, 5);
});

test('moving out: the 6 frames once, 250 ms each, walking right until the frog leaves the room', () => {
  const t = departTimeline('adult', null);   // the older frames (used only without a walk cycle)
  assert.equal(DEPART_MS, 250, 'frame_ms in the art pack manifest');
  assert.deepEqual(t.map(s => s.src.match(/depart_0(\d)/)[1]).join(''), '1234343456', 'turn, steps, walk out');
  assert.equal(t[0].x, HOME.x, 'starts where the frog stood');
  for (let i = 1; i < t.length; i++) assert.ok(t[i].x >= t[i - 1].x, 'never walks back');
  const last = t.at(-1);
  assert.equal(last.x + FROG_PX / 2, ROOM_W, 'frame 6 leaves its own frame at the room\'s right edge');
  // the body (frame position + where the art draws it inside the frame) moves by an even step, no stutter
  const body = t.map(s => s.x + DEPART_DX[+s.src.match(/depart_0(\d)/)[1] - 1]);
  const steps = body.slice(1).map((b, i) => b - body[i]);
  assert.ok(Math.max(...steps) - Math.min(...steps) <= 1, 'even steps: ' + steps.join(','));
  assert.ok(steps.every(d => d > 0));
  assert.deepEqual(t.map(s => s.foot), [1, 2, 3, 4, 3, 4, 3, 4, 5, 6].map(n => DEPART_FOOT[n - 1]), 'each frame stands on its own floor line');
  assert.ok(t.every(s => !s.suitcase), 'the adult frames already pull the suitcase');
  // young frogs: their sprite and the separate suitcase slide out, no adult frames
  const y = departTimeline('tadpole', null);
  assert.ok(y.every(s => /tadpole_idle/.test(s.src) && s.suitcase));
  // the drawn walk cycles in the game (art packs A4 and A5): turn where it stood, then steps out of the room
  for (const st of ['adult', 'froglet', 'tadpole']) {
    const w = departTimeline(st);
    assert.equal(w[0].x, HOME.x, st);
    assert.ok(w.every(s => s.foot === FOOT_Y && !s.suitcase), st + ': the frames carry their own suitcase');
    assert.ok(w.at(-1).x >= ROOM_W, st + ': it leaves the room');
    for (const s of w) assert.ok(existsSync(file(s.src)), s.src);
  }
  assert.deepEqual(departTimeline('adult').slice(0, 3).map(s => s.src.split('/').pop()), ['depart_turn_01.png', 'depart_turn_02.png', 'depart_walk_01.png']);
  assert.ok(y.at(-1).x - FROG_PX / 2 >= ROOM_W, 'fully out of the room');
  // an in-place walk cycle from a later art pack (backlog A4): turn where it stood, then walk out of the room
  const w = departTimeline('adult', { turn: ['depart_turn_01.png', 'depart_turn_02.png'], walk: ['depart_walk_01.png', 'depart_walk_02.png'] });
  assert.deepEqual(w.slice(0, 2).map(s => [s.src, s.x]), [[IMG + 'depart_turn_01.png', HOME.x], [IMG + 'depart_turn_02.png', HOME.x]]);
  assert.deepEqual(w.slice(2, 5).map(s => s.src.slice(-6, -4)), ['01', '02', '01']);
  for (let i = 3; i < w.length; i++) assert.equal(w[i].x - w[i - 1].x, 24);
  assert.ok(w.at(-1).x - FROG_PX / 2 >= ROOM_W - 24 && w.at(-1).x < ROOM_W + FROG_PX / 2);
  assert.ok(w.every(s => s.foot === FOOT_Y && !s.suitcase));
});

test('short frame animations: hatching now, care once its art exists', () => {
  assert.equal(HATCH_MS, 450);
  assert.deepEqual(HATCH_FRAMES, ['hatch_01', 'hatch_02', 'hatch_03', 'hatch_04'].map(spriteSrc));
  // art pack A6: 4 frames for each care action, for the adult, the froglet and the tadpole; nothing for the egg
  assert.equal(Object.keys(CARE).length, 12);
  assert.deepEqual(careFrames('adult', 'feed'), [1, 2, 3, 4].map(n => IMG + 'care_feed_0' + n + '.png'));
  assert.deepEqual(careFrames('tadpole', 'rest'), [1, 2, 3, 4].map(n => IMG + 'care_tadpole_rest_0' + n + '.png'));
  assert.deepEqual(careFrames('egg', 'feed'), []);
  for (const k of Object.keys(CARE)) for (const f of careFrames(...k.split('_'))) assert.ok(existsSync(file(f)), f);
  // playFrames: each frame on the frog's own <img>, then its sprite back; stop puts it back at once
  const attrs = { src: 'idle.png' }, img = { getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } };
  let pending = null; const t = { setTimer: (fn) => { pending = fn; return 1; }, clearTimer: () => { pending = null; } };
  const seen = [];
  playFrames(img, ['a.png', 'b.png'], 100, t);
  seen.push(attrs.src); pending(); seen.push(attrs.src); pending(); seen.push(attrs.src);
  assert.deepEqual(seen, ['a.png', 'b.png', 'idle.png']);
  const stop = playFrames(img, ['a.png', 'b.png'], 100, t); stop();
  assert.equal(attrs.src, 'idle.png'); assert.equal(pending, null);
  assert.equal(playFrames(img, [], 100, t), null);
  assert.equal(playFrames(null, ['a.png'], 100, t), null);
});

// ---------- a minimal DOM, enough for renderRoom and playDeparture ----------
function fakeDoc() {
  const doc = {
    createElement(tag) {
      const n = {
        tagName: tag.toUpperCase(), className: '', children: [], parent: null, hidden: false, dataset: {}, attrs: {}, ownerDocument: doc,
        style: { props: {}, setProperty(k, v) { this.props[k] = v; }, getPropertyValue(k) { return this.props[k] ?? ''; } },
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
        append(...c) { for (const x of c) { x.parent = this; this.children.push(x); } },
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; },
        all() { return this.children.flatMap(c => [c, ...c.all()]); },
        querySelector(sel) { return this.all().find(x => x.className.split(' ').includes(sel.slice(1))) ?? null; },
        querySelectorAll(sel) { return this.all().filter(x => x.className.split(' ').includes(sel.slice(1))); },
      };
      return n;
    },
  };
  return doc;
}

test('the drawn room: layers in order, the letter is a real button, the frog carries its foot line', () => {
  const doc = fakeDoc();
  const pet = renderRoom(doc, { mode: 'pet', stage: 'adult', needs: needs({ hunger: 30 }) });
  const art = pet.querySelector('.pgr-art');
  assert.equal(art.getAttribute('role'), 'img');
  assert.match(art.getAttribute('aria-label'), /hungry/);
  const frog = pet.querySelector('.pgr-pet');
  assert.equal(frog.src, spriteSrc('adult_hungry'));
  assert.equal(frog.dataset.fallback, undefined);
  const young = renderRoom(doc, { mode: 'pet', stage: 'froglet', status: 'neglected' }).querySelector('.pgr-pet');
  assert.equal(young.dataset.sprite, 'froglet_neglected'); assert.equal(young.dataset.fallback, undefined, 'its own sprite, no grey');
  assert.equal(frog.style.getPropertyValue('--foot'), 124 / 128 * 100 + '%');
  assert.equal(pet.querySelectorAll('.pgr-item').length, 6);
  assert.equal(pet.querySelector('.pgr-letter'), null);
  const gone = renderRoom(doc, { mode: 'departed' });
  const letter = gone.querySelector('.pgr-letter');
  assert.equal(letter.tagName, 'BUTTON'); assert.equal(letter.dataset.letter, '1');
  assert.equal(letter.getAttribute('aria-label'), 'Open GOODBYE.TXT');
  assert.equal(gone.querySelector('.pgr-art').children.includes(letter), false, 'the button is not inside role=img');
  assert.equal(gone.querySelectorAll('.pgr-item').some(i => i.dataset.item === 'crt_tv'), false);
});

test('playDeparture: frames on a timer, the letter waits until the frog is out, and it can be stopped', () => {
  const doc = fakeDoc();
  let pending = null; const fired = [];
  const timers = { setTimer: (fn, ms) => { fired.push(ms); pending = fn; return 1; }, clearTimer: () => { pending = null; } };
  const room = renderRoom(doc, { mode: 'departed' });
  playDeparture(room, 'adult', timers);
  const actor = () => room.querySelector('.pgr-actor');
  const seen = [];
  assert.equal(room.querySelector('.pgr-letter').hidden, true, 'no letter while the frog is still here');
  while (actor()) { seen.push(actor().children[0].src.split('/').pop()); const f = pending; pending = null; f(); }
  assert.deepEqual(seen.slice(0, 6), ['depart_turn_01.png', 'depart_turn_02.png', 'depart_walk_01.png', 'depart_walk_02.png', 'depart_walk_03.png', 'depart_walk_04.png']);
  assert.equal(seen.length, departTimeline('adult').length, 'every frame once, then gone');
  assert.ok(fired.every(ms => ms === DEPART_MS));
  assert.equal(room.querySelector('.pgr-letter').hidden, false);
  // a click in the window draws again: the old animation stops and the letter is shown
  const again = renderRoom(doc, { mode: 'departed' });
  const stop = playDeparture(again, 'froglet', timers);
  assert.equal(again.querySelector('.pgr-suitcase'), null, 'a young frog now carries its own drawn suitcase');
  stop();
  assert.equal(again.querySelector('.pgr-actor'), null);
  assert.equal(again.querySelector('.pgr-letter').hidden, false);
});

test('the room module draws only: no network, storage or Supabase', () => {
  const src = read('docs/games/js/pepegochi-room.mjs').replace(/\/\/[^\n]*/g, '');
  for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'supabase', 'passport'])
    assert.ok(!src.toLowerCase().includes(bad.toLowerCase()), bad);
});

test('pixel art stays pixel art: nearest-neighbour scaling on every room image', () => {
  const css = read('docs/games/pepegochi.css');
  assert.match(css, /\.pgr img \{[^}]*image-rendering: pixelated/);
  assert.match(css, /\.pgr-neglected \.pgr-pet\[data-fallback\], \.pgr-packing \.pgr-pet\[data-fallback\] \{ filter: grayscale/, 'grey only on a fallback sprite');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.pgr-pet \{ animation: none; \} \.pgr-actor \{ transition: none; \} \}/);
  assert.match(read('docs/games/js/pepegochi-beta.mjs'), /prefers-reduced-motion: reduce\)'\)\.matches/, 'no moving-out frames with reduced motion');
});

// ---------- Room-4: the item the frog took (update_pepegochi_room_departure.sql) ----------
import { takenItem, takenName } from '../docs/games/js/pepegochi-room.mjs';
import { goodbyeText, letterNote, GOODBYE, TAKEN_LINE, NOTHING_LINE } from '../docs/games/js/pepegochi-beta-view.mjs';

test('Room-4: the letter, the note and the picture follow the item the server picked', () => {
  assert.equal(takenItem('classic'), 'crt_tv', 'the older letter took the TV');
  assert.equal(takenItem(undefined), 'crt_tv');
  assert.equal(takenItem('took_mug'), 'mug');
  assert.equal(takenItem('took_nothing'), null);
  assert.equal(goodbyeText('classic'), GOODBYE, 'the classic letter is unchanged word for word');
  for (const [item, line] of Object.entries(TAKEN_LINE)) {
    const text = goodbyeText('took_' + item);
    assert.ok(text.includes(line) && !text.includes('P.S. I took the TV.\n'), item);
    assert.ok(ITEMS[item], item + ' is a room item');
  }
  assert.ok(goodbyeText('took_nothing').includes(NOTHING_LINE));
  assert.match(letterNote('took_rubber_duck'), /^The rubber duck only left the picture/);
  assert.match(letterNote('took_nothing'), /Nothing was taken/);
  assert.equal(takenName('some_new_thing'), 'the some new thing');
  // the picture hides exactly that item, and only while the frog is away
  const d = roomScene({ mode: 'departed', taken: 'mug' });
  assert.deepEqual(d.items.map(i => i.itemId).sort(), ['crt_tv', 'lava_lamp', 'p_poster', 'potted_plant', 'rubber_duck']);
  assert.match(d.label, /the mug is gone too/);
  const none = roomScene({ mode: 'departed', taken: null });
  assert.equal(none.items.length, 6);
  assert.doesNotMatch(none.label, /gone too/);
  assert.equal(roomScene({ mode: 'pet', taken: 'mug' }).items.length, 6);
});
