import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,stepShot,STEP,G,W,H} from '../docs/games/js/pondwars-beta-engine.mjs';
test('a fast fused grenade cannot pass through a one-pixel wall',()=>{
 const g=newGame();g.mask.fill(0);for(let y=0;y<H;y++)g.mask[y*W+505]=1;
 const s={type:'grenade',x:500,y:200,vx:1000,vy:0,t:0,owner:99,ownerClear:true};
 stepShot(g,s);assert.ok(s.x<505);assert.ok(s.vx<0,'reflect away from wall');
});
test('a grenade in open air follows the same gravity as a bazooka without wind',()=>{
 const g=newGame();g.mask.fill(0);g.wind=0;
 const a={type:'grenade',x:500,y:200,vx:150,vy:-100,t:0,owner:99,ownerClear:true};
 const b={...a,type:'rocket'};stepShot(g,a,g.mask,[]);stepShot(g,b,g.mask,[]);
 assert.ok(Math.abs(a.x-b.x)<1e-9);assert.ok(Math.abs(a.y-b.y)<1e-9);assert.equal(a.vy,-100+G*STEP);
});
