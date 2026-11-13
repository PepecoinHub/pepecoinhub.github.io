import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeTaskbarFrog } from '../docs/meme/pepegochi-taskbar.mjs';

const needs = { hunger: 100, hygiene: 100, mood: 100, energy: 100 };
const pet = (changes = {}) => ({ pet: { name: 'Fren', stage: 'adult', status: 'healthy', needs, ...changes } });

test('unadopted account gets the existing egg sprite, not a fabricated pet', () => {
  assert.deepEqual(describeTaskbarFrog({ pet: null }), describeTaskbarFrog(null));
  assert.equal(describeTaskbarFrog(null).sprite, 'pepegochi_egg_idle.png');
  assert.equal(describeTaskbarFrog(null).hasPet, false);
});
test('healthy adult uses exactly the same idle sprite as the room', () => {
  const v = describeTaskbarFrog(pet());
  assert.equal(v.sprite, 'pepegochi_adult_idle.png');
  assert.equal(v.warning, false);
  assert.match(v.title, /Fren/);
});
test('the lowest real need picks the corresponding room mood sprite', () => {
  const v = describeTaskbarFrog(pet({ needs: { ...needs, hunger: 42, mood: 80 } }));
  assert.equal(v.sprite, 'pepegochi_adult_hungry.png');
});
test('status overrides need, including moving out and recovering', () => {
  assert.equal(describeTaskbarFrog(pet({ status: 'packing', needs: { ...needs, hunger: 2 } })).sprite, 'pepegochi_adult_packing.png');
  assert.equal(describeTaskbarFrog(pet({ status: 'packing' })).warning, true);
  assert.equal(describeTaskbarFrog(pet({ status: 'recovering' })).sprite, 'pepegochi_adult_recovering.png');
  assert.equal(describeTaskbarFrog(pet({ status: 'departed' })).sprite, 'goodbye_envelope.png');
});
test('young frog stages keep their correct art', () => {
  assert.equal(describeTaskbarFrog(pet({ stage: 'egg' })).sprite, 'pepegochi_egg_idle.png');
  assert.equal(describeTaskbarFrog(pet({ stage: 'tadpole' })).sprite, 'pepegochi_tadpole_idle.png');
  assert.equal(describeTaskbarFrog(pet({ stage: 'froglet' })).sprite, 'pepegochi_froglet_idle.png');
});
test('taskbar stays behind the beta gate and refresh message carries no pet data', () => {
  const shell = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
  const game = readFileSync(new URL('../docs/games/js/pepegochi-live.mjs', import.meta.url), 'utf8');
  assert.match(shell, /if \(GOCHI && top && top\.querySelector\('\.bar'\)\)/);
  assert.match(shell, /mountTaskbarFrog/);
  assert.match(game, /postMessage\(\{ type: 'pondos:pepegochi-changed' \}, location\.origin\)/);
});

