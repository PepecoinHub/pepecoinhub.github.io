// The PEPEGOCHI.EXE window draws the room with the same slot and item IDs as the room SQL (Room-2),
// the layered room art from #222 and the frog art from the pixel art pack v2 (#227), all from files in
// the repo. Runs in CI without a database or a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  SLOTS, ITEMS, STARTER_ROOM, BACKGROUND, FROG, ROOM_W, ROOM_H, FROG_PX, FOOT_Y, HOME, SPRITES, spriteSrc,
  DEPART_FRAMES, DEPART_FOOT, DEPART_MS, SUITCASE, LETTER, TAKEN_BY_LETTER, LOOK_BELOW,
  frogLook, roomScene, departTimeline, renderRoom, playDeparture,
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
  // the window uses the item IDs of #222 unchanged
  assert.deepEqual(Object.keys(ITEMS).sort(), ['crt_tv', 'lava_lamp', 'mug', 'p_poster', 'potted_plant', 'rubber_duck']);
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
  // young stages have no state sprites yet; a packing one gets the separate suitcase
  assert.deepEqual(frogLook({ stage: 'tadpole', status: 'packing', needs: needs({ hunger: 0 }) }), { sprite: 'tadpole_idle', look: null, suitcase: true });
  assert.equal(frogLook({ stage: 'froglet', status: 'neglected' }).suitcase, false);
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
  const t = departTimeline('adult');
  assert.equal(DEPART_MS, 250, 'frame_ms in the art pack manifest');
  assert.deepEqual(t.map(s => s.src.match(/depart_0(\d)/)[1]).join(''), '1234343456', 'turn, steps, walk out');
  assert.equal(t[0].x, HOME.x, 'starts where the frog stood');
  for (let i = 1; i < t.length; i++) assert.ok(t[i].x >= t[i - 1].x, 'never walks back');
  const last = t.at(-1);
  assert.equal(last.x + FROG_PX / 2, ROOM_W, 'frames 5-6 leave their own frame at the room\'s right edge');
  assert.equal(t.at(-2).x, last.x);
  assert.deepEqual(t.map(s => s.foot), [1, 2, 3, 4, 3, 4, 3, 4, 5, 6].map(n => DEPART_FOOT[n - 1]), 'each frame stands on its own floor line');
  assert.ok(t.every(s => !s.suitcase), 'the adult frames already pull the suitcase');
  // young frogs: their sprite and the separate suitcase slide out, no adult frames
  const y = departTimeline('tadpole');
  assert.ok(y.every(s => /tadpole_idle/.test(s.src) && s.suitcase));
  assert.ok(y.at(-1).x - FROG_PX / 2 >= ROOM_W, 'fully out of the room');
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
  while (actor()) { seen.push(actor().children[0].src.match(/depart_0(\d)/)[1]); const f = pending; pending = null; f(); }
  assert.equal(seen.join(''), '1234343456');
  assert.ok(fired.every(ms => ms === DEPART_MS));
  assert.equal(room.querySelector('.pgr-letter').hidden, false);
  // a click in the window draws again: the old animation stops and the letter is shown
  const again = renderRoom(doc, { mode: 'departed' });
  const stop = playDeparture(again, 'froglet', timers);
  assert.equal(again.querySelector('.pgr-suitcase') != null, true, 'a young frog leaves with the separate suitcase');
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
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.pgr-pet \{ animation: none; \} \.pgr-actor \{ transition: none; \} \}/);
  assert.match(read('docs/games/js/pepegochi-beta.mjs'), /prefers-reduced-motion: reduce\)'\)\.matches/, 'no moving-out frames with reduced motion');
});
