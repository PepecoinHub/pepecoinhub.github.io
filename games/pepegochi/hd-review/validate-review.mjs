// Run with node validate-review.mjs; ImageMagick required for pixel-bound checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SPRITES, CARE, WALK, CARE_MS, HATCH_MS, DEPART_MS } from '../../../docs/games/js/pepegochi-room.mjs';

const home = path.dirname(fileURLToPath(import.meta.url));
const expected = new Set([
  ...Object.keys(SPRITES).map(id => `pepegochi_${id}.png`),
  ...Object.values(CARE).flat().map(id => `${id}.png`),
  ...Object.values(WALK).flatMap(w => [...w.turn, ...w.walk]),
]);
assert.deepEqual(new Set(fs.readdirSync(path.join(home, 'frames'))), expected);
for (const file of expected) {
  const f = path.join(home, 'frames', file);
  const png = fs.readFileSync(f);
  assert.equal(png.readUInt32BE(16), 256, file);
  assert.equal(png.readUInt32BE(20), 256, file);
  assert.equal(png[25], 6, `${file}: RGBA`);
  const [min, max, box] = execFileSync('magick', [f, '-alpha', 'extract', '-threshold', '30%', '-format', '%[fx:minima] %[fx:maxima] %@', 'info:'], { encoding:'utf8' }).split(' ');
  assert.equal(min, '0', file); assert.equal(max, '1', file);
  const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box);
  assert.ok(m, file); assert.equal(+m[2] + +m[4], 248, `${file}: foot line`);
  assert.ok(+m[1] + +m[3] <= 256, file);
}

const html = fs.readFileSync(path.join(home, 'preview.html'), 'utf8');
const buttons = kind => [...html.matchAll(new RegExp(`<button data-${kind}="([^"]+)"`, 'g'))].map(m => ({dataset: {[kind]: m[1]}, setAttribute(k,v){ this[k]=v; }}));
const stages = buttons('stage'), actions = buttons('action'), handlers = {}, timers = [];
const img = () => ({set src(src){ assert.ok(fs.existsSync(path.resolve(home, src)), src); this.value=src; }});
const old = img(), next = img();
const document = {getElementById(id){return ({old,new:next}[id])??{addEventListener(type,f){handlers[id]=f;}};},querySelectorAll(s){return s==='[data-stage]'?stages:actions;}};
vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {document, setTimeout:(f,ms)=>(timers.push({f,ms}),timers.length),clearTimeout:()=>{timers.length=0;}});
const click = (id,b) => handlers[id]({target:{closest:()=>b}});
const chooseStage = s => click('stages', stages.find(x=>x.dataset.stage===s));
const chooseAction = a => click('controls', actions.find(x=>x.dataset.action===a));
function checkSequence(files, ms) {
  for (const f of files) {
    assert.equal(next.value, `frames/${f}`);
    const t = timers.shift(); assert.ok(t); assert.equal(t.ms,ms); t.f();
  }
  assert.equal(timers.length,0);
}
for (const s of ['tadpole','froglet','adult']) {
  chooseStage(s); const idle=`frames/pepegochi_${s}_idle.png`;
  assert.equal(next.value,idle);
  for (const a of ['feed','clean','play','rest']) {
    chooseAction(a); checkSequence(CARE[`${s}_${a}`].map(id=>id+'.png'), CARE_MS); assert.equal(next.value,idle);
  }
  for (const a of ['hungry','dirty','moody','tired','neglected','packing','recovering']) {
    chooseAction(a); assert.equal(next.value,`frames/pepegochi_${s}_${a}.png`); assert.equal(timers.length,0);
  }
  chooseAction('depart'); const w=WALK[s]; checkSequence([...w.turn,...w.walk,...w.walk],DEPART_MS); assert.equal(next.value,idle);
}
chooseStage('egg'); chooseAction('hatch'); checkSequence([1,2,3,4].map(n=>`pepegochi_hatch_0${n}.png`),HATCH_MS);
assert.equal(next.value,'frames/pepegochi_tadpole_idle.png');
assert.equal(stages.find(b=>b.dataset.stage==='tadpole')['aria-pressed'],'true');
console.log(`PASS: ${expected.size} RGBA sprites, 4 life stages, 12 care cycles, 3 departures, 21 states, hatch and production timings`);
