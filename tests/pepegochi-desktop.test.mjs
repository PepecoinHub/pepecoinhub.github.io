import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_REACTIONS, mountDesktopCompanion, perchPoint } from '../docs/meme/pepegochi-desktop.mjs';
import { companionReply } from '../docs/meme/pepegochi-interactions.mjs';

test('perching only fits above a safe, non-mobile window', () => {
  const rect = { left: 240, right: 640, top: 50, width: 400 };
  assert.deepEqual(perchPoint(rect, 1440, 900), { x: 360, y: 3 });
  assert.equal(perchPoint(rect, 390, 720), null);
  assert.equal(perchPoint({ ...rect, top: 20 }, 900, 720), null);
  assert.equal(perchPoint({ ...rect, top: 680 }, 900, 720), null);
  assert.equal(perchPoint({ ...rect, left: -500, right: -100 }, 900, 720), null);
});

function fixture() {
  let time = 0, usable = true, quiet = false, view = { hasPet: true, adult: true, sprite: 'taskbar/tb_adult_sit.png' }, next = 0;
  const timers = new Map(), frames = new Map(), reactions = [];
  class Element {
    constructor(rect = {left: 0, top: 0, right: 48, bottom: 48, width: 48, height: 48}) {
      this.rect = rect; this.style = {}; this.children = []; this.isConnected = true; this.listeners = {};
      const classes = new Set(); this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) };
    }
    addEventListener(k, f) { (this.listeners[k] ??= new Set()).add(f); }
    removeEventListener(k, f) { this.listeners[k]?.delete(f); }
    emit(k, e = {}) { for (const f of this.listeners[k] || []) f({ target: this, ...e }); }
    getBoundingClientRect() { return this.rect; }
    setAttribute() {}
    closest() { return null; }
    matches(s) { return s === '.app-win'; }
    querySelector() { return null; }
    append(el) { this.children.push(el); el.parent = this; }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
    animate() { return { cancel() {} }; }
  }
  const doc = new Element(), win = new Element(), reduce = new Element(); reduce.matches = false;
  doc.defaultView = win; doc.body = new Element(); doc.documentElement = new Element(); doc.documentElement.classList.add('sky-night');
  const sky = new Element(), fly = new Element({left: 150, top: 470, width: 6, height: 6});
  doc.querySelector = s => s.includes('.scene-night.ready') ? sky : null; doc.querySelectorAll = () => [fly];
  doc.elementFromPoint = () => doc.body; doc.createElement = () => new Element();
  Object.assign(win, { innerWidth: 900, innerHeight: 600, matchMedia: () => reduce, getComputedStyle: () => ({opacity: 1}),
    setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) });
  const slot = new Element(), img = new Element({left: 70, top: 510, right: 118, bottom: 558, width: 48, height: 48}); slot.ownerDocument = doc;
  img.src = 'taskbar/tb_adult_sit.png';
  const control = mountDesktopCompanion({slot,img,base:'/',getView:()=>view,eligible:manual=>usable&&(manual||!quiet),mayStart:()=>true,react:x=>reactions.push(x),onStart(){},onEnd(){},now:()=>time});
  const finish = () => { for (const [id, f] of [...timers]) { timers.delete(id); f(); } };
  const watch = () => { for (const [id, f] of [...frames]) { frames.delete(id); f(); } };
  return { control, doc, win, reduce, sky, fly, slot, reactions, finish, watch, advance: () => time+=100000, disable: () => usable=false,
    quiet: () => quiet=true, froglet: () => {view={hasPet:true,adult:false,motion:'froglet',playReady:true,sprite:'taskbar/tb_froglet.png'}; img.src=view.sprite},
    needCare: () => view={...view,playReady:false,needAttention:'hunger'},
    hungry: () => view={...view,sprite:'taskbar/tb_adult_hungry.png'}, host: () => new Element({left: 350,right:690,top:140,width:340,height:180}) };
}

