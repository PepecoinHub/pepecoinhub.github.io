import test from 'node:test';
import assert from 'node:assert/strict';
import { World, LEVEL, echoWaves, replay, encodeRun, decodeRun, quantizeJump, MAX_JUMP } from '../docs/games/js/pond-echo-sim.mjs';

// Plays [wait, dx, dy] steps the way a person would: wait, jump, ride out the flight.
function play(seq, ext = [], nick = 'fren', parent = null) {
  const w = new World(LEVEL, ext), j = [];
  for (const [wait, dx, dy] of seq) {
    for (let i = 0; i < wait; i++) w.step();
    if (!w.canJump()) break;
    const t = w.tick; if (w.jump(dx, dy)) j.push([t, ...quantizeJump(dx, dy)]);
    while (w.frog.mode === 'air' && !w.result) w.step();
    if (w.result) break;
  }
  return { w, run: { n: nick, j, e: w.result ? w.result.t : w.tick, r: w.result ? w.result.res : 'timeout', p: parent } };
}

// The story the game is built on: A jumps greedily for the last leaf and lands in the water just short of it.
const A = play([[0, 174, 0], [60, 114, 92], [30, 207, 36]], [], 'A').run;
// B takes the upper route and finishes off the last leaf, which is only possible because A fell in.
const B_SEQ = [[0, 174, 0], [0, 163, -86], [140, 128, 129], [200, 130, 157], [0, 188, 0]];

test('the greedy jump to the last leaf falls short', () => {
  assert.equal(A.r, 'fall');
  const f = replay(A).frames.at(-1);
  const last = LEVEL.lilies[5];
  assert.ok(Math.hypot(f[0] - last.x, f[1] - last.y) < 70, 'falls just before the last leaf');
});

test('an echo splash opens the shortcut: same inputs fail alone and win with the echo', () => {
  assert.equal(play(B_SEQ).w.result.res, 'fall');
  const withEcho = play(B_SEQ, echoWaves(A)).w;
  assert.equal(withEcho.result.res, 'win');
  assert.ok(withEcho.assists.some(a => a.src === 'echo1:A' && a.lily === 5), 'A gets the assist');
});

test('a pond with an echo and an idle player is exactly the echo author pond', () => {
  const own = new World(LEVEL, []);
  const mirror = new World(LEVEL, echoWaves(A));
  let ji = 0;
  while (own.tick < 900) {
    while (ji < A.j.length && A.j[ji][0] <= own.tick) { own.jump(A.j[ji][1], A.j[ji][2]); ji++; }
    own.step(); mirror.step();
    for (let i = 0; i < own.lilies.length; i++) {
      assert.equal(mirror.lilies[i].x, own.lilies[i].x, 'tick ' + own.tick);
      assert.equal(mirror.lilies[i].y, own.lilies[i].y, 'tick ' + own.tick);
    }
  }
});

test('echoes chain: a run made with an echo replays the same through a link', () => {
  const B = play(B_SEQ, echoWaves(A), 'B', A).run;
  assert.equal(B.r, 'win');
  const back = decodeRun(encodeRun(B));
  assert.equal(back.n, 'B'); assert.equal(back.p.n, 'A');
  assert.deepEqual(back.j, B.j);
  assert.equal(replay(back).result.res, 'win', 'the link replays the win, with A’s wave inside it');
  assert.ok(encodeRun(B).length < 400, 'link stays short');
});

test('links reject junk and jumps longer than allowed', () => {
  assert.equal(decodeRun('nope'), null);
  assert.equal(decodeRun('v1.other-level.e30'), null);
  const bad = encodeRun({ n: 'x', j: [[0, 1, 1]], e: 1, r: 'fall' }).replace(/\.[^.]*$/, '.' + Buffer.from(JSON.stringify({ n: 'x', j: [[0, MAX_JUMP + 50, 0]], e: 1 })).toString('base64url'));
  assert.equal(decodeRun(bad), null);
  assert.equal(decodeRun(encodeRun({ n: '<b>hi</b>', j: [], e: 0, r: 'fall' })).n, 'bhib');
});

test('hopping in place on a lily does not carry it anywhere', () => {
  const settled = play([[0, 174, 0], [200, 0, 0]]).w.lilies[0].x;
  const w = play([[0, 174, 0], [80, 6, 0], [80, 6, 0], [80, 6, 0], [80, 6, 0], [200, 0, 0]]).w;
  assert.equal(w.frog.lily, 0);
  assert.ok(Math.abs(w.lilies[0].x - settled) < 1, 'lily stays put: ' + settled + ' vs ' + w.lilies[0].x);
});
