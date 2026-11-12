import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateClip,clipFrame,authoredEffect,meleeImpactPoints,BAN_HOLD} from '../docs/games/js/pondwars-weapon-art.mjs';
import {newGame,startTurn,fire,WEAPONS,W,H} from '../docs/games/js/pondwars-beta-engine.mjs';
const root=new URL('../docs/games/art/arsenal-polish/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),patch=JSON.parse(readFileSync(new URL('v13/handoff/manifest_patch.json',root)));
const hashes=JSON.parse(readFileSync(new URL('v13/handoff/sha256.json',root)));
test('six original v13 atlases, 42 frames and merged descriptors keep safe sizes/posters',()=>{
 let count=0,roles=0;
 for(const [id,entries] of Object.entries(patch.weapons))for(const [role,c] of Object.entries(entries)){
  assert.deepEqual(manifest.weapons[id][role],c);assert.ok(validateClip(c));assert.ok(authoredEffect(c));
  const b=readFileSync(new URL(c.src.replace('art/arsenal-polish/',''),root));assert.equal(createHash('sha256').update(b).digest('hex'),hashes[c.src.split('/').pop()]);assert.equal(b.readUInt32BE(16),c.frames*128);assert.equal(b.readUInt32BE(20),128);assert.equal(b[25],6);
  for(let i=0;i<c.frames;i++)assert.equal(clipFrame(c,(i+.1)/c.fps).n,i);
  for(const age of [0,.1,.5,2])assert.equal(clipFrame(c,age,true).n,c.reducedFrame);
  assert.equal(clipFrame(c,4).n,c.frames-1);count+=c.frames;roles++;
 }
 assert.equal(count,42);assert.equal(roles,6);
 assert.equal(manifest.weapons.donkey.flight.src,'art/arsenal-polish/v12/sprites/silver_donkey_atlas.png');assert.deepEqual(manifest.weapons.donkey.flight.anchor,[52,64]);assert.equal(manifest.weapons.ban.flight,null);
});
function fixture(){const g=newGame({seed:123,perTeam:2,packs:'all',cpu:[false,false]});g.mask.fill(0);for(let y=450;y<H;y++)g.mask.fill(1,y*W,(y+1)*W);g.frogs.forEach((f,i)=>Object.assign(f,{x:[400,435,600,800][i],y:449,vx:0,vy:0,hp:100,alive:true,ground:true}));startTurn(g);g.weapon='ban';return g;}
test('Ban contact metadata uses the existing strict 48px hit loop and never adds a whiff impact',()=>{
 const g=fixture();g.frogs[1].x=447.99;g.frogs[2].x=448;g.frogs[3].x=455;fire(g,0,1);
 const e=g.events.find(e=>e.type==='melee_contacts');assert.deepEqual(e.contacts.map(c=>c.id),[1]);assert.equal(e.range,48);assert.equal(g.frogs[1].hp,58);assert.equal(g.frogs[2].hp,100);assert.equal(g.frogs[3].hp,100);assert.equal(g.ammo[0].ban,1);
 const miss=fixture();miss.frogs[1].x=455;fire(miss,0,1);assert.deepEqual(miss.events.find(e=>e.type==='melee_contacts').contacts,[]);assert.equal(miss.frogs[1].hp,100);
});
test('Ban grip maps exactly to the hand and sparks stay on actual near-side contacts in both directions',()=>{
 assert.equal(BAN_HOLD.ox+34*BAN_HOLD.w/64,0);assert.equal(BAN_HOLD.oy+46*BAN_HOLD.h/64,0);assert.equal(BAN_HOLD.base,Math.PI/2);
 for(const face of [-1,1])for(const dy of [-30,0,30]){
  const event={origin:{x:400,y:449},face,range:WEAPONS.ban.range,contacts:[{id:1,x:400+face*30,y:449+dy}]};
  const p=meleeImpactPoints(event,{x:400+face*12,y:419})[0];assert.equal(p.x,400+face*22);assert.ok(p.y>=event.contacts[0].y-48&&p.y<=event.contacts[0].y-12);assert.ok(Math.hypot(p.x-400,p.y+32-449)<48);
 }
 assert.deepEqual(meleeImpactPoints({contacts:[]},{x:0,y:0}),[]);
});
test('warning holds last frame until launch; independent simultaneous bursts use their own clock',()=>{
 const warn=manifest.weapons.donkey.activation;assert.equal(clipFrame(warn,1.14).n,5);assert.equal(clipFrame(warn,1.14,true).n,0);
 const pep=manifest.weapons.pep.explosion;const bursts=[0,.1,.2,.3,.4,.5].map(start=>clipFrame(pep,.55-start).n);assert.ok(new Set(bursts).size>=4);
 assert.equal(authoredEffect(manifest.weapons.goldv2.explosion),false);assert.equal(authoredEffect(manifest.weapons.pep.explosion),true);
});
