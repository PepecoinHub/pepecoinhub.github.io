import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS,newGame,startTurn,fire,step,stepShot,makeProjectile,explode,weaponDef,cpuPlan,W,H,WATER,STEP } from '../docs/games/js/pondwars-beta-engine.mjs';
import { applyInput,cleanInput,snapshot,restoreInto,stateHash,act } from '../docs/games/js/pondwars-beta-net.mjs';
function flat(arsenal='exp-v1'){
 const g=newGame({seed:11,perTeam:2,cpu:[false,false],arsenal});g.mask.fill(0);g.mask.fill(1,450*W);
 g.frogs.forEach((f,i)=>Object.assign(f,{x:200+i*200,y:449,vx:0,vy:0,ground:true,face:1}));startTurn(g);g.events=[];return g;
}
const trap=(g,x=300)=>{const m={type:'frog_mine',x,y:447,vx:0,vy:0,t:0,owner:0,team:0,phase:'arming'};g.mines.push(m);return m;};
test('per-match gold/toe/Bell/Mine definitions never mutate baseline or leak new weapons into ordinary play',()=>{
 const a=flat(),b=flat(null);
 assert.deepEqual([weaponDef(a,'gold').damage,weaponDef(a,'gold').radius,weaponDef(a,'toe').damage,weaponDef(a,'toe').radius],[58,66,12,16]);
 assert.deepEqual([WEAPONS.gold.damage,WEAPONS.gold.radius,WEAPONS.toe.damage,WEAPONS.toe.radius],[68,58,36,34]);
 for(const id of ['bell_bomb','frog_mine']){assert.equal(act(b,{t:'weapon',w:id}),false);b.weapon=id;assert.equal(fire(b,0,.5),false);assert.equal(weaponDef(b,id),undefined);}
 assert.equal(weaponDef(a,'mine').damage,50);assert.equal(a.ammo[0].mine,3);assert.equal(a.ammo[0].frog_mine,2);
});
test('Mega Golden Foot remains a throw with one use, 3s fuse and exactly five toes',()=>{
 const g=flat();g.weapon='gold';assert.equal(fire(g,-.8,.6),true);assert.equal(g.shots.length,1);assert.equal(g.ammo[0].gold,0);
 assert.equal(g.shots[0].type,'gold');assert.equal(weaponDef(g,'gold').fuse,3);g.shots[0].t=3-STEP;step(g);
 assert.equal(g.shots.filter(s=>s.type==='toe').length,5);assert.equal(g.shots.filter(s=>s.type==='gold').length,0);
 g.phase='aim';assert.equal(fire(g,-.8,.6),false);
});
test('uncapped same-position direct gold+five toes sum is 118 HP, versus legacy theoretical 248',()=>{
 const g=flat(),f=g.frogs[0];f.hp=1000;explode(g,f.x,f.y-11,'gold');for(let i=0;i<5;i++)explode(g,f.x,f.y-11,'toe');
 assert.equal(1000-f.hp,118);assert.equal(WEAPONS.gold.damage+5*WEAPONS.toe.damage,248);
});
test('gold knockback multiplier is isolated to its parent; legacy blast and toe impulse remain unchanged',()=>{
 const a=flat(),b=flat(null);explode(a,200,438,'gold');explode(b,200,438,'gold');
 assert.ok(Math.abs(a.frogs[0].vx/b.frogs[0].vx-1.2)<1e-9);assert.ok(Math.abs(a.frogs[0].vy/b.frogs[0].vy-1.2)<1e-9);
 assert.equal(weaponDef(a,'toe').knockback,undefined);assert.equal(weaponDef(a,'grenade').knockback,undefined);
});
test('Bell uses real fused sweep: thin walls bounce, frog skin does not detonate, fuse and wind behavior match grenade',()=>{
 const g=flat();g.mask.fill(0);for(let y=0;y<H;y++)g.mask[y*W+505]=1;
 const s={type:'bell_bomb',x:500,y:200,vx:1000,vy:0,t:0,owner:0,ownerClear:true};g.shots=[s];assert.equal(stepShot(g,s),'');assert.ok(s.x<505&&s.vx<0);assert.equal(g.events.filter(e=>e.type==='bounce').length,1);
 g.mask.fill(0);const a={type:'bell_bomb',x:500,y:200,vx:150,vy:-100,t:0,owner:0,ownerClear:true},b={...a,type:'grenade'};g.wind=1;
 g.frogs[1].x=503;g.frogs[1].y=240;assert.equal(stepShot(g,a),'');stepShot(g,b);assert.equal(a.x,b.x);assert.equal(a.y,b.y);
 a.t=3-STEP;assert.equal(stepShot(g,a),'boom');
});
test('bounce notifications are throttled, and planner samples do not emit live FX or sounds',()=>{
 const g=flat(),s={type:'bell_bomb',x:500,y:449,vx:0,vy:20,t:0,owner:99,ownerClear:true};g.shots=[s];
 for(let i=0;i<60;i++)stepShot(g,s);assert.ok(g.events.filter(e=>e.type==='bounce').length<=9);
 g.shots=[];g.events=[];const plan=cpuPlan(g,{weapon:'bell_bomb'});assert.equal(plan.weapon,'bell_bomb');assert.deepEqual(g.events,[]);
});
test('Bell spends two team-local uses, resolves once without fragments and hands over the turn',()=>{
 const g=flat();g.weapon='bell_bomb';assert.equal(fire(g,-.8,.5),true);assert.equal(g.ammo[0].bell_bomb,1);assert.equal(g.ammo[1].bell_bomb,2);
 let boom=0;for(let i=0;i<900&&g.turn===0;i++){step(g);boom+=g.events.filter(e=>e.type==='boom'&&e.weapon==='bell_bomb').length;g.events=[];}
 assert.equal(boom,1);assert.equal(g.turn,1);assert.ok(!g.shots.some(s=>s.type==='shard'||s.type==='toe'));
 g.team=0;g.current=0;g.phase='aim';g.weapon='bell_bomb';assert.equal(fire(g,-.8,.5),true);g.phase='aim';assert.equal(fire(g,-.8,.5),false);
});
test('Frog Mine arms for 1s, ignores friends/dead enemies, triggers once on living enemy within 48px',()=>{
 const g=flat(),m=trap(g);g.frogs[2].x=315;g.frogs[1].x=335;g.frogs[1].alive=false;
 for(let i=0;i<65;i++)step(g);assert.equal(m.phase,'armed');assert.ok(g.mines.includes(m));
 g.frogs[1].alive=true;g.frogs[1].hp=100;step(g);assert.equal(m.phase,'jump');assert.equal(m.jumpTicks,0);
 for(let i=0;i<22&&g.mines.includes(m);i++)step(g);assert.ok(!g.mines.includes(m));assert.equal(g.events.filter(e=>e.type==='mine_jump').length,1);
 assert.ok(g.frogs[2].hp<100,'friendly fire on explosion');
});
test('jump detonates by 0.35s even if target leaves; a one-pixel wall cannot be skipped',()=>{
 for(const wall of [false,true]){
  const g=flat(),m=trap(g);m.t=1;g.frogs[1].x=340;step(g);assert.equal(m.phase,'jump');g.frogs[1].x=1100;
  if(wall)for(let y=0;y<H;y++)g.mask[y*W+310]=1;
  for(let i=0;i<22&&g.mines.includes(m);i++)step(g);
  assert.ok(!g.mines.includes(m));assert.ok(m.jumpTicks<=21);if(wall)assert.ok(m.x<=311);
 }
});
test('mine survives owner KO, splashes in water and chained traps explode once without deleting a far trap',()=>{
 const g=flat(),m=trap(g);g.frogs[0].alive=false;g.frogs[0].hp=0;step(g);assert.ok(g.mines.includes(m));m.y=WATER+1;step(g);assert.ok(!g.mines.includes(m));
 const h=flat();trap(h,300);trap(h,325);const far=trap(h,700);explode(h,300,447,'grenade');assert.deepEqual(h.mines,[far]);assert.equal(h.events.filter(e=>e.weapon==='frog_mine'&&e.type==='boom').length,2);
});
test('active jumping trap delays settlement; snapshots preserve airborne trap state and deterministic replay',()=>{
 const g=flat(),m=trap(g);m.t=1;g.frogs[1].x=340;step(g);g.phase='settle';g.settle=.001;const turn=g.turn;step(g);assert.equal(g.turn,turn);
 const snap=snapshot(g),copy=flat();restoreInto(copy,snap);assert.equal(copy.mines[0].phase,'jump');
 for(let i=0;i<120;i++){applyInput(g,cleanInput(null));applyInput(copy,cleanInput(null));}assert.equal(stateHash(g),stateHash(copy));
 const a=flat(),b=flat();for(let i=0;i<450;i++){const input=cleanInput({a:i===0?[{t:'weapon',w:'gold'},{t:'fire',a:-.7,p:.65}]:[]});applyInput(a,input);applyInput(b,input);}assert.equal(stateHash(a),stateHash(b));
});
test('Frog Mine placement spends its own two uses and leaves the Land Mine stock intact',()=>{
 const g=flat();for(let y=430;y<450;y++)g.mask[y*W+220]=1;g.weapon='frog_mine';assert.equal(fire(g,0,1),true);assert.equal(g.ammo[0].frog_mine,1);assert.equal(g.ammo[0].mine,3);assert.equal(g.mines[0].team,0);assert.ok(g.mines[0].y<430,'trap placed above terrain, not buried');
 g.phase='aim';assert.equal(fire(g,0,1),true);g.phase='aim';assert.equal(fire(g,0,1),false);assert.equal(g.mines.length,2);
});

test('network peers with mismatched QA flags are refused before a mismatched arsenal UI starts',async()=>{
 const {NetMatch,PROTOCOL}=await import('../docs/games/js/pondwars-beta-net.mjs');
 const {ARSENAL_STAGE}=await import('../docs/games/js/pondwars-arsenal.mjs');
 const host=new NetMatch({send(){}},{host:true,arsenal:'exp-v1'});let problem='';host.onproblem=m=>problem=m;
 host.receive({type:'join',protocol:PROTOCOL,arsenalStage:ARSENAL_STAGE,arsenalMode:null});host.begin({seed:1,arsenal:'exp-v1'});assert.equal(host.g,null);assert.match(problem,/same arsenal flag/);
 const guest=new NetMatch({send(){}},{host:false,arsenal:null});guest.onproblem=m=>problem=m;
 guest.receive({type:'hello',protocol:PROTOCOL,arsenalStage:ARSENAL_STAGE,setup:{seed:1,arsenal:'exp-v1'},snap:snapshot(flat())});assert.equal(guest.g,null);assert.match(problem,/same arsenal flag/);
});
