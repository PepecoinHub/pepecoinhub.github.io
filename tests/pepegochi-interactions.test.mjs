import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companionReply, mountFrogInteractions } from '../docs/meme/pepegochi-interactions.mjs';

const adult = { hasPet: true, adult: true, motion: 'adult', sprite: 'taskbar/tb_adult_sit.png' };
test('healthy adult: varied cosmetic replies and appropriate existing poses', () => {
  assert.notEqual(companionReply(adult, 'hello', 0).text, companionReply(adult, 'hello', 1).text);
  assert.equal(companionReply(adult, 'pet').pose, 'tb_adult_laugh');
  assert.equal(companionReply(adult, 'annoyed').pose, 'tb_adult_moody');
  for (const kind of ['how', 'joke', 'play', 'news']) assert.ok(companionReply(adult, kind).text);
});
test('no pet (or departed/unavailable) opens the existing room', () => {
  for (const view of [null, { hasPet: false, motion: 'letter' }, { hasPet: false, motion: 'egg' }])
    assert.equal(companionReply(view).openRoom, true);
});
test('real needs and warnings take precedence; no false cosmetic state', () => {
  for (const id of ['hungry', 'dirty', 'moody', 'sleepy', 'neglected', 'packing', 'recovering']) {
    const view = { ...adult, sprite: 'taskbar/tb_adult_' + id + '.png' };
    for (const action of ['hello', 'pet', 'joke', 'annoyed']) {
      const r = companionReply(view, action); assert.equal(r.pose, null, id); assert.ok(r.text);
    }
  }
  assert.equal(companionReply({ ...adult, warning: true }, 'pet').pose, null);
});
test('eggs and young frogs never use adult poses', () => {
  for (const stage of ['egg', 'tadpole', 'froglet']) {
    const view = { hasPet: true, adult: false, motion: stage };
    assert.equal(companionReply(view, 'pet').pose, null);
    assert.equal(companionReply(view, 'hello').openRoom, false);
  }
});
test('froglets get age-appropriate, distinct dialogue instead of identical ribbits', () => {
  const young = {hasPet:true,adult:false,motion:'froglet',playReady:true,careDays:3};
  const answers = ['hello','how','joke','pet','play','news','memories','favourite'].map(action=>companionReply(young,action).text);
  assert.equal(new Set(answers).size,answers.length);
  assert.match(companionReply(young,'memories').text,/3 care days/);
  assert.match(companionReply({...young,playReady:false,needAttention:'hunger'},'play').text,/hungry/);
  for(const action of ['toyOkay','toyFavourite','pet'])assert.equal(companionReply(young,action).pose,null);
});

