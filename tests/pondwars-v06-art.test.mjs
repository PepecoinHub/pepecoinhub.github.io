import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CharacterAnimator, STATES, frameGeometry, characterPoint } from '../docs/games/js/pondwars-animation.mjs';
import { compilePixelManifest, authoredPose, pixelFrame, pixelHelmet } from '../docs/games/js/pondwars-pixel-art.mjs';
import { v06WeaponHold, qaTerrain } from '../docs/games/js/pondwars-v06-art.mjs';
import { HelmetCosmetics } from '../docs/games/js/pondwars-helmet.mjs';
const base=new URL('../docs/games/img/pondwars/players/pixel-v06/',import.meta.url);
const source=JSON.parse(readFileSync(new URL('manifest.json',base))), anchors=JSON.parse(readFileSync(new URL('qa-anchors.json',base)));
const manifest=compilePixelManifest(source,anchors,{frameCount:53}), asset={imageKey:'pixel-v06',manifest};

test('v06 registers 53 source slots without replacing source hand anchors for aim/charge/fire',()=>{
  assert.equal(Object.values(manifest.clips).reduce((n,c)=>n+c.frames.length,0),53);
  assert.deepEqual(Object.keys(manifest.clips).sort(),[...STATES].sort());
  for(const state of ['aim','charge','fire'])for(let i=0;i<manifest.clips[state].frames.length;i++)assert.deepEqual(manifest.clips[state].frames[i].hand,source.clips[state].frames[i].hand);
  for(const clip of Object.values(manifest.clips))for(const f of clip.frames){const q=frameGeometry(f);assert.deepEqual(f.foot,[64,122]);assert.equal(q.height,64);assert.equal(q.y+122*.5,0);}
  assert.deepEqual(source.clips.jump.frames[0].hand,[92,58]);assert.deepEqual(manifest.clips.jump.frames[0].hand,[97,51]);
  assert.ok(!Object.hasOwn(source.clips.idle.frames[0],'head'));
});

test('all eight backflip frames play once then return upright, while v04 still clamps as before',()=>{
  assert.equal(manifest.clips.backflip.frames.length,8);
  for(let i=0;i<8;i++)assert.equal(pixelFrame(asset,{state:'backflip',age:(i+.1)/12}),manifest.clips.backflip.frames[i]);
  for(const age of [8/12,.7,2])assert.equal(pixelFrame(asset,{state:'backflip',age}),manifest.clips.backflip.frames[0]);
  const interrupted=authoredPose({state:'backflip',age:0},{flipT:.8},'pixel-v06');
  assert.equal(pixelFrame(asset,interrupted),manifest.clips.backflip.frames[0],'hit recovery must not replay a completed physical flip');
  const old={imageKey:'pixel-v04',manifest};assert.equal(pixelFrame(old,{state:'backflip',age:2}),manifest.clips.backflip.frames[7]);
  assert.equal(new Set(manifest.clips.backflip.frames.map(f=>f.head.join(','))).size,8);
});

test('rotated helmets detach from their registered per-frame position in both directions',()=>{
  for(const clip of Object.values(manifest.clips))for(const frame of clip.frames)for(const face of [-1,1]){
    const f={id:0,x:400,y:300,hp:100,face},h=new HelmetCosmetics(),p=authoredPose({rotation:2,sx:1.4,sy:.8,dx:2,dy:4}),art=pixelHelmet(frame,'pixel-v06');
    h.restore({frogs:[f]});f.hp--;h.lose(f,100,0,p,false,art);const flight=h.sample(0)[0],center=characterPoint(f,p,art.center);
    assert.equal(flight.x,center.x);assert.equal(flight.y,center.y);assert.equal(flight.imageKey,'pixel-v06');assert.deepEqual(flight.rect,frame.helmetRect);
    assert.equal(flight.width,frame.helmetRect[2]*.5);assert.equal(flight.height,frame.helmetRect[3]*.5);
    h.restore({frogs:[f]});assert.equal(h.wearing(f),false);assert.equal(h.sample(.1).length,0);
  }
});

test('four weapon SVG handle points map exactly onto the hand without inherited icon offsets',()=>{
  for(const weapon of ['rocket','bow','revolver','grenade']){
    const h=v06WeaponHold(weapon);
    assert.equal(h.ox+h.grip[0]*h.w/64,0);assert.equal(h.oy+h.grip[1]*h.h/64,0);
    const svg=readFileSync(new URL('../docs/games/img/pondwars/'+weapon+'.svg',import.meta.url),'utf8');assert.match(svg,/viewBox="0 0 64 64"/);
  }
  assert.equal(v06WeaponHold('teleport'),null);
  assert.deepEqual(v06WeaponHold('bow').grip,[41,33]);
});

test('QA terrain choices reproduce identical v04/v06 board inputs, and invalid/non-QA parameters cannot override defaults',()=>{
  const defaults={map:'island',mapSeed:20261103,n:3},maps={island:{},twin:{},small:{}};
  const a=qaTerrain('?art=pixel-v04&qaSeed=123&qaMap=twin',maps,defaults),b=qaTerrain('?art=pixel-v06&qaSeed=123&qaMap=twin',maps,defaults);
  assert.deepEqual(a,b);assert.equal(a.mapSeed,123);assert.equal(a.map,'twin');
  assert.equal(qaTerrain('?qaSeed=7&qaMap=small',maps,defaults),defaults);
  for(const seed of ['','-1','NaN','1.5','4294967296'])assert.deepEqual(qaTerrain('?art=pixel-v06&qaSeed='+seed+'&qaMap=__proto__',maps,defaults),defaults);
});

test('53-frame registration is opt-in and v06 atlases are RGBA 1024x1024',()=>{
  assert.throws(()=>compilePixelManifest(source,anchors));
  for(const file of ['atlas.png','helmet_pose_atlas.png']){const png=readFileSync(new URL(file,base));assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1024,1024]);assert.equal(png[25],6);}
  for(const clip of Object.values(manifest.clips))for(const f of clip.frames)assert.ok(f.rect[0]+128<=1024 && f.rect[1]+128<=1024);
});

test('v06 timing agrees at 30/60/144 FPS, pause freezes frame selection and reduced motion stays on frame zero',()=>{
  for(const time of [.62,.8]){
    const frames=[30,60,144].map(fps=>{
      const a=new CharacterAnimator();let elapsed=0;
      while(elapsed<time-1e-12){const dt=Math.min(1/fps,time-elapsed);a.advance(dt);elapsed+=dt;}
      const p={state:'backflip',age:a.time},frame=pixelFrame(asset,p);a.advance(3,true);
      assert.equal(pixelFrame(asset,{...p,age:a.time}),frame);assert.equal(pixelFrame(asset,p,true),manifest.clips.backflip.frames[0]);return frame;
    });assert.equal(frames[0],frames[1]);assert.equal(frames[0],frames[2]);
  }
});
