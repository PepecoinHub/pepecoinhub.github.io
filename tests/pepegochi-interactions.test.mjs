import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companionReply, mountFrogInteractions, pepMood } from '../docs/meme/pepegochi-interactions.mjs';

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
function group(panel,id) {
  const target=panel.querySelector('.pg-menu-'+id+'-group');
  if(target.hidden){const back=panel.querySelector('.pg-menu-back');if(!back.hidden)back.emit('click');panel.querySelector('.pg-menu-'+id).emit('click');}
  assert.equal(target.hidden,false);return target;
}
function choose(panel,id,label){group(panel,id).children.find(b=>b.textContent===label).emit('click');}

test('categories expose only their own actions, Back restores root, room remains direct',()=>{
  const h=harness({...adult,needAttention:'hunger'},{care:async()=>({ok:true})});h.button.emit('click',{detail:0});
  const p=h.doc.body.children[0],root=p.querySelector('.pg-menu-root');
  assert.equal(root.children.length,5);assert.match(p.querySelector('.pg-menu-care').className,/pg-menu-needs-care/);
  for(const id of ['care','talk','play','more'])assert.equal(p.querySelector('.pg-menu-'+id+'-group').hidden,true);
  group(p,'play');assert.equal(root.hidden,true);assert.equal(p.querySelector('.pg-menu-talk-group').hidden,true);
  p.querySelector('.pg-menu-back').emit('click');assert.equal(root.hidden,false);assert.equal(p.querySelector('.pg-menu-play-group').hidden,true);
  p.querySelector('.pg-menu-room').emit('click');assert.equal(h.opened,1);assert.equal(h.doc.body.children.length,0);h.controller.dispose();
});
test('eggs and tadpoles never show adult market or locked desk-toy buttons',()=>{
  for(const motion of ['egg','tadpole']) {
    const h=harness({...adult,adult:false,motion,sprite:'tb_'+motion+'.png'},{bond:{take:()=>null}});
    h.button.emit('click',{detail:0});const p=h.doc.body.children[0];
    assert.ok(!group(p,'talk').children.some(b=>b.textContent==='How is PEP?'));
    assert.ok(!group(p,'play').children.some(b=>b.textContent==='Roll the ball'));
    h.controller.dispose();
  }
});
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
  choose(h.doc.body.children[0],'play','Pond Quiz');
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
    choose(h.doc.body.children[0], ["Let's play!",'Watch Pond TV'].includes(label)?'play':'more',label);
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

