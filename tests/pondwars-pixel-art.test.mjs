import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CharacterAnimator, STATES, spriteFrame, frameGeometry, characterPoint } from '../docs/games/js/pondwars-animation.mjs';
import { compilePixelManifest, authoredPose, clipDuration, pixelHelmet } from '../docs/games/js/pondwars-pixel-art.mjs';
import { HelmetCosmetics } from '../docs/games/js/pondwars-helmet.mjs';
const base = new URL('../docs/games/img/pondwars/players/pixel-v04/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('manifest.json', base))), anchors = JSON.parse(readFileSync(new URL('qa-anchors.json', base)));
const compiled = compilePixelManifest(source, anchors);

test('all 49 QA frames retain source timing/rect/feet and use explicitly measured head and grip', () => {
  const original = JSON.stringify(source);
  assert.equal(anchors.frames.length, 49);
  assert.deepEqual(Object.keys(compiled.clips).sort(), [...STATES].sort());
  for (const state of STATES) {
    assert.equal(compiled.clips[state].fps, source.clips[state].fps);
    assert.equal(compiled.clips[state].loop, source.clips[state].loop);
    for (let i=0; i<compiled.clips[state].frames.length; i++) {
      const frame=compiled.clips[state].frames[i], q=frameGeometry(frame);
      assert.deepEqual(frame.rect,source.clips[state].frames[i].rect); assert.deepEqual(frame.foot,[64,122]);
      assert.equal(q.height,64); assert.equal(q.y+122*.5,0);
      assert.ok(frame.head && frame.helmetRect && frame.hand);
    }
  }
  assert.equal(JSON.stringify(source), original);
  assert.deepEqual(source.clips.aim.frames[0].hand,[98,70]);
  assert.deepEqual(compiled.clips.aim.frames[0].hand,[46,81]);
});

test('invalid, missing or duplicated QA registration is rejected before any image replacement', () => {
  const copy=()=>JSON.parse(JSON.stringify(anchors));
  for (const mutate of [a=>a.frames.pop(),a=>a.frames.push(a.frames[0]),a=>a.frames[0].head=[999,1],a=>a.frames[0].helmetRect=[0,0,500,500],a=>a.frames[0].index=2]) {
    const bad=copy();mutate(bad);assert.throws(()=>compilePixelManifest(source,bad));
  }
});

test('authored rendering removes procedural double motion for all states while retaining KO fade', () => {
  for (const state of STATES) {
    const raw={state,age:.2,dx:4,dy:-3,rotation:1.7,sx:.8,sy:1.2,alpha:.4};
    const pose=authoredPose(raw);
    assert.deepEqual([pose.dx,pose.dy,pose.rotation,pose.sx,pose.sy],[0,0,0,1,1]);
    assert.equal(pose.alpha,.4); assert.equal(raw.rotation,1.7);
  }
});

test('authored fire/landing/hit states last long enough to display their final frame at supplied fps', () => {
  const f={id:0,team:0,x:100,y:300,hp:100,alive:true,ground:true,vy:0,face:1};
  const g={frogs:[f],current:0,phase:'aim'}, a=new CharacterAnimator();
  const options={durationFor:(_f,state)=>clipDuration(compiled,state)};
  a.observe(g,[],options);a.observe(g,[{type:'fire'}],options);
  a.advance(.35);a.observe(g,[],options);
  assert.equal(a.sample(f).state,'fire'); assert.equal(spriteFrame(compiled,'fire',a.sample(f).age),compiled.clips.fire.frames[5]);
  a.advance(.06);a.observe(g,[],options);assert.equal(a.sample(f).state,'aim');
  f.ground=false;a.observe(g,[],options);f.ground=true;a.observe(g,[],options);
  a.advance(.29);a.observe(g,[],options);assert.equal(a.sample(f).state,'landing');
  assert.equal(spriteFrame(compiled,'landing',a.sample(f).age),compiled.clips.landing.frames[3]);
  f.hp--;a.observe(g,[],options);a.advance(.38);a.observe(g,[],options);
  assert.equal(a.sample(f).state,'hit');assert.equal(spriteFrame(compiled,'hit',a.sample(f).age),compiled.clips.hit.frames[4]);
});

test('clip sampling is independent of 30/60/144 FPS and reduced motion selects first frame', () => {
  for (const state of STATES) {
    const results=[30,60,144].map(fps=>{
      const a=new CharacterAnimator();let time=0;
      while(time<1.03-1e-12){const dt=Math.min(1/fps,1.03-time);a.advance(dt);time+=dt;}
      const frame=spriteFrame(compiled,state,a.time);
      a.advance(5,true);assert.equal(spriteFrame(compiled,state,a.time),frame);
      assert.equal(spriteFrame(compiled,state,a.time,true),compiled.clips[state].frames[0]);
      return frame;
    });assert.equal(results[0],results[1]);assert.equal(results[0],results[2]);
  }
});

test('each helmet atlas crop detaches at the same head anchor in both directions with no repeated loss', () => {
  for (const clip of Object.values(compiled.clips)) for (const frame of clip.frames) for(const face of [-1,1]) {
    const f={id:0,x:500,y:300,hp:100,face}, h=new HelmetCosmetics(), pose=authoredPose({rotation:.8,sx:2,sy:2,dx:4,dy:3});
    h.restore({frogs:[f]});f.hp=99;
    const art=pixelHelmet(frame);h.lose(f,100,0,pose,false,art);
    const p=h.sample(0)[0],center=characterPoint(f,pose,art.center);
    assert.equal(p.x,center.x);assert.equal(p.y,center.y);assert.equal(p.imageKey,'pixel-v04');assert.deepEqual(p.rect,frame.helmetRect);
    assert.equal(p.width,44);assert.equal(p.height,18);f.hp=98;h.lose(f,99,.1,pose,false,art);assert.equal(h.flights.length,1);
  }
});

test('body and parallel helmet atlas have matching RGBA dimensions; each frame stays inside its own tile', () => {
  for(const file of ['atlas.png','helmet_pose_atlas.png']){
    const png=readFileSync(new URL(file,base));assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1024,896]);assert.equal(png[25],6);
  }
  for(const clip of Object.values(compiled.clips))for(const frame of clip.frames){
    const [x,y,w,h]=frame.rect;assert.ok(x+w<=1024 && y+h<=896);
    const q=pixelHelmet(frame);assert.ok(q.x>=-32 && q.x+q.width<=32);assert.ok(q.y>=-61);
  }
});
