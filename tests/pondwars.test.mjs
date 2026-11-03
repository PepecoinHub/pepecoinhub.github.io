import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, explode, backflip, MAPS, STEP, canMove, H, projectileOrigin, retreatDirection } from '../docs/games/js/pondwars-engine.mjs';
import { newGame, startTurn, step, fire, walk, hop, cpuPlan, me, solid, makeTerrain, aliveOf, W, WATER } from '../docs/games/js/pondwars-engine.mjs';

test('the island is the same for the same seed, and different for another', () => {
  const a = makeTerrain(5), b = makeTerrain(5), c = makeTerrain(6);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});
function flatGame(distance=60){
  const g=newGame({seed:3,perTeam:2,cpu:[false,false]});g.mask.fill(0);
  for(let y=450;y<H;y++)g.mask.fill(1,y*W,(y+1)*W);
  g.frogs.forEach((f,i)=>Object.assign(f,{x:i===0?200:i===1?200+distance:900+(i-2)*100,y:449,ground:true,face:1}));
  startTurn(g);return g;
}
test('all impact weapons hit nearby enemies immediately, without a global immunity window',()=>{
  for(const type of ['revolver','bow','rocket'])for(const distance of [40,60,100,200]){
    const g=flatGame(distance);g.weapon=type;assert.equal(fire(g,0,1),true);
    for(let i=0;i<90;i++)step(g);
    assert.ok(g.frogs[1].hp<100,type+' must hit at '+distance);
  }
});
test('projectile and aim start at hand height and do not immediately collide with the shooter',()=>{
  const g=flatGame(200),f=me(g),origin=projectileOrigin(f,0);
  assert.equal(origin.y,f.y-32);assert.equal(origin.x,f.x+18);
  g.weapon='revolver';fire(g,0,1);for(let i=0;i<30;i++)step(g);
  assert.equal(f.hp,100);assert.equal(g.frogs[1].hp,75);
});
test('a falling frog slides down a side wall and eventually lands instead of locking the turn',()=>{
  const g=flatGame(200),f=me(g);Object.assign(f,{x:300,y:280,ground:false,vx:120,vy:40,fallFrom:280});
  for(let y=100;y<450;y++)for(let x=302;x<330;x++)g.mask[y*W+x]=1;
  for(let i=0;i<360;i++)step(g);
  assert.ok(f.ground||!f.alive);assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.y));
});
test('CPU finishes the revolver second shot with the locked weapon and can choose a close range bat',()=>{
  const g=flatGame(50);g.pistolShots=1;g.weapon='revolver';assert.equal(cpuPlan(g).weapon,'revolver');
  const h=flatGame(40);for(const type of ['gold','cluster','dynamite'])h.ammo[0][type]=0;
  const p=cpuPlan(h);assert.ok(['bat','revolver','bow','rocket','grenade'].includes(p.weapon));
  assert.ok(Number.isFinite(p.angle)&&Number.isFinite(p.power));
});
test('CPU retreat chooses an escape away from a placed charge on safe ground',()=>{
  const g=flatGame(200),f=me(g);g.shots.push({type:'dynamite',x:f.x+20,y:f.y});
  assert.equal(retreatDirection(g),-1);
});
test('all maps spawn safe spaced frogs and enforce their capacity',()=>{
  for(const map of Object.keys(MAPS))for(let seed=0;seed<25;seed++){
    const g=newGame({map,seed,perTeam:4});
    assert.equal(g.frogs.length,MAPS[map].max*2);
    for(const f of g.frogs){assert.ok(f.y<WATER);assert.ok(solid(g.mask,f.x,f.y+1));}
    for(let i=0;i<g.frogs.length;i++)for(let j=i+1;j<g.frogs.length;j++)assert.ok(Math.abs(g.frogs[i].x-g.frogs[j].x)>=58);
    if(map==='twin')for(let y=0;y<WATER;y++)assert.equal(g.mask[y*W+600],0);
  }
});
test('walking budget is finite and shots give exactly three seconds of retreat',()=>{
  const g=newGame({seed:3});startTurn(g);const f=me(g);
  g.movement=0;assert.equal(walk(g,1),false);assert.equal(hop(g),false);
  g.weapon='bat';fire(g,0,1);assert.equal(g.retreat,3);assert.ok(canMove(g));
  for(let i=0;i<181;i++)step(g);
  assert.equal(g.retreat,0);assert.equal(canMove(g),false);assert.equal(fire(g,0,1),false);
});
test('dynamite waits five seconds, mines arm and persist between turns',()=>{
  const g=newGame({seed:3});startTurn(g);g.weapon='dynamite';fire(g,0,1);
  assert.equal(g.ammo[0].dynamite,1);
  for(let i=0;i<240;i++)step(g);
  assert.ok(g.shots.some(s=>s.type==='dynamite'));
  for(let i=0;i<100;i++)step(g);
  assert.ok(!g.shots.length);
  const m=newGame({seed:3});startTurn(m);m.weapon='mine';fire(m,0,1);
  assert.equal(m.ammo[0].mine,2);assert.equal(m.mines.length,1);
  step(m);assert.equal(m.mines.length,1,'unarmed mine does not immediately explode');
  for(const f of m.frogs)if(Math.abs(f.x-m.mines[0].x)<70)f.x-=120;
  for(let i=0;i<240;i++)step(m);
  assert.equal(m.turn,1);assert.equal(m.mines.length,1,'mine persists into the next turn');
  const charge=m.mines[0],target=m.frogs[1];target.x=charge.x;target.y=charge.y;target.ground=true;
  step(m);step(m);assert.equal(m.mines.length,0,'proximity triggers an armed mine');
});
test('both teams receive their own mine and dynamite stock',()=>{
  const g=newGame({seed:3,cpu:[false,false]});
  assert.equal(g.ammo[0].mine,3);assert.equal(g.ammo[1].mine,3);
  assert.equal(g.ammo[0].dynamite,2);assert.equal(g.ammo[1].dynamite,2);
  g.turn=1;startTurn(g);g.weapon='mine';assert.equal(fire(g,0,1),true);
  assert.equal(g.ammo[1].mine,2);assert.equal(g.ammo[0].mine,3);
});
test('quick second jump becomes a higher backwards flip, once per jump',()=>{
  const g=newGame({seed:3});startTurn(g);const f=me(g);f.face=1;
  assert.equal(backflip(g),false);
  assert.ok(hop(g));const firstVy=f.vy;
  for(let i=0;i<6;i++)step(g);
  assert.ok(backflip(g));assert.ok(f.vx<0);assert.ok(f.vy<firstVy);assert.equal(f.flipT,0);
  assert.equal(backflip(g),false);assert.equal(hop(g),false);
});
test('a late second jump cannot become a midair boost',()=>{
  const g=newGame({seed:3});startTurn(g);hop(g);
  for(let i=0;i<22;i++)step(g);
  assert.equal(backflip(g),false);
  g.phase='fire';assert.equal(backflip(g),false);
});

