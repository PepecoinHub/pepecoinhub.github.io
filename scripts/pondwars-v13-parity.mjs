// Compare serialized gameplay to #283; events/dirty are existing non-serialized locals.
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as current from '../docs/games/js/pondwars-beta-engine.mjs';
import {stateHash} from '../docs/games/js/pondwars-beta-net.mjs';
const ref='8cf0004ff50ba96dddc4f84e39398b0131d1b21d',dir=mkdtempSync(join(tmpdir(),'frog-v13-parity-'));
try{
 for(const name of ['pondwars-beta-engine.mjs','pondwars-arsenal.mjs','pondwars-maps.mjs'])writeFileSync(join(dir,name),execFileSync('git',['show',ref+':docs/games/js/'+name]));
 const before=await import(pathToFileURL(join(dir,'pondwars-beta-engine.mjs')));let cases=0;
 for(const map of Object.keys(current.MAPS))for(const seed of [1,123])for(const side of [0,1])for(const weapon of ['ban','doge','donkey','moon','rain']){
  const games=[before,current].map(E=>{const g=E.newGame({map,seed,packs:'all',perTeam:Math.min(3,E.MAPS[map].max),cpu:[false,false]});g.turn=side;E.startTurn(g);g.weapon=weapon;return g;});
  const f=current.me(games[1]),target=games[1].frogs.find(x=>x.team!==side),dir=Math.sign(target.x-f.x)||1,angle=dir>0?-.6:-Math.PI+.6;
  for(let i=0;i<2;i++){const E=[before,current][i];assert.ok(E.fire(games[i],angle,.6,target.x,target.y));}
  assert.equal(stateHash(games[0]),stateHash(games[1]),map+'/'+weapon+'/fire');
  for(let t=0;t<900;t++){
   for(let i=0;i<2;i++){games[i].ctl={x:side?-1:1,y:0};[before,current][i].step(games[i]);games[i].events=[];games[i].dirty=[];}
   if(games[0].turn!==side||games[0].winner!==null)break;
  }
  assert.equal(stateHash(games[0]),stateHash(games[1]),map+'/'+weapon+'/resolved');cases++;
 }
 // Direct near/boundary/whiff cases including friendly targets and both directions.
 let meleeCases=0;
 for(const dir of [-1,1])for(const distance of [0,30,47.99,48,55]){
  const games=[before,current].map(E=>{const g=E.newGame({seed:123,packs:'all',perTeam:2,cpu:[false,false]});E.startTurn(g);g.weapon='ban';const f=E.me(g);g.frogs.filter(x=>x.id!==f.id).forEach((o,i)=>Object.assign(o,{x:f.x+dir*(distance+i*30),y:f.y,hp:100,alive:true}));E.fire(g,dir>0?0:Math.PI,1);return g;});
  assert.equal(stateHash(games[0]),stateHash(games[1]),'melee '+dir+'/'+distance);meleeCases++;
 }
 console.log(JSON.stringify({reference:ref,mapWeaponCases:cases,meleeCases,identicalSerializedGameplay:true}));
}finally{rmSync(dir,{recursive:true,force:true});}
