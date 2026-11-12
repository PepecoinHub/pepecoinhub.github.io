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
