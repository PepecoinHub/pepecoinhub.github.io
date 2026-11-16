import test from 'node:test';
import assert from 'node:assert/strict';
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

// Small DOM harness: exercises the controller without a browser dependency.
function harness(initial = adult) {
  let time = 0, timerId = 0, pending = new Map(), opened = 0, quiz = 0, quizClosed = 0, view = initial;
  const poses = [];
  function tick(ms = 300) {
    time += ms;
    for (const [id, fn] of [...pending]) { pending.delete(id); fn(); }
  }
  class Element {
    constructor(doc) { this.ownerDocument = doc; this.children = []; this.events = new Map(); this.attrs = new Map(); this.style = {}; this.offsetWidth = 300; }
    append(...children) { for (const n of children) { this.children.push(n); n.parent = this; } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    contains(n) { return n === this || this.children.some(c => c.contains(n)); }
    setAttribute(k, v) { this.attrs.set(k, v); }
    removeAttribute(k) { this.attrs.delete(k); }
    addEventListener(k, f) { if (!this.events.has(k)) this.events.set(k, new Set()); this.events.get(k).add(f); }
    removeEventListener(k, f) { this.events.get(k)?.delete(f); }
    emit(k, e = {}) { for (const f of this.events.get(k) || []) f({ target: this, preventDefault() {}, ...e }); }
    getBoundingClientRect() { return { top: 500, left: 24 }; }
    querySelector(s) { for (const n of this.children) { if (s === '.' + n.className) return n; const found = n.querySelector(s); if (found) return found; } return null; }
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
    openQuiz: () => { quiz++; }, now: () => time });
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
