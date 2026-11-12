import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,startTurn,fire,step,stepShot,explode,WEAPONS,W,H,STEP} from '../docs/games/js/pondwars-beta-engine.mjs';
import {applyInput,KEY,snapshot,restoreInto,stateHash,NetMatch} from '../docs/games/js/pondwars-beta-net.mjs';
import {clipFrame,validateClip,MAP_DECORATIONS} from '../docs/games/js/pondwars-weapon-art.mjs';
import {PointerHolds} from '../docs/games/js/pondwars-pointer-holds.mjs';
function fixture(){const g=newGame({seed:123,packs:'all',perTeam:2,cpu:[false,false]});g.mask.fill(0);for(let y=450;y<H;y++)g.mask.fill(1,y*W,(y+1)*W);g.frogs.forEach((f,i)=>Object.assign(f,{x:200+i*200,y:449,vx:0,vy:0,alive:true,hp:100,ground:true}));startTurn(g);return g;}
test('Mega direct damage bound is 118, classic remains 248; no hidden fragments',()=>{
  for(const [parent,child,expected] of [['goldv2','megatoe',118],['gold','toe',248]]){
    const g=fixture(),f=g.frogs[1];f.hp=1000;
    explode(g,f.x,f.y-11,parent);for(let i=0;i<5;i++)explode(g,f.x,f.y-11,child);
    assert.equal(1000-f.hp,expected);assert.equal(g.events.filter(e=>e.type==='boom').length,6);
  }
});
test('Mega blast has larger crater and horizontal shove; classic gold unchanged',()=>{
  const g=fixture(),f=g.frogs[1];explode(g,f.x-20,f.y-11,'goldv2');
  const legacy=fixture(),old=legacy.frogs[1];explode(legacy,old.x-20,old.y-11,'gold');
  assert.ok(f.vx>old.vx*2);assert.ok(g.mask.reduce((a,v)=>a+v,0)<legacy.mask.reduce((a,v)=>a+v,0));
});
test('Mega starts a KO chain outside its own blast reach; each KO happens once',()=>{
  const g=fixture();g.frogs.forEach((f,i)=>{f.x=[200,610,670,1000][i];f.hp=i===1||i===2?1:100;});
  explode(g,500,438,'goldv2');assert.equal(g.frogs[1].hp,0);assert.equal(g.frogs[2].hp,1,'secondary target is outside Mega blast');
  let ko=0,frogBlasts=0;g.events=[];
  for(let i=0;i<600&&g.winner===null;i++){step(g);ko+=g.events.filter(e=>e.type==='ko').length;frogBlasts+=g.events.filter(e=>e.type==='boom'&&e.weapon==='frog').length;g.events=[];}
  assert.equal(g.frogs[2].hp,0,'secondary KO came from the frog blast');assert.equal(ko,2);assert.equal(frogBlasts,2);assert.equal(g.shots.length,0);
});
test('Silver Donkey damage is at most 78 per blast; a distant roof shields but thin roofs do not block radial damage',()=>{
  const g=fixture(),f=g.frogs[1];f.hp=1000;explode(g,f.x,f.y-11,'donkey');assert.equal(1000-f.hp,78);
  for(const [roof,damaged] of [[410,true],[260,false]]){
    const q=fixture(),target=q.frogs[1];for(let y=roof;y<roof+10;y++)for(let x=target.x-80;x<target.x+80;x++)q.mask[y*W+x]=1;
    q.weapon='donkey';fire(q,0,1,target.x,target.y);const s=q.shots[0];let result='';for(let i=0;i<400&&!result;i++)result=stepShot(q,s);
    assert.equal(result,'boom');assert.ok(Math.abs(s.y-roof)<2);explode(q,s.x,s.y,'donkey');assert.equal(target.hp<100,damaged);
  }
});
test('Doge clock freeze is bounded by lifetime; restore mid-flight is deterministic',()=>{
  const g=fixture();g.mask.fill(0);g.weapon='doge';fire(g,-.2,1);Object.assign(g.shots[0],{x:600,y:140,vx:0,vy:0,heading:0,pitch:0});
  for(let i=0;i<100;i++)applyInput(g,{m:KEY.L,a:[]});
  assert.equal(g.phase,'guide');const timer=g.timer,snap=snapshot(g),copy=fixture();restoreInto(copy,snap);assert.equal(stateHash(copy),stateHash(g));
  let ticks=100;while(g.phase==='guide'&&ticks<280){applyInput(g,{m:KEY.L,a:[]});applyInput(copy,{m:KEY.L,a:[]});ticks++;assert.equal(g.timer,timer);}
  assert.ok(ticks<=271);assert.equal(g.shots.length,0);assert.equal(stateHash(copy),stateHash(g));assert.equal(g.ammo[0].doge,0);
});
test('PEP rain remains six drops of eight; unsupported pack cannot spend ammo',()=>{
  const g=fixture();g.weapon='rain';fire(g,0,1,600,300);assert.equal(g.shots.length,6);assert.equal(WEAPONS.pep.damage,8);
  const plain=newGame();startTurn(plain);plain.weapon='goldv2';assert.equal(fire(plain,0,1),false);
});
test('pointer ownership keeps second finger held; cancel/reset clears all',()=>{
  const h=new PointerHolds();h.press('r',11);h.press('r',12);h.press('u',13);h.release('r',11);assert.equal(h.active('r'),true);h.release('r',12);assert.equal(h.active('r'),false);assert.equal(h.active('u'),true);h.clear();assert.equal(h.active('u'),false);
});
test('PNG clips have separate render geometry, no HUD frame reuse, time based reduced-motion selection',()=>{
  const c={src:'art/flight.png',frame:[96,80],columns:4,frames:8,fps:10,anchor:[48,40],size:[58,48],loop:true};
  assert.ok(validateClip(c));assert.equal(clipFrame(c,.7).n,7);assert.equal(clipFrame(c,.8).n,0);assert.equal(clipFrame(c,.7,true).n,0);assert.equal(clipFrame(c,.7).x,-29);
  assert.equal(validateClip({...c,src:'hud_64/doge.png'}),false);assert.equal(validateClip({...c,src:'flight.svg'}),false);assert.equal(validateClip({...c,fps:Infinity}),false);
  assert.deepEqual(Object.keys(MAP_DECORATIONS),['moon','doom','farm','quarry','tower']);
});
test('playtest rejects older arsenal peers and snapshots but ordinary protocol stays compatible',()=>{
 const host=new NetMatch({send(){},onmessage:null},{host:true});let error='';host.onproblem=s=>error=s;host.receive({type:'join',protocol:1});host.begin({seed:1,map:'island',perTeam:2,packs:{simple:true}});assert.match(error,/builds differ/);
 const g=fixture(),s=snapshot(g);delete s.arsenalBuild;assert.throws(()=>restoreInto(g,s),/build differs/);
 const plain=newGame();startTurn(plain);assert.doesNotThrow(()=>restoreInto(plain,snapshot(plain)));
});
