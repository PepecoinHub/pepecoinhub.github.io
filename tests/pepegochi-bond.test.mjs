import test from 'node:test';
import assert from 'node:assert/strict';
import { createBond, trustedForRumors } from '../docs/meme/pepegochi-bond.mjs';
const frog = { life_id: 'one', stage: 'adult', status: 'healthy', needs: { hunger: 30, hygiene: 90, mood: 80, energy: 70 } };
const storage = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k, v) => m.set(k, v) }; };
test('care, growth and absence come from observed changes, not a repeated refresh', () => {
  let time = 1000;
  const b = createBond({ storage: storage(), now: () => time });
  assert.equal(b.observe('a', frog), null);
  const fed = { ...frog, needs: { ...frog.needs, hunger: 70 } };
  assert.equal(b.observe('a', fed), 'fed');
  assert.equal(b.observe('a', fed), null);
  assert.equal(b.take(), 'fed'); assert.equal(b.take(), null);
  time += 1800000;
  assert.equal(b.observe('a', fed), 'return');
  assert.equal(b.observe('a', fed), null);
  assert.equal(b.observe('a', { ...fed, stage: 'froglet' }), 'grown');
});
test('familiar gestures and quiet setting survive reload, isolated by owner and life', () => {
  const s = storage();
  const b = createBond({ storage: s }); b.observe('a', frog);
  b.pet(); b.pet(); b.pet(); b.toggleMute();
  const c = createBond({ storage: s }); c.observe('a', frog);
  assert.ok(c.familiar); assert.ok(c.muted);
  c.observe('b', frog); assert.equal(c.familiar, false); assert.equal(c.muted, false);
  c.observe('a', { ...frog, life_id: 'two' }); assert.equal(c.familiar, false);
  c.observe('a', frog); assert.ok(c.familiar);
  c.observe(null, null); assert.equal(c.familiar, false); assert.equal(c.take(), null);
});
test('missing, blocked or corrupt storage does not break interactions', () => {
  for (const s of [undefined, { getItem() { throw Error(); }, setItem() { throw Error(); } }, { getItem: () => '{' }, { getItem: () => 'null' }]) {
    const b = createBond({ storage: s }); b.observe('a', frog); b.pet(); b.toggleMute(); b.touch(); b.reset();
    assert.equal(b.take(), null);
  }
});

test('taskbar care consumes only its own cue and preserves a queued Passport reaction', () => {
  const b = createBond({ storage: storage() });
  b.observe('a', frog);
  b.remember('secret');
  const event = b.observe('a', { ...frog, needs: { ...frog.needs, hunger: 90 } });
  assert.equal(event, 'fed');
  b.consumeCare(event);
  assert.equal(b.take(), 'secret');
  assert.equal(b.take(), null);
});

test('rumors require high trust, only roll daily and cool down fourteen days across reloads and tabs',()=>{
  const s=storage(), day=86400000;let time=20*day, rolls=0;
  const make=()=>createBond({storage:s,now:()=>time,random:()=>{rolls++;return 0;}});
  const a=make(), b=make(); a.observe('a',frog); b.observe('a',frog);
  const v={hasPet:true,adult:true,motion:'adult',trustReady:true,careDays:14};
  for(const bad of [{careDays:13},{trustReady:false},{adult:false},{motion:'froglet'},{warning:true}]) {
    assert.equal(trustedForRumors({...v,...bad}),false);assert.equal(a.tryRumor({...v,...bad}),false);
  }
  assert.equal(rolls,0);assert.equal(a.tryRumor(v),true);assert.equal(b.tryRumor(v),false);
  b.pet();const reload=make();reload.observe('a',frog);assert.equal(reload.tryRumor(v),false);
  time+=13*day;assert.equal(reload.tryRumor(v),false);time+=day;assert.equal(reload.tryRumor(v),true);
  assert.equal(rolls,2);reload.observe('b',frog);assert.equal(reload.tryRumor(v),true);
  const denied=createBond({now:()=>time,random:()=>0});denied.observe('a',frog);assert.equal(denied.tryRumor(v),false);
});

test('a failed rumor roll cannot be retried on the same day; a full day absence gets its own greeting',()=>{
  let time=86400000, rolls=0;const b=createBond({storage:storage(),now:()=>time,random:()=>{rolls++;return 0.99;}});
  const v={hasPet:true,adult:true,motion:'adult',trustReady:true,careDays:14};b.observe('a',frog);
  assert.equal(b.tryRumor(v),false);assert.equal(b.tryRumor(v),false);assert.equal(rolls,1);
  time+=86400000;assert.equal(b.observe('a',frog),'returnLong');assert.equal(b.tryRumor(v),false);assert.equal(rolls,2);
});
