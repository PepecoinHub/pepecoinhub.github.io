import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {clipFrame,validateClip} from '../docs/games/js/pondwars-weapon-art.mjs';
const root=new URL('../docs/games/art/arsenal-polish/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
const audit=JSON.parse(readFileSync(new URL('v11/handoff/asset_validation.json',root)));
const descriptors=JSON.parse(readFileSync(new URL('v11/handoff/manifest_patch.json',root)));
descriptors.donkey.flight=JSON.parse(readFileSync(new URL('v12/handoff/manifest_patch.json',root))).weapons.donkey.flight;
const live=Object.entries(descriptors).flatMap(([id,roles])=>Object.keys(roles).map(role=>[id,role,manifest.weapons[id][role]]));
test('all seven installed PNGs match original v11 hashes, RGBA dimensions and atlas bounds',()=>{
  for(const [name,expected] of Object.entries(audit)){
    const effect=['doge_blast','donkey_impact'].includes(name);
    const b=readFileSync(new URL(`v11/${effect?'effects':'sprites'}/${name}_atlas.png`,root));
    assert.equal(createHash('sha256').update(b).digest('hex'),expected.sha256,name);
    assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),expected.frame_px[0]*expected.frames);assert.equal(b.readUInt32BE(20),expected.frame_px[1]);assert.equal(b[25],6,'RGBA');
  }
});
test('six runtime clips preserve handoff timing, geometry and separate HUD paths; Ban stays manual',()=>{
  assert.equal(live.length,6);
  for(const [id,role,c] of live){assert.ok(validateClip(c),id+'/'+role);for(const [key,value] of Object.entries(descriptors[id][role]))assert.deepEqual(c[key],value,id+'/'+role+'/'+key);}
  assert.deepEqual(manifest.weapons.ban,{flight:null,activation:null,explosion:null});assert.equal(manifest.weapons.donkey.activation,null);
  assert.ok(manifest.weapons.goldv2.explosion.src.endsWith('golden_foot_impact_sheet.png'));assert.equal(manifest.weapons.rain.flight,null,'the selectable salvo is not a falling subprojectile');
});
test('all 44 active frames map inside PNGs at arbitrary FPS with matching render anchors',()=>{
 let count=0;
 for(const [,role,c] of live){for(let n=0;n<c.frames;n++){const q=clipFrame(c,(n+.1)/c.fps);assert.equal(q.n,n);assert.ok(q.sx+q.sw<=c.columns*c.frame[0]);assert.equal(q.x,-c.anchor[0]*c.size[0]/c.frame[0]);assert.equal(q.y,-c.anchor[1]*c.size[1]/c.frame[1]);count++;}
  for(const fps of [30,60,144]){const time=Math.round(.4*fps)/fps;assert.equal(clipFrame(c,time).n,Math.min(c.frames-1,Math.floor(time*c.fps)),'time selection');}
  if(role==='flight')assert.equal(clipFrame(c,c.frames/c.fps).n,0);else assert.equal(clipFrame(c,10).n,c.frames-1);
 }
 assert.equal(count,44);
});
test('reduced motion freezes flight and chooses a visible burst poster; offsets stay cosmetic',()=>{
 for(const [,role,c] of live)for(const age of [0,.15,.5,3])assert.equal(clipFrame(c,age,true).n,role==='explosion'?4:0);
 assert.equal(manifest.weapons.moon.flight.rotationOffset,Math.PI/4);
 assert.equal(validateClip({...manifest.weapons.moon.flight,rotationOffset:NaN}),false);
 assert.equal(validateClip({...manifest.weapons.doge.explosion,reducedFrame:8}),false);
});

test('v12 Donkey is the supplied PNG with compensated anchor and unchanged flight timing/scale',()=>{
 const qa=JSON.parse(readFileSync(new URL('v12/handoff/QA.json',root)));
 const b=readFileSync(new URL('v12/sprites/silver_donkey_atlas.png',root));
 assert.equal(createHash('sha256').update(b).digest('hex'),qa.corrected_sha256);
 assert.equal(b.readUInt32BE(16),1024);assert.equal(b.readUInt32BE(20),128);assert.equal(b[25],6);
 const before=JSON.parse(readFileSync(new URL('v11/handoff/manifest_patch.json',root))).donkey.flight,after=manifest.weapons.donkey.flight;
 for(const key of ['size','frame','columns','frames','fps','loop'])assert.deepEqual(after[key],before[key]);
 for(let n=0;n<8;n++){const a=clipFrame(before,(n+.1)/12),b=clipFrame(after,(n+.1)/12);assert.equal(a.n,b.n);
  for(const [x,y] of [[24,6],[64,64],[100,80]]){assert.equal(a.x+x*52/128,b.x+(x-12)*52/128);assert.equal(a.y+y*52/128,b.y+y*52/128);}
 }
});