// Small DOM harness: exercises the controller without a browser dependency.
function harness(initial = adult, options = {}) {
  let time = 0, timerId = 0, pending = new Map(), opened = 0, quiz = 0, quizClosed = 0, view = initial;
  const poses = [];
  function tick(ms = 300) {
    time += ms;
    for (const [id, fn] of [...pending]) { pending.delete(id); fn(); }
  }
  class Element {
    constructor(doc) { this.ownerDocument = doc; this.children = []; this.events = new Map(); this.attrs = new Map(); this.style = {}; this.offsetWidth = 300; }
    append(...children) { for (const n of children) { this.children.push(n); n.parent = this; } }
    after(n) { this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, n); n.parent = this.parent; }
    get childElementCount() { return this.children.length; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    contains(n) { return n === this || this.children.some(c => c.contains(n)); }
    setAttribute(k, v) { this.attrs.set(k, v); }
    removeAttribute(k) { this.attrs.delete(k); }
    addEventListener(k, f) { if (!this.events.has(k)) this.events.set(k, new Set()); this.events.get(k).add(f); }
    removeEventListener(k, f) { this.events.get(k)?.delete(f); }
    emit(k, e = {}) { for (const f of this.events.get(k) || []) f({ target: this, preventDefault() {}, ...e }); }
    getBoundingClientRect() { return { top: 500, left: 24 }; }
    querySelector(s) { for (const n of this.children) { if (String(n.className || '').split(/\s+/).some(cls => s === '.' + cls)) return n; const found = n.querySelector(s); if (found) return found; } return null; }
    focus() {}
  }
  const doc = new Element(null);
  doc.body = new Element(doc);
  doc.createElement = () => new Element(doc);
  doc.defaultView = Object.assign(new Element(doc), {
    innerWidth: 800, innerHeight: 600, setTimeout(fn) { pending.set(++timerId, fn); return timerId; }, clearTimeout(id) { pending.delete(id); }
  });
  const slot = new Element(doc), button = new Element(doc), img = new Element(doc);
  slot.append(button); button.append(img);
  const controller = mountFrogInteractions({ button, img, slot, getView: () => view, setPose: p => poses.push(p),
    openRoom: () => { opened++; }, closeQuiz: () => { quizClosed++; }, quizAvailable: () => true,
    openQuiz: () => { quiz++; }, now: () => time, ...options });
  return { doc, button, img, controller, tick, poses, get opened() { return opened; }, get quiz() { return quiz; },
    get quizClosed() { return quizClosed; }, setView(v) { view = v; } };
}
test('single click opens local conversation and double click visits the room', () => {
  const h = harness();
  h.button.emit('click', { detail: 1 }); assert.equal(h.doc.body.children.length, 0);
  h.tick(); assert.equal(h.doc.body.children.length, 1); assert.equal(h.opened, 0);
  h.button.emit('click', { detail: 1 }); h.button.emit('click', { detail: 2 }); h.tick();
  assert.equal(h.opened, 1); assert.equal(h.doc.body.children.length, 0);
  h.controller.dispose();
});
test('repeated single clicks irritate; intentional drag pets; no room open', () => {
  const h = harness();
  for (let i = 0; i < 3; i++) { h.button.emit('click', { detail: 1 }); h.tick(); }
  assert.equal(h.poses.at(-1), 'tb_adult_moody');
  h.button.emit('pointerdown', { target: h.img, button: 0, pointerType: 'mouse', clientX: 0, clientY: 0 });
  h.button.emit('pointermove', { buttons: 1, clientX: 40, clientY: 0 });
  h.button.emit('pointerup'); h.button.emit('click', { detail: 1 }); h.tick();
  assert.equal(h.poses.at(-1), 'tb_adult_laugh'); assert.equal(h.opened, 0);
  h.controller.dispose();
});
test('keyboard, outside click, right click, quiz and account reset', () => {
  const h = harness();
  h.button.emit('click', { detail: 0 }); assert.equal(h.doc.body.children.length, 1);
  h.doc.emit('keydown', { key: 'Escape' }); assert.equal(h.doc.body.children.length, 0);
  h.button.emit('contextmenu'); assert.equal(h.doc.body.children.length, 1);
  const actions = h.doc.body.children[0].querySelector('.pg-fact-answers');
  actions.children.find(b => b.textContent === 'Pond Quiz').emit('click');
  assert.equal(h.quiz, 1); assert.equal(h.doc.body.children.length, 0);
  h.button.emit('click', { detail: 1 }); h.doc.emit('pointerdown', { target: h.doc.body }); h.tick();
  assert.equal(h.doc.body.children.length, 0);
  h.button.emit('click', { detail: 0 }); h.controller.close({ reset: true }); assert.equal(h.doc.body.children.length, 0);
  h.setView({ hasPet: false }); h.button.emit('click', { detail: 1 }); assert.equal(h.opened, 1);
  h.controller.dispose(); assert.equal(h.button.events.get('click').size, 0);
});

test('desktop commands open real PondOS destinations and close the conversation', () => {
  const opened = [];
  const commands = Object.fromEntries(['games', 'news', 'passport', 'tv'].map(name => [name, () => opened.push(name)]));
  const h = harness(adult, { commands });
  const click = label => {
    h.button.emit('click', { detail: 0 });
    const actions = h.doc.body.children[0].querySelector('.pg-fact-answers');
    actions.children.find(b => b.textContent === label).emit('click');
    assert.equal(h.doc.body.children.length, 0, label);
  };
  click("Let's play!");
  click("What's new?");
  click('Open Fren Passport');
  click('Watch Pond TV');
  assert.deepEqual(opened, ['games', 'news', 'passport', 'tv']);
  assert.equal(h.opened, 0);
  h.controller.dispose();
});

test('PondOS wires command buttons to its existing window functions', () => {
  const shell = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
  assert.match(shell, /commands:\s*\{\s*games:\s*gamesFolder,\s*passport:\s*frenPassport,\s*news:\s*bulletinApp,\s*tv:\s*pondTV\s*\}/);
});

test('care buttons use one shared async handler, keep the panel open and report the result', async () => {
  const calls = [], reactions = { feed: 'fed', clean: 'clean', play: 'played', rest: 'rested' };
  const h = harness(adult, { care: async kind => { calls.push(kind); return { ok: true, action: reactions[kind] }; } });
  h.button.emit('click', { detail: 0 });
  const care = h.doc.body.children[0].querySelector('.pg-care-actions');
  assert.deepEqual(care.children.map(b => b.textContent), ['Feed', 'Clean', 'Play', 'Rest']);
  for (const button of care.children) {
    button.emit('click');
    assert.ok(care.children.every(b => b.disabled));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.ok(care.children.every(b => !b.disabled));
    assert.equal(h.doc.body.children.length, 1);
  }
  assert.deepEqual(calls, ['feed', 'clean', 'play', 'rest']);
  assert.match(h.doc.body.children[0].querySelector('.pg-fact-q').textContent, /recharge/);
  h.controller.dispose();
});

