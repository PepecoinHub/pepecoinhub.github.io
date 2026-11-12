import test from 'node:test';
import assert from 'node:assert/strict';
import { ARSENAL_STAGE, ARSENAL_ART, arsenalItems, arsenalFromSearch } from '../docs/games/js/pondwars-arsenal.mjs';
import { newGame, weaponDef, WEAPONS, selectableWeapon, fire } from '../docs/games/js/pondwars-beta-engine.mjs';
import { snapshot, restoreInto, applyInput, cleanInput, act, NetMatch, PROTOCOL } from '../docs/games/js/pondwars-beta-net.mjs';

test('seven genuinely new IDs plus gold art alias, with no duplicate golden weapon or Land Mine',()=>{
 assert.equal(Object.keys(ARSENAL_ART).length,8);assert.equal(ARSENAL_ART.gold.art,'golden_foot_v2');assert.ok(!ARSENAL_ART.mine);
 const items=arsenalItems(WEAPONS,true);assert.equal(items.length,21);assert.equal(new Set(items.map(w=>w.id)).size,21);
 assert.equal(arsenalItems(WEAPONS).length,14);assert.equal(arsenalFromSearch('?arsenal=exp-v1'),'exp-v1');assert.equal(arsenalFromSearch('?arsenal=all'),null);
});
test('unimplemented IDs cannot select or fire through direct, UI-equivalent or replay actions',()=>{
 for(const arsenal of [null,'exp-v1']){
  const g=newGame({arsenal});
  const future=Object.keys(ARSENAL_ART).filter(id=>id!=='gold' && !(ARSENAL_STAGE==='B' && ['bell_bomb','frog_mine'].includes(id)));
  for(const id of [...future,'toe','shard','constructor']){
   assert.equal(selectableWeapon(g,id),false);assert.equal(act(g,{t:'weapon',w:id}),false);
   g.weapon=id;const before=JSON.stringify(g.ammo);assert.equal(fire(g,0,.5),false);assert.equal(JSON.stringify(g.ammo),before);
  }
 }
});
test('QA config is per match, plain snapshots do not gain fields or change legacy balance',()=>{
 const base=newGame(),qa=newGame({arsenal:'exp-v1'});
 assert.ok(!Object.hasOwn(base,'arsenal'));assert.equal(qa.arsenalStage,ARSENAL_STAGE);
 assert.equal(weaponDef(base,'gold').damage,68);assert.equal(weaponDef(base,'toe').damage,36);assert.equal(weaponDef(base,'mine').damage,50);
 assert.equal(weaponDef(base,'bell_bomb'),undefined);
 assert.equal(weaponDef(qa,'gold').damage,ARSENAL_STAGE==='A'?68:58);
});
test('same seed and unchanged input replay match between QA and baseline; ammunition stays team-local',()=>{
 const a=newGame({seed:17}),b=newGame({seed:17,arsenal:'exp-v1'});
 for(let i=0;i<320;i++){const input=cleanInput({m:0,a:i===0?[{t:'weapon',w:'grenade'},{t:'fire',a:-.8,p:.5}]:[]});applyInput(a,input);applyInput(b,input);}
 const x=snapshot(a),y=snapshot(b);delete y.arsenal;delete y.arsenalStage;for(const ammo of y.ammo){delete ammo.bell_bomb;delete ammo.frog_mine;}assert.deepEqual(x,y);
 b.ammo[0].cluster--;assert.notEqual(b.ammo[0].cluster,b.ammo[1].cluster);
});
test('restore preserves matching QA configuration and refuses silent loadout/stage substitution',()=>{
 const g=newGame({arsenal:'exp-v1'}),snap=snapshot(g);restoreInto(g,snap);assert.deepEqual(snapshot(g),snap);
 assert.throws(()=>restoreInto(newGame(),snap),/arsenal snapshot/);
 assert.throws(()=>restoreInto(g,{...snap,arsenalStage:'different'}),/arsenal snapshot/);
});
test('QA hello/join negotiate build stage and reject an incompatible arsenal before replay',()=>{
 const sent=[],host=new NetMatch({send:m=>sent.push(m)},{host:true});let problem='';host.onproblem=m=>problem=m;
 host.receive({type:'join',protocol:PROTOCOL,arsenalStage:'different'});host.begin({seed:1,arsenal:'exp-v1'});assert.match(problem,/builds differ/);assert.equal(host.g,null);
 host.receive({type:'join',protocol:PROTOCOL,arsenalStage:ARSENAL_STAGE});host.begin({seed:1,arsenal:'exp-v1'});assert.equal(host.g.arsenal,'exp-v1');
 const guest=new NetMatch({send(){}},{host:false});guest.receive(sent.at(-1));assert.deepEqual(snapshot(guest.g),snapshot(host.g));
});
