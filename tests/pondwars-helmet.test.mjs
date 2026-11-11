import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CharacterAnimator, STATES, frameGeometry, validateManifest, characterPoint } from '../docs/games/js/pondwars-animation.mjs';
import { HelmetCosmetics, HELMET_CENTER, HELMET_RECT, HELMET_DURATION, PROTOTYPE_WEAPON_HAND } from '../docs/games/js/pondwars-helmet.mjs';
import { newGame, startTurn, step, explode, W, H, STEP } from '../docs/games/js/pondwars-beta-engine.mjs';
import { snapshot, restoreInto, stateHash } from '../docs/games/js/pondwars-beta-net.mjs';

function fixture() {
  const g = newGame({ seed: 3, perTeam: 2, cpu: [false, false] }); g.mask.fill(0); g.mask.fill(1, 450 * W);
  g.frogs.forEach((f, i) => Object.assign(f, { x: 200 + i * 200, y: 449, ground: true, face: i % 2 ? -1 : 1 }));
  startTurn(g);
  const a = new CharacterAnimator(), h = new HelmetCosmetics(); h.restore(g);
  let reduced = false;
  const observe = () => a.observe(g, g.events, { onHealthDrop: (f, hp, time) => h.lose(f, hp, time, a.sample(f, reduced), reduced) });
  observe();
  return { g, a, h, observe, f: g.frogs[0], reduce(value) { reduced = value; if (value) h.suppressMotion(); } };
}

test('first actual 1 HP drop removes helmet once; zero damage, events and repeated renders do not', () => {
  const { f, g, h, a, observe } = fixture();
  g.events.push({ type: 'boom' }, { type: 'hit' }); observe(); assert.equal(h.wearing(f), true); assert.equal(h.flights.length, 0);
  f.hp = 99; observe(); assert.equal(h.wearing(f), false); assert.equal(h.flights.length, 1);
  const flight = h.flights[0];
  for (let i = 0; i < 5; i++) observe();
  f.hp = 65; a.advance(.2); observe();
  assert.equal(h.flights.length, 1); assert.equal(h.flights[0], flight);
  g.current = 1; g.phase = 'aim'; observe(); assert.equal(h.wearing(f), false);
  a.advance(HELMET_DURATION); assert.equal(h.sample(a.time).length, 0); assert.equal(h.wearing(f), false);
});

test('live decrements smaller than 1 HP do not emit a helmet particle', () => {
  const { f, h, observe } = fixture(); f.hp -= .5; observe();
  assert.equal(h.flights.length, 0); assert.equal(h.wearing(f), true);
});

test('real friendly-fire explosion drops the teammate helmet without changing damage or simulation', () => {
  const x = fixture(), control = fixture();
  for (const { g } of [x, control]) {
    const teammate = g.frogs[2]; assert.equal(teammate.team, g.frogs[0].team);
    explode(g, teammate.x, teammate.y - 20, 'rocket');
  }
  const before = stateHash(x.g); x.observe();
  assert.ok(x.g.frogs[2].hp < 100); assert.equal(x.h.wearing(x.g.frogs[2]), false);
  assert.equal(stateHash(x.g), before); assert.deepEqual(snapshot(x.g), snapshot(control.g));
});

test('real fall damage is observed, and zero-distance explosions do not require a fire event', () => {
  const { f, g, a, h, observe } = fixture();
  Object.assign(f, { y: 180, ground: false, fallFrom: 180, vx: 0, vy: 0 });
  for (let i = 0; i < 180 && f.hp === 100; i++) { step(g); a.advance(STEP); observe(); }
  assert.ok(f.hp < 100); assert.equal(h.wearing(f), false); assert.equal(h.flights.length, 1);
});

test('lethal damage in a single observation still emits exactly one helmet even on KO', () => {
  const { f, g, h, a, observe } = fixture();
  explode(g, f.x, f.y - 20, 'gold'); explode(g, f.x, f.y - 20, 'gold'); step(g); observe();
  assert.equal(f.hp, 0); assert.equal(a.sample(f).state, 'ko'); assert.equal(h.wearing(f), false);
  for (let i = 0; i < 240 && f.alive; i++) step(g);
  assert.equal(f.alive, false);
  assert.equal(h.flights.filter(p => p.id === f.id).length, 1);
  observe(); assert.equal(h.flights.filter(p => p.id === f.id).length, 1);
});