test('each desk toy requests its own long play story and visible prop', () => {
  const animations = [], toys = [];
  const bond = { take: () => null, play: id => id === 'duck' ? 'toyFavourite' : 'toyOkay' };
  const h = harness(adult, { bond, animate: action => animations.push(action), showToy: id => toys.push(id) });
  const choices = [['Roll the ball', 'toyBall', 'ball'], ['Squeak the duck', 'toyDuck', 'duck'], ['Toss the bottle cap', 'toyCap', 'cap']];
  for (const [label, animation, toy] of choices) {
    h.button.emit('click', { detail: 0 }); choose(h.doc.body.children[0], 'play', label);
    assert.equal(animations.at(-1), animation); assert.equal(toys.at(-1), toy);
    h.controller.close({ reset: true });
  }
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
  group(h.doc.body.children[0],'care');
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
  const panel = h.doc.body.children[0], reply = panel.querySelector('.pg-fact-q');
  group(panel,'care');
  const feed = panel.querySelector('.pg-care-actions').children[0];
  feed.emit('click');
  choose(panel,'more','Secret Journal');
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

test('journal is available even without trust, but never offers a clue or detail', async () => {
  let reads = 0, opened = 0;
  const progress = { found: ['One mystery'], total: 12, hint: 'A subtle clue', detail: 'A second clue' };
  const h = harness({ ...adult, adult: false, motion: 'froglet' }, { readRumors: async () => { reads++; return { status: 'ok', progress }; }, openPassport: () => opened++ });
  h.button.emit('click', { detail: 0 });
  assert.equal(reads, 0);
  const panel = h.doc.body.children[0], actions = group(panel,'more'), reply = panel.querySelector('.pg-fact-q');
  assert.ok(!actions.children.some(b => b.textContent === 'Pond Rumors'));
  actions.children.find(b => b.textContent === 'Secret Journal').emit('click'); await Promise.resolve();
  assert.match(reply.textContent, /One mystery/); assert.equal(reads, 1);
  assert.doesNotMatch(reply.textContent, /clue/);
  assert.equal(panel.querySelector('.pg-rumor-actions').children.length, 1);
  panel.querySelector('.pg-rumor-actions').children[0].emit('click');
  assert.equal(opened, 1); assert.equal(h.doc.body.children.length, 0); h.controller.dispose();
});

test('a fresh greeting asks the notebook first and shows the clue it hands out, with the way to the table', async () => {
  let reads = 0, delivered = 0, visits = 0;
  const notebook = { notes: [], due: () => true, deliver: (view, found, life) => {
    delivered++; assert.deepEqual(found.allFoundIds, ['wrong_frog']); assert.equal(life, 'life-1');
    return delivered === 1 ? { kind: 'clue', secret: 'pond_map_1', text: 'Just between us, fren…\n\nA gentle clue.' } : null; } };
  const h = harness(adult, { bond: { take: () => null }, notebook, lifeId: () => 'life-1', openRoom: () => visits++,
    readRumors: async () => { reads++; return { status: 'ok', progress: { found: ['The Wrong Frog'], foundIds: ['wrong_frog'], allFoundIds: ['wrong_frog'], lastFoundAt: null, total: 12 } }; } });
  h.button.emit('click', { detail: 0 }); await Promise.resolve(); await Promise.resolve();
  const p = h.doc.body.children[0];
  assert.match(p.querySelector('.pg-fact-q').textContent, /A gentle clue/);
  assert.equal(reads, 1);
  p.querySelector('.pg-rumor-actions').children[0].emit('click');
  assert.equal(visits, 1);
  // nothing new to tell: the normal greeting stays
  h.button.emit('click', { detail: 0 }); await Promise.resolve(); await Promise.resolve();
  assert.doesNotMatch(h.doc.body.children[0].querySelector('.pg-fact-q').textContent, /gentle clue/);
  h.controller.dispose();
});

test('no notebook call and no Passport read when nothing is due', async () => {
  let reads = 0;
  const h = harness(adult, { bond: { take: () => null }, notebook: { notes: [], due: () => false, deliver: () => assert.fail('not due') },
    readRumors: async () => { reads++; return { status: 'ok', progress: { found: [], foundIds: [], total: 12 } }; } });
  h.button.emit('click', { detail: 0 }); await Promise.resolve(); await Promise.resolve();
  assert.equal(reads, 0); h.controller.dispose();
});

test('PEP commentary uses fresh quote only and distinguishes green, red and quiet days',()=>{
  const time=Date.now(),quote={time:new Date(time).toISOString(),change_24h:5};
  assert.equal(pepMood(quote,time),'up');assert.equal(pepMood({...quote,change_24h:-5},time),'down');
  assert.equal(pepMood({...quote,change_24h:1},time),'quiet');assert.equal(pepMood(quote,time+4*3600000),'unknown');
  assert.equal(pepMood({...quote,saved:true},time),'unknown');
  assert.match(companionReply(adult,'market',0,{quote,time}).text,/green/);
  assert.match(companionReply(adult,'market',0,{quote,time:time+4*3600000}).text,/off-air/);
});

test('late rumor responses cannot overwrite another action, a new discovery or a closed dialog', async () => {
  const resolvers = [];
  const h = harness(adult, { readRumors: () => new Promise(r => resolvers.push(r)) });
  h.button.emit('click', { detail: 0 });
  const panel = h.doc.body.children[0], reply = panel.querySelector('.pg-fact-q');
  const click = label => choose(panel,label==='Secret Journal'?'more':'talk',label);
  const result = { status: 'ok', progress: { found: [], total: 12, hint: 'Late clue', detail: 'Late detail' } };
  click('Secret Journal'); click('Tell me a joke'); const joke = reply.textContent; resolvers[0](result); await Promise.resolve(); assert.equal(reply.textContent, joke);
  click('Secret Journal'); h.controller.invalidateRumors(); resolvers[1](result); await Promise.resolve(); assert.match(reply.textContent, /new discovery/);
  click('Secret Journal'); h.controller.close(); resolvers[2](result); await Promise.resolve(); assert.equal(h.doc.body.children.length, 0);
  h.controller.dispose();
});