test('the taskbar care bridge calls only the existing server-owned action RPC', () => {
  const taskbar = readFileSync(new URL('../docs/meme/pepegochi-taskbar.mjs', import.meta.url), 'utf8');
  assert.match(taskbar, /rpc\('gry_pepegochi_action', \{ p_action: kind \}\)/);
  assert.doesNotMatch(taskbar, /gry_pepegochi_(feed|clean|play|rest)/);
});

test('care and journal coexist without late replies replacing the currently selected action', async () => {
  let resolveCare, resolveJournal;
  const h = harness(adult, {
    care: () => new Promise(r => { resolveCare = r; }),
    readRumors: () => new Promise(r => { resolveJournal = r; }),
  });
  h.button.emit('click', { detail: 0 });
  const panel = h.doc.body.children[0], actions = panel.querySelector('.pg-fact-answers'), reply = panel.querySelector('.pg-fact-q');
  const feed = panel.querySelector('.pg-care-actions').children[0];
  feed.emit('click');
  actions.children.find(b => b.textContent === 'Secret Journal').emit('click');
  resolveJournal({ status: 'ok', progress: { found: ['A mystery'], total: 12 } });
  await Promise.resolve();
  resolveCare({ ok: true, action: 'fed' });
  await Promise.resolve();
  assert.match(reply.textContent, /A mystery/);
  assert.equal(feed.disabled, false);
  h.controller.dispose();
});

test('initiated contact is sparse, muted/blocked/young-safe, and never opens a dialog', () => {
  let invitations = 0, muted = false, allowed = true;
  const bond = { get muted() { return muted; }, invite: () => ++invitations === 1, remember() {}, favourite: 'ball' };
  const h = harness(adult, { bond, canReact: () => allowed });
  assert.equal(h.controller.invite(), false);
  h.tick(90001); allowed = false; assert.equal(h.controller.invite(), false);
  allowed = true; muted = true; assert.equal(h.controller.invite(), false);
  muted = false; assert.equal(h.controller.invite(), true);
  assert.equal(h.doc.body.children[0].attrs.get('role'), 'status');
  assert.equal(h.button.attrs.get('aria-expanded'), 'false');
  h.tick(46000); assert.equal(h.controller.invite(), false);
  h.setView({ ...adult, adult: false });h.tick(90000);assert.equal(h.controller.invite(), false);
  h.controller.dispose();assert.equal(h.doc.body.children.length, 0);
});

test('rumor and journal buttons use read-only on-demand data, optional detail and Passport navigation', async () => {
  let reads = 0, opened = 0;
  const progress = { found: ['One mystery'], total: 12, hint: 'A subtle clue', detail: 'A second clue' };
  const h = harness({ ...adult, adult: false, motion: 'froglet' }, { readRumors: async () => { reads++; return { status: 'ok', progress }; }, openPassport: () => opened++ });
  h.button.emit('click', { detail: 0 });
  assert.equal(reads, 0);
  const panel = h.doc.body.children[0], actions = panel.querySelector('.pg-fact-answers'), reply = panel.querySelector('.pg-fact-q');
  actions.children.find(b => b.textContent === 'Pond Rumors').emit('click');
  assert.match(reply.textContent, /check/); await Promise.resolve();
  assert.match(reply.textContent, /1 \/ 12.*\n\nA subtle clue/);
  const extras = panel.querySelector('.pg-rumor-actions');
  extras.children.find(b => b.textContent === 'A little more?').emit('click');
  assert.match(reply.textContent, /A second clue/); assert.equal(reads, 1);
  actions.children.find(b => b.textContent === 'Secret Journal').emit('click'); await Promise.resolve();
  assert.match(reply.textContent, /One mystery/); assert.equal(reads, 2);
  assert.equal(panel.querySelector('.pg-rumor-actions').children.length, 1);
  panel.querySelector('.pg-rumor-actions').children[0].emit('click');
  assert.equal(opened, 1); assert.equal(h.doc.body.children.length, 0); h.controller.dispose();
});

test('late rumor responses cannot overwrite another action, a new discovery or a closed dialog', async () => {
  const resolvers = [];
  const h = harness(adult, { readRumors: () => new Promise(r => resolvers.push(r)) });
  h.button.emit('click', { detail: 0 });
  const panel = h.doc.body.children[0], actions = panel.querySelector('.pg-fact-answers'), reply = panel.querySelector('.pg-fact-q');
  const click = label => actions.children.find(b => b.textContent === label).emit('click');
  const result = { status: 'ok', progress: { found: [], total: 12, hint: 'Late clue', detail: 'Late detail' } };
  click('Pond Rumors'); click('Tell me a joke'); const joke = reply.textContent; resolvers[0](result); await Promise.resolve(); assert.equal(reply.textContent, joke);
  click('Pond Rumors'); h.controller.invalidateRumors(); resolvers[1](result); await Promise.resolve(); assert.match(reply.textContent, /new discovery/);
  click('Pond Rumors'); h.controller.close(); resolvers[2](result); await Promise.resolve(); assert.equal(h.doc.body.children.length, 0);
  h.controller.dispose();
});