test('animation plans follow the real pet mood without changing pet state', () => {
  assert.equal(describeTaskbarFrog(null).motion, 'egg');
  assert.equal(describeTaskbarFrog(pet({ stage: 'froglet' })).motion, 'froglet');
  assert.equal(describeTaskbarFrog(pet({ status: 'packing' })).motion, 'packing');
  assert.equal(describeTaskbarFrog(pet({ status: 'recovering' })).motion, 'recovering');
  assert.equal(describeTaskbarFrog(pet({ needs: { ...needs, energy: 50 } })).motion, 'sleepy');
  assert.equal(describeTaskbarFrog(pet({ status: 'departed' })).motion, 'letter');
});
test('nine short taskbar movements never use an infinite CSS loop and honor reduced motion', () => {
  const css = readFileSync(new URL('../docs/meme/meme.css', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  for (const action of ['wobble', 'bob', 'peek', 'hop', 'shuffle', 'greet', 'nod', 'slouch', 'tremble']) {
    assert.match(css, new RegExp('pg-motion-' + action));
    assert.match(css, new RegExp('@keyframes pgc-' + action));
  }
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /document\.visibilityState !== 'visible'/);
  assert.match(js, /setTimeout\(queueMotion, 1050\)/);
  assert.doesNotMatch(css.slice(css.indexOf('Short, rare PepeGochi actions')), /infinite/);
});

// ---------- added on claude/kind-faraday-l3vxjs: fixes, fact of the day, hop out of the window ----------
import { UNAVAILABLE, hopPath } from '../docs/meme/pepegochi-taskbar.mjs';
import { factOfDay, usable, dayNumber, loadAnswer, saveAnswer, remark, REMARKS, STORE_KEY } from '../docs/meme/pepegochi-facts.mjs';
const quiz = JSON.parse(readFileSync(new URL('../docs/data/pepecoin-quiz.json', import.meta.url), 'utf8')).questions;

test('fixes from the review of #299: a motion in the fallback, the storage listener removed, pixel-safe moves', () => {
  assert.equal(UNAVAILABLE.motion, 'egg');
  assert.equal(UNAVAILABLE.hasPet, false);
  const js = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  assert.match(js, /window\.removeEventListener\('storage', onStorage\)/);
  const css = readFileSync(new URL('../docs/meme/meme.css', import.meta.url), 'utf8');
  const moves = css.slice(css.indexOf('Short, rare PepeGochi actions'), css.indexOf('the fact of the day'));
  assert.doesNotMatch(moves, /rotate\(/, 'no rotation: it blurs pixel art');
  for (const m of moves.matchAll(/translate[XY]?\(([^)]*)\)/g))
    for (const v of m[1].split(',')) assert.match(v.trim(), /^-?\d+(px)?$/, 'whole pixels only: ' + m[0]);
});

test('fact of the day: the same for everyone on a UTC day, no repeat until every usable question was asked', () => {
  const list = usable(quiz);
  assert.ok(list.length > 100, 'enough questions: ' + list.length);
  assert.ok(list.every(q => q.source && !q.dated));
  const d0 = dayNumber(Date.UTC(2026, 10, 13, 0, 0)), d1 = dayNumber(Date.UTC(2026, 10, 13, 23, 59));
  assert.equal(d0, d1);
  assert.deepEqual(factOfDay(quiz, d0), factOfDay(quiz, d1));
  const ids = new Set();
  for (let d = d0; d < d0 + list.length; d++) ids.add(factOfDay(quiz, d).id);
  assert.equal(ids.size, list.length, 'a full cycle asks every question once');
  for (let d = d0; d < d0 + 60; d++) {
    const f = factOfDay(quiz, d), q = quiz.find(x => x.id === f.id);
    assert.equal(f.answers[f.correct], q.answers[q.correct], 'the right answer survives the shuffle');
    assert.deepEqual([...f.answers].sort(), [...q.answers].sort());
  }
  const firstRight = new Set(Array.from({ length: 40 }, (_, k) => factOfDay(quiz, d0 + k).correct));
  assert.ok(firstRight.size >= 3, 'the right answer is not always in the same place');
  assert.equal(factOfDay([], d0), null);
});

test('fact of the day: one answer a day in the browser, nothing breaks without storage', () => {
  const mem = {}, storage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  assert.equal(loadAnswer(storage, 100), null);
  saveAnswer(storage, 2, 100);
  assert.deepEqual(loadAnswer(storage, 100), { day: 100, picked: 2 });
  assert.equal(loadAnswer(storage, 101), null, 'a new day asks again');
  assert.ok(mem[STORE_KEY]);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadAnswer(broken, 100), null);
  assert.doesNotThrow(() => saveAnswer(broken, 1, 100));
  assert.ok(REMARKS.right.includes(remark(true, 5)) && REMARKS.wrong.includes(remark(false, 5)));
});

test('the fact never opens by itself, and the frog still opens the game', () => {
  const js = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  assert.match(js, /factBtn\.addEventListener\('click', \(\) => \{ loadFacts\(\)\.then\(openBalloon\); \}\)/);
  assert.equal((js.match(/openBalloon\(/g) || []).length, 1, 'opened only from the "?" button');
  assert.match(js, /button\.addEventListener\('click', \(\) => open\(\)\)/);
  assert.match(js, /base \+ 'data\/pepecoin-quiz\.json'/);
});

test('hop out of the window: whole-pixel arc from the window to the taskbar slot; meme.js sends the window box', () => {
  const p = hopPath({ x: 300, y: 200 }, { x: 60, y: 700 });
  assert.deepEqual(p[0], { x: 300, y: 200 });
  assert.deepEqual(p.at(-1), { x: 60, y: 700 });
  assert.ok(p.every(q => Number.isInteger(q.x) && Number.isInteger(q.y)));
  assert.ok(p[4].y < 200 + (700 - 200) / 2, 'it arcs upward on the way');
  const shell = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
  assert.match(shell, /new CustomEvent\('pondos:pepegochi-left'/);
  assert.match(shell, /minBtn\.addEventListener\('click', A\._hop, true\)/);
});