test('actual desktop controller borrows only a visible night fly and restores every overlay', () => {
  const f = fixture();
  assert.equal(f.control.fireflyAvailable(), true);
  f.doc.emit('click',{button:0,clientX:153,clientY:473});
  assert.equal(f.control.active,true);assert.equal(f.fly.classList.contains('pg-fly-borrowed'),true);assert.equal(f.doc.body.children.length,3);
  f.finish();assert.deepEqual(f.reactions,['desktopFirefly']);assert.equal(f.doc.body.children.length,0);assert.equal(f.fly.classList.contains('pg-fly-borrowed'),false);
  assert.equal(f.control.catchNearby(),false); // cooldown
  f.advance();f.doc.documentElement.classList.remove('sky-night');assert.equal(f.control.ambient(),false);
  f.doc.documentElement.classList.add('sky-night');assert.equal(f.control.ambient(),true);f.doc.emit('keydown');assert.equal(f.control.active,false);
  f.advance();f.reduce.matches=true;assert.equal(f.control.catchNearby(),false);f.reduce.matches=false;
  f.advance();assert.equal(f.control.catchNearby(),true);f.hungry();f.watch();assert.equal(f.control.active,false);assert.equal(f.slot.classList.contains('pg-desktop-away'),false);
  f.control.dispose();assert.equal(f.doc.body.children.length,0);assert.equal(f.win.listeners['pondos:app-opened'].size,0);
});

test('a healthy froglet uses its own sprite; quiet blocks automatic but not manual firefly play',()=>{
 const f=fixture();f.froglet();f.quiet();assert.equal(f.control.ambient(),false);
 assert.equal(f.control.fireflyAvailable(),true);assert.equal(f.control.catchNearby(),true);
 assert.equal(f.doc.body.children.find(x=>x.className==='pg-desktop-frog-frame').src,'taskbar/tb_froglet.png');
 f.needCare();f.watch();assert.equal(f.control.active,false);assert.equal(f.control.fireflyAvailable(),false);f.control.dispose();
});

test('desk toys become a full-screen chase and occasional autonomous play', () => {
  const f = fixture();
  assert.equal(f.control.playToy('ball'), true);
  assert.equal(f.control.active, true);
  assert.deepEqual(f.doc.body.children.map(x => x.className), ['pg-desktop-frog-frame pg-desktop-playing', 'pg-desktop-play-toy']);
  f.finish(); assert.equal(f.control.active, false); assert.equal(f.doc.body.children.length, 0);
  f.doc.documentElement.classList.remove('sky-night'); f.advance(); f.advance();
  assert.equal(f.control.ambient(), false, 'two quiet minutes are not enough any more');
  f.advance();
  assert.equal(f.control.ambient(), true, 'after five quiet minutes the frog starts a bounded play story');
  f.finish(); assert.equal(f.control.active, false); f.control.dispose();
});

test('perching and popcorn use actual app openings, cancel on movement and leave gameplay alone', () => {
  const f=fixture(), host=f.host();
  f.win.emit('pondos:app-opened',{detail:{id:'yeet',host}});assert.equal(f.control.active,false);
  f.win.emit('pondos:app-opened',{detail:{id:'games',host}});assert.equal(f.control.active,true);assert.equal(f.slot.classList.contains('pg-desktop-away'),true);
  host.rect={...host.rect,top:141+4};f.watch();assert.equal(f.control.active,false);assert.deepEqual(f.reactions,[]);
  f.advance();f.win.emit('pondos:app-opened',{detail:{id:'tv',host}});assert.equal(f.doc.body.children[0].className,'pg-desktop-popcorn');
  f.finish();assert.deepEqual(f.reactions,['desktopTV']);assert.equal(f.doc.body.children.length,0);
  f.advance();f.disable();f.win.emit('pondos:app-opened',{detail:{id:'tv',host}});assert.equal(f.control.active,false);f.control.dispose();
});

test('app dialogue is local and never overrides a need or a young stage', () => {
  const adult = { hasPet: true, adult: true, sprite: 'taskbar/tb_adult_sit.png' };
  assert.match(companionReply(adult, APP_REACTIONS.tv).text, /popcorn/);
  assert.match(companionReply(adult, 'desktopFirefly').text, /tiny lamp/);
  assert.match(companionReply({ ...adult, sprite: 'taskbar/tb_adult_hungry.png' }, APP_REACTIONS.tv).text, /stomach/);
  assert.equal(companionReply({ ...adult, adult: false }, 'desktopFirefly').pose, null);
  for (const game of ['yeet', 'wp', 'pondwars', 'pepesweeper', 'goldhook', 'miner', 'lan', 'pepegochi']) assert.equal(Object.hasOwn(APP_REACTIONS, game), false);
});
