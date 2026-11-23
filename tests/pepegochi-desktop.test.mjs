import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_REACTIONS, AUTO_PLAY_AFTER_MS, mountDesktopCompanion } from '../docs/meme/pepegochi-desktop.mjs';
import { companionReply } from '../docs/meme/pepegochi-interactions.mjs';

function fixture() {
  let time = 0, usable = true, ready = true;
  let view = { hasPet: true, adult: true, sprite: 'taskbar/tb_adult_sit.png' };
  const toys = [], actions = [], reactions = [], listeners = new Map();
  const win = { matchMedia: () => reduce, addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: key => listeners.delete(key) };
  const reduce = { matches: false }, body = { children: [] };
  let night = false;
  const doc = { defaultView: win, body, hidden: false,
    documentElement: { classList: { contains: name => name === 'sky-night' && night } },
    querySelector: () => night ? {} : null };
  const slot = { ownerDocument: doc, isConnected: true };
  const control = mountDesktopCompanion({ slot, getView: () => view, eligible: () => usable,
    mayStart: () => ready, showToy: kind => toys.push(kind), onAutoToy: action => actions.push(action),
    react: action => reactions.push(action), now: () => time });
  return { control, doc, slot, reduce, toys, actions, reactions, listeners,
    advance: ms => time += ms, app: id => listeners.get('pondos:app-opened')?.({ detail: { id, host: { isConnected: true, matches: name => name === '.app-win' } } }),
    setView: next => { view = next; }, setUsable: value => { usable = value; }, setReady: value => { ready = value; },
    setNight: value => { night = value; } };
}

test('manual duck, ball and cap stay beside the taskbar frog', () => {
  const f = fixture();
  for (const kind of ['duck', 'ball', 'cap']) assert.equal(f.control.playToy(kind), true);
  assert.deepEqual(f.toys, ['duck', 'ball', 'cap']);
  assert.deepEqual(f.actions, [], 'the menu starts its own taskbar animation sequence');
  assert.deepEqual(f.doc.body.children, [], 'no full-screen frog or flying toy is created');
  assert.equal(f.control.active, false);
  assert.equal(f.control.fireflyAvailable(), false);
  f.control.dispose();
  assert.equal(f.listeners.has('pondos:app-opened'), false);
});

test('night firefly comes to the taskbar without borrowing the wallpaper light', () => {
  const f = fixture();f.setNight(true);
  assert.equal(f.control.fireflyAvailable(), true);
  assert.equal(f.control.catchNearby(), true);
  assert.deepEqual(f.toys, ['firefly']);
  assert.deepEqual(f.reactions, ['desktopFirefly']);
  assert.deepEqual(f.doc.body.children, []);
  f.reduce.matches = true;assert.equal(f.control.fireflyAvailable(), false);
  f.control.dispose();
});

test('autonomous play waits five minutes and uses taskbar poses', () => {
  const f = fixture();
  f.advance(AUTO_PLAY_AFTER_MS - 1);
  assert.equal(f.control.ambient(), false);
  f.advance(1);
  assert.equal(f.control.ambient(), true);
  assert.equal(f.toys.length, 1);
  assert.ok(['toyBall', 'toyDuck', 'toyCap'].includes(f.actions[0]));
  assert.deepEqual(f.doc.body.children, []);
  assert.equal(f.control.ambient(), false);
  f.setReady(false); f.advance(AUTO_PLAY_AFTER_MS); assert.equal(f.control.ambient(), false);
  f.setReady(true); f.reduce.matches = true; assert.equal(f.control.ambient(), false);
  f.control.dispose();
});

test('desktop app reactions stay local and respect care state', () => {
  const f = fixture();
  f.app('games'); assert.deepEqual(f.reactions, [APP_REACTIONS.games]);
  f.app('tv'); assert.equal(f.reactions.length, 1, 'app reactions are throttled');
  f.advance(45000); f.app('tv'); assert.equal(f.reactions.at(-1), APP_REACTIONS.tv);
  assert.deepEqual(f.doc.body.children, []);
  f.setView({ hasPet: true, adult: true, sprite: 'taskbar/tb_adult_hungry.png' });
  assert.equal(f.control.playToy('duck'), false);
  f.setUsable(false); f.advance(45000); f.app('find'); assert.equal(f.reactions.length, 2);
  f.control.dispose();
});

test('app dialogue still uses the existing personality rules', () => {
  const adult = { hasPet: true, adult: true, sprite: 'taskbar/tb_adult_sit.png' };
  assert.match(companionReply(adult, APP_REACTIONS.tv).text, /popcorn/);
  assert.match(companionReply({ ...adult, sprite: 'taskbar/tb_adult_hungry.png' }, APP_REACTIONS.tv).text, /stomach/);
  for (const game of ['yeet', 'wp', 'pondwars', 'pepesweeper', 'goldhook', 'miner', 'lan', 'pepegochi'])
    assert.equal(Object.hasOwn(APP_REACTIONS, game), false);
});