test('all seven weapons resolve, cluster weapons spawn fragments and ammo is spent once',()=>{
  for(const weapon of ['rocket','bat','grenade','cluster','revolver','bow','gold']){
    const g=newGame({seed:3});startTurn(g);g.weapon=weapon;
    assert.ok(fire(g,-Math.PI/3,.35));
    if(['cluster','gold'].includes(weapon))assert.equal(g.ammo[0][weapon],WEAPONS[weapon].ammo-1);
    let fragments=false;
    for(let i=0;i<1200&&g.phase!=='aim'&&g.phase!=='over';i++){
      step(g);if(g.shots.some(s=>['toe','shard'].includes(s.type)))fragments=true;
    }
    assert.notEqual(g.phase,'fire',weapon+' must resolve');
    if(['cluster','gold'].includes(weapon))assert.ok(fragments,weapon+' fragments');
  }
});
test('revolver grants exactly two separately aimed shots and cannot switch weapons between them',()=>{
  const g=newGame({seed:3});startTurn(g);g.weapon='revolver';
  assert.ok(fire(g,-Math.PI/2,1));
  for(let i=0;i<1200&&g.phase==='fire';i++)step(g);
  assert.equal(g.phase,'aim');assert.equal(g.pistolShots,1);
  g.weapon='gold';assert.equal(fire(g,-1,1),false);
  g.weapon='revolver';assert.ok(fire(g,-Math.PI/2,1));
  for(let i=0;i<1200&&g.turn===0;i++)step(g);
  assert.equal(g.turn,1);
});
test('bat hits nearby enemies in front, not behind; depleted gold cannot fire',()=>{
  const g=newGame({seed:3});startTurn(g);const f=me(g),enemy=g.frogs.find(t=>t.team!==f.team);
  enemy.x=f.x+30;enemy.y=f.y;g.weapon='bat';fire(g,0,1);
  assert.equal(enemy.hp,68);assert.ok(enemy.vx>300&&enemy.vy<0);
  g.phase='aim';g.weapon='gold';g.ammo[0].gold=0;assert.equal(fire(g,0,1),false);
});
test('direct arrow and bullet hits damage the frog hitbox even outside the small crater',()=>{
  for(const type of ['bow','revolver']){
    const g=newGame({seed:3});startTurn(g);const target=g.frogs[1];
    explode(g,target.x+8,target.y-20,type);
    assert.equal(target.hp,100-WEAPONS[type].damage);
  }
});
test('projectiles can hit the head of the taller Pepe sprite',()=>{
  const g=newGame({seed:3});startTurn(g);const target=g.frogs[1];
  explode(g,target.x+8,target.y-50,'revolver');assert.equal(target.hp,75);
});
test('frogs start standing on ground, above the water, apart', () => {
  for (let seed = 1; seed < 30; seed++) {
    const g = newGame({ seed });
    for (const f of g.frogs) { assert.ok(solid(g.mask, f.x, f.y + 1) && !solid(g.mask, f.x, f.y), 'on ground'); assert.ok(f.y < WATER); }
  }
});
test('walking and hopping move the frog; a grenade blows a hole', () => {
  const g = newGame({ seed: 3 }); startTurn(g);
  const f = me(g), x = f.x;
  for (let i = 0; i < 20; i++) walk(g, 1);
  assert.notEqual(f.x, x);
  for (let i = 0; i < 120; i++) step(g);
  assert.ok(hop(g)); for (let i = 0; i < 200; i++) step(g);
  const before = g.mask.reduce((s, v) => s + v, 0);
  assert.ok(fire(g, -Math.PI / 2, .1));
  for (let i = 0; i < 600 && g.phase !== 'aim'; i++) step(g);
  assert.ok(g.mask.reduce((s, v) => s + v, 0) < before, 'the ground has a hole');
});
test('CPU against CPU always finishes with a winner', () => {
  for (const seed of [1, 2, 7]) {
    const g = newGame({ seed, perTeam: 2, cpu: [true, true], level: 2 }); startTurn(g);
    let turns = 0;
    for (let i = 0; i < 60 * 60 * 40 && g.winner === null; i++) {
      if (g.phase === 'aim' && g.timer < 29.5) { const p = cpuPlan(g); g.weapon = p.weapon; fire(g, p.angle, p.power, p.tx); turns++; }
      step(g);
    }
    assert.notEqual(g.winner, null, 'seed ' + seed + ' after ' + turns + ' turns');
    assert.ok(turns < 80);
  }
});
