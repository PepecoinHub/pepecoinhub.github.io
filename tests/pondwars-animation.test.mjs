import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterAnimator, STATES, characterPoint, spriteFrame, frameGeometry, validateManifest } from '../docs/games/js/pondwars-animation.mjs';
import { PLAYERS } from '../docs/games/js/pondwars-players.mjs';
import { newGame, step, fire, hop, backflip, STEP } from '../docs/games/js/pondwars-beta-engine.mjs';

function fixture() {
  const f = { id: 0, team: 0, x: 100, y: 300, face: 1, hp: 100, alive: true, ground: true, vy: 0 };
  const g = { frogs: [f], current: 0, phase: 'aim', winner: null };
  const a = new CharacterAnimator(); a.observe(g);
  return { a, f, g };
}
test('all eleven states have transitions, with KO taking priority over hit/victory', () => {
  const { a, f, g } = fixture(), seen = new Set();
  const check = (state, events = [], options) => { a.observe(g, events, options); assert.equal(a.sample(f).state, state); seen.add(state); };
  check('aim'); check('charge', [], { charging: true });
  check('fire', [{ type: 'fire' }]); a.advance(.3); g.phase = 'fire'; check('idle');
  f.ground = false; f.vy = -100; check('jump'); f.flipT = .2; check('backflip');
  f.flipT = null; f.vy = 100; check('falling'); f.ground = true; check('landing');
  f.hp--; check('hit'); a.advance(.4); g.phase = 'over'; g.winner = 0; check('victory');
  f.alive = false; f.hp = 0; check('ko'); assert.deepEqual([...seen].sort(), [...STATES].sort());
});
test('time-based poses agree at 30/60/144 FPS and pause freezes their clock', () => {
  const samples = [30, 60, 144].map(fps => {
    const { a, f, g } = fixture(); g.phase = 'over'; g.winner = 0; a.observe(g);
    for (let i = 0; i < fps; i++) a.advance(1 / fps);
    const before = a.sample(f); a.advance(5, true); assert.deepEqual(a.sample(f), before);
    return before;
  });
  for (const p of samples) for (const key of ['age', 'dy', 'rotation']) assert.ok(Math.abs(p[key] - samples[0][key]) < 1e-10);
});
test('reduced motion suppresses deformation, spinning and sprite playback for every state', () => {
  const { a, f } = fixture();
  for (const state of STATES) {
    a.actors.get(f.id).state = state; a.advance(.13);
    const p = a.sample(f, true);
    assert.deepEqual([p.dx, p.dy, p.rotation, p.sx, p.sy], [0, 0, 0, 1, 1]);
  }
});
test('sprite and hand share transform in both directions, preserving PR266 neutral hand height', () => {
  const { a, f } = fixture(); const neutral = a.sample(f, true);
  for (const face of [-1, 1]) { f.face = face; assert.deepEqual(characterPoint(f, neutral), { x: 100, y: 268 }); }
  const p = { ...neutral, rotation: Math.PI / 2, sx: 2, sy: 2, dx: 1, dy: 2 };
  assert.deepEqual(characterPoint(f, p), { x: 107, y: 273 });
});
test('future clips support looping, terminal frame, missing-state fallback and arbitrary source proportions', () => {
  const frames = [{ rect: [0, 0, 200, 300], foot: [100, 300], hand: [110, 150] }, { rect: [200, 0, 200, 300], foot: [100, 300], hand: [110, 150] }];
  const m = { version: 1, clips: { idle: { fps: 10, loop: true, frames }, fire: { fps: 10, loop: false, frames } } };
  assert.equal(spriteFrame(m, 'idle', .2), frames[0]); assert.equal(spriteFrame(m, 'fire', 10), frames[1]);
  assert.equal(spriteFrame(m, 'fire', 10, true), frames[0]); assert.equal(spriteFrame(m, 'hit', 1), null);
  assert.equal(spriteFrame({ ...m, version: 2 }, 'idle', 0), null);
  const q = frameGeometry(frames[0]); assert.equal(q.height, 64); assert.equal(q.y + q.height, 0); assert.equal(q.hand.y, -32);
  assert.equal(PLAYERS.length, 8); for (const player of PLAYERS) assert.equal(spriteFrame(player.animation, 'aim', 0), null);
});
test('real engine events drive recoil and backflip; observing a simulation cannot alter its outcome', () => {
  const g = newGame({ seed: 123 }), control = newGame({ seed: 123 });
  const a = new CharacterAnimator(); a.observe(g); g.events.length = 0; control.events.length = 0;
  assert.equal(hop(g), hop(control)); a.observe(g, g.events); assert.equal(a.sample(g.frogs[g.current]).state, 'jump');
  assert.equal(backflip(g), backflip(control)); a.observe(g, g.events); assert.equal(a.sample(g.frogs[g.current]).state, 'backflip');
  for (let i = 0; i < 120; i++) { step(g); step(control); a.advance(STEP); a.observe(g, g.events); }
  assert.equal(fire(g, -.7, .55), fire(control, -.7, .55)); a.observe(g, g.events);
  assert.equal(a.sample(g.frogs[g.current]).state, 'fire');
  for (let i = 0; i < 300; i++) { step(g); step(control); a.advance(STEP); a.observe(g, g.events); }
  const { rand, ...actual } = g, { rand: otherRand, ...expected } = control;
  assert.deepEqual(actual, expected); assert.equal(rand.state(), otherRand.state());
});

test('asset registration rejects malformed anchors and inconsistent frame dimensions', () => {
  const frame = {rect:[0,0,384,384], foot:[192,384], hand:[192,192]};
  const manifest = {version:1,facing:'right',frameSize:[384,384],clips:{aim:{fps:12,loop:true,frames:[frame]}}};
  assert.equal(validateManifest(manifest), true);
  assert.equal(validateManifest({...manifest,facing:'left'}), false);
  assert.equal(validateManifest({...manifest,frameSize:[256,384]}), false);
  assert.equal(validateManifest({...manifest,clips:{aim:{fps:12,loop:true,frames:[{...frame,hand:[NaN,0]}]}}}), false);
});
