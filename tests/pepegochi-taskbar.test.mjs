import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeTaskbarFrog } from '../docs/meme/pepegochi-taskbar.mjs';

const needs = { hunger: 100, hygiene: 100, mood: 100, energy: 100 };
const pet = (changes = {}) => ({ pet: { name: 'Fren', stage: 'adult', status: 'healthy', needs, ...changes } });

test('no frog yet: the egg pose, not a made-up pet', () => {
  assert.deepEqual(describeTaskbarFrog({ pet: null }), describeTaskbarFrog(null));
  assert.equal(describeTaskbarFrog(null).sprite, 'taskbar/tb_egg.png');
  assert.equal(describeTaskbarFrog(null).hasPet, false);
});
test('a healthy adult sits on the bar', () => {
  const v = describeTaskbarFrog(pet());
  assert.equal(v.sprite, 'taskbar/tb_adult_sit.png');
  assert.equal(v.warning, false);
  assert.equal(v.adult, true);
  assert.match(v.title, /Fren/);
});
test('the lowest real need picks the same mood as the room', () => {
  assert.equal(describeTaskbarFrog(pet({ needs: { ...needs, hunger: 42, mood: 80 } })).sprite, 'taskbar/tb_adult_hungry.png');
  assert.equal(describeTaskbarFrog(pet({ needs: { ...needs, hygiene: 42 } })).sprite, 'taskbar/tb_adult_dirty.png');
  assert.equal(describeTaskbarFrog(pet({ needs: { ...needs, mood: 42 } })).sprite, 'taskbar/tb_adult_moody.png');
  assert.equal(describeTaskbarFrog(pet({ needs: { ...needs, energy: 42 } })).sprite, 'taskbar/tb_adult_sleepy.png');
});
test('status overrides need, including moving out and recovering', () => {
  assert.equal(describeTaskbarFrog(pet({ status: 'packing', needs: { ...needs, hunger: 2 } })).sprite, 'taskbar/tb_adult_packing.png');
  assert.equal(describeTaskbarFrog(pet({ status: 'packing' })).warning, true);
  assert.equal(describeTaskbarFrog(pet({ status: 'neglected' })).sprite, 'taskbar/tb_adult_neglected.png');
  assert.equal(describeTaskbarFrog(pet({ status: 'recovering' })).sprite, 'taskbar/tb_adult_recovering.png');
  assert.equal(describeTaskbarFrog(pet({ status: 'departed' })).sprite, 'taskbar/tb_letter.png');
});
test('young frog stages keep their own pose, whatever their state', () => {
  assert.equal(describeTaskbarFrog(pet({ stage: 'egg' })).sprite, 'taskbar/tb_egg.png');
  assert.equal(describeTaskbarFrog(pet({ stage: 'tadpole', needs: { ...needs, hunger: 10 } })).sprite, 'taskbar/tb_tadpole.png');
  assert.equal(describeTaskbarFrog(pet({ stage: 'froglet', status: 'packing' })).sprite, 'taskbar/tb_froglet.png');
  assert.equal(describeTaskbarFrog(pet({ stage: 'froglet' })).adult, false, 'no talking or waving poses for the young');
});
test('the 16 approved poses are real 48 x 48 files that pass the art check', async () => {
  const { checkFile } = await import('../scripts/pepegochi_art_qa.mjs');
  const { POSES, pose } = await import('../docs/meme/pepegochi-taskbar.mjs');
  assert.equal(POSES.length, 16);
  for (const id of POSES) {
    const f = new URL('../docs/games/img/pepegochi/' + pose(id), import.meta.url);
    assert.deepEqual(checkFile(f.pathname).problems, [], id);
  }
  const js = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  assert.match(js, /setAct\('tb_adult_talk'\)/, 'talks while the quiz is open');
  assert.match(js, /setAct\(f\.right \? 'tb_adult_laugh' : 'tb_adult_think'\)/, 'laughs or thinks after the answer');
  assert.match(js, /setAct\('tb_adult_wave'\)/, 'waves on hover');
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

// ---------- added on claude/kind-faraday-l3vxjs: fixes, Pond Quiz, hop out of the window ----------
import { UNAVAILABLE, hopPath } from '../docs/meme/pepegochi-taskbar.mjs';
import { remark, REMARKS, dayNumber } from '../docs/meme/pepegochi-facts.mjs';

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

test('Pond Quiz in the browser: questions only from the server, only after hatching, never opens by itself', () => {
  const js = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  const facts = readFileSync(new URL('../docs/meme/pepegochi-facts.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(js + facts, /pepecoin-quiz|data\/|fetch\(/, 'no questions file is loaded');
  assert.match(js, /rpc\('gry_quiz_today', \{\}\)/);
  assert.match(js, /rpc\('gry_quiz_answer', \{ p_choice: i \}\)/);
  assert.match(js, /rpc\('gry_quiz_board', \{\}\)/);
  assert.match(js, /if \(!signedIn\(\) \|\| !hatched\) \{ server = null;/, 'no request before the frog hatched');
  assert.match(js, /hatched = !!\(state && state\.pet && state\.pet\.stage && state\.pet\.stage !== 'egg'\)/);
  assert.match(js, /factBtn\.addEventListener\('click', \(\) => \{ refreshFacts\(\)\.then\(openBalloon\); \}\)/);
  assert.equal((js.match(/openBalloon\(/g) || []).length, 1, 'opened only from the "?" button');
  assert.match(js, /button\.addEventListener\('click', \(\) => open\(\)\)/);
  assert.match(js, /Date\.now\(\) - serverAt < 5 \* 60 \* 1000/, 'at most one quiz read in 5 minutes');
});

test("the frog's remarks after an answer", () => {
  assert.ok(REMARKS.right.includes(remark(true, 5)) && REMARKS.wrong.includes(remark(false, 5)));
  assert.equal(dayNumber(Date.UTC(2026, 10, 13, 0, 0)), dayNumber(Date.UTC(2026, 10, 13, 23, 59)));
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