test('new game resets helmets; reload/reconnect reconstruct from real snapshots without replay', () => {
  const { f, g, h, a, observe } = fixture(); const full = snapshot(g);
  f.hp = 99; observe(); const damaged = snapshot(g);
  restoreInto(g, damaged); h.restore(g); observe();
  assert.equal(h.wearing(g.frogs[0]), false); assert.equal(h.flights.length, 0);
  // Fresh animator: same damaged snapshot after a reload.
  a.reset(); h.restore(g); observe(); assert.equal(h.flights.length, 0);
  restoreInto(g, full); h.restore(g); a.reset(); observe(); assert.equal(h.wearing(g.frogs[0]), true);
  const fresh = newGame({ seed: 7 }); h.restore(fresh); assert.ok(fresh.frogs.every(frog => h.wearing(frog)));
});

test('paused animation clock freezes the detached helmet; analytic flight agrees at 30/60/144 FPS', () => {
  for (const face of [-1, 1]) {
    const poses = [30, 60, 144].map(fps => {
      const { f, h, a, observe } = fixture(); f.face = face; f.hp--; observe();
      for (let i = 0; i < fps; i++) a.advance(1 / fps);
      const before = h.sample(a.time); a.advance(10, true); assert.deepEqual(h.sample(a.time), before);
      return before[0];
    });
    for (const pose of poses) for (const key of ['x', 'y', 'rotation', 'alpha']) assert.ok(Math.abs(pose[key] - poses[0][key]) < 1e-9);
  }
});

test('reduced motion removes immediately and suppresses an active flight permanently', () => {
  const x = fixture(); x.reduce(true); x.f.hp--; x.observe();
  assert.equal(x.h.wearing(x.f), false); assert.equal(x.h.sample(x.a.time).length, 0);
  const y = fixture(); y.f.hp--; y.observe(); assert.equal(y.h.flights.length, 1);
  y.h.sample(y.a.time, true); assert.equal(y.h.flights.length, 0);
  assert.equal(y.h.sample(y.a.time, false).length, 0); assert.equal(y.h.wearing(y.f), false);
});

test('attached overlay and cutout center coincide for both directions in every procedural state', () => {
  const { f, a } = fixture();
  for (const face of [-1, 1]) for (const state of STATES) {
    f.face = face; f.flipT = .2; f.hopFace = face; a.actors.get(f.id).state = state; a.advance(.05);
    const pose = a.sample(f), h = new HelmetCosmetics(); f.hp = 99;
    h.lose(f, 100, a.time, pose);
    const flight = h.sample(a.time)[0], center = characterPoint(f, pose, HELMET_CENTER);
    assert.equal(flight.x, center.x); assert.equal(flight.y, center.y); assert.equal(flight.rotation, pose.rotation);
    f.hp = 100;
  }
});

test('v02 assets and all 11 single-frame clips match the manifest and measured anchors', () => {
  const base = new URL('../docs/games/img/pondwars/players/standard-v02/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest_prototype.json', base)));
  assert.equal(validateManifest(manifest), true); assert.deepEqual(Object.keys(manifest.clips).sort(), [...STATES].sort());
  for (const name of ['standard_frog_no_helmet.png', 'helmet_overlay_on_512_canvas.png', 'helmet_cutout.png']) {
    const png = readFileSync(new URL(name, base)), expected = name === 'helmet_cutout.png' ? [320, 120] : [512, 512];
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected); assert.equal(png[25], 6, 'RGBA');
  }
  for (const clip of Object.values(manifest.clips)) {
    assert.equal(clip.frames.length, 1); const frame = clip.frames[0], q = frameGeometry(frame);
    assert.deepEqual(frame.foot, [256, 486]); assert.deepEqual(frame.hand, [368, 346]);
    assert.equal(q.y + frame.foot[1] * .125, 0); assert.deepEqual(q.hand, { x: 14, y: -17.5 });
  }
  assert.deepEqual(PROTOTYPE_WEAPON_HAND, { x: 0, y: -32 });
  const [x, y, w, h] = HELMET_RECT;
  assert.deepEqual(HELMET_CENTER, { x: (x + w / 2 - 256) * .125, y: (y + h / 2 - 486) * .125 });
});
