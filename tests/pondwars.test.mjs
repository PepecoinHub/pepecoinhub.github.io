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

// ---------- physics and movement (rope, jetpack, teleport, drill, slopes, slide, wind) ----------
import { normalAt, ROPE_MAX, JET_FUEL, stepShot, carve } from '../docs/games/js/pondwars-engine.mjs';
function slopeGame(){   // ground rising to the right: y = 450 - (x-300)/2 for x > 300
  const g=newGame({seed:3,perTeam:2,cpu:[false,false]});g.mask.fill(0);
  for(let x=0;x<W;x++){const top=x<300?450:Math.max(250,450-Math.round((x-300)/2));for(let y=top;y<H;y++)g.mask[y*W+x]=1;}
  g.frogs.forEach((f,i)=>Object.assign(f,{x:i===0?200:900+i*40,y:449,ground:true,face:1}));
  g.frogs.forEach(f=>{if(f.x>300){let y=0;while(!solid(g.mask,f.x,y+1))y++;f.y=y;}});
  startTurn(g);return g;
}
test('walking climbs a 1:2 slope up and comes back down it without falling',()=>{
  const g=slopeGame(),f=me(g);
  for(let i=0;i<150;i++)walk(g,1);
  assert.ok(f.x>330,'walked up the slope, x='+f.x);assert.ok(f.ground,'still on the ground going up');
  for(let i=0;i<60;i++)walk(g,-1);
  assert.ok(f.ground,'still on the ground going down');
});
test('the surface normal points out of the ground (up on flat ground, up-left on a rising slope)',()=>{
  const g=slopeGame();
  const flat=normalAt(g.mask,100,450),slope=normalAt(g.mask,500,350);
  assert.ok(flat.y<-.95,'flat '+JSON.stringify(flat));
  assert.ok(slope.y<-.6&&slope.x<-.2,'slope '+JSON.stringify(slope));
});
test('a grenade dropped on a slope bounces downhill (to the left)',()=>{
  const g=slopeGame(),s={type:'grenade',x:500,y:300,vx:0,vy:200,t:0,owner:99,ownerClear:true};
  let minX=500;for(let i=0;i<120;i++){stepShot(g,s);minX=Math.min(minX,s.x);}
  assert.ok(minX<490,'rolled/bounced downhill, x='+minX);
});
test('the wind drifts between turns instead of jumping, and pushes rockets harder than before',()=>{
  const g=flatGame(300);let prev=g.wind,maxJump=0;
  for(let i=0;i<30;i++){g.turn++;startTurn(g);maxJump=Math.max(maxJump,Math.abs(g.wind-prev));prev=g.wind;assert.ok(Math.abs(g.wind)<=1);}
  assert.ok(maxJump<=.41,'wind jump '+maxJump);
  const a=flatGame(300);a.wind=1;a.weapon='rocket';fire(a,-Math.PI/2,.6);
  const b=flatGame(300);b.wind=0;b.weapon='rocket';fire(b,-Math.PI/2,.6);
  for(let i=0;i<40;i++){stepShot(a,a.shots[0]);stepShot(b,b.shots[0]);}
  assert.ok(a.shots[0].x-b.shots[0].x>20,'wind moved the rocket');
});
test('the rope grabs the ceiling, holds the frog at its length, and lets it swing with left/right',()=>{
  const g=flatGame(400),f=me(g);
  for(let y=200;y<215;y++)g.mask.fill(1,y*W+100,y*W+400);   // a ledge above
  g.weapon='rope';assert.equal(fire(g,-Math.PI/2,1),true);
  assert.ok(f.rope,'attached');assert.equal(g.phase,'aim','the rope does not end the turn');assert.equal(g.ammo[g.team].rope,4);
  for(let i=0;i<60;i++)step(g);
  const d=Math.hypot(f.x-f.rope.x,f.y-30-f.rope.y);assert.ok(d<=f.rope.len+1,'within rope length');
  const x0=f.x;g.ctl={x:1,y:-1};for(let i=0;i<90;i++)step(g);
  assert.ok(f.rope&&f.x>x0+5,'swung right: '+x0+' -> '+f.x);
  g.weapon='rope';fire(g,0,1);assert.equal(f.rope,null,'second use lets go');
});
test('the rope misses empty sky without using ammo',()=>{
  const g=flatGame(400);g.weapon='rope';assert.equal(fire(g,-Math.PI/2,1),false);assert.equal(g.ammo[g.team].rope,5);
});
test('the jetpack lifts the frog while fuel lasts, then it falls back',()=>{
  const g=flatGame(400),f=me(g),y0=f.y;g.weapon='jetpack';assert.equal(fire(g,0,1),true);
  g.ctl={x:0,y:-1};for(let i=0;i<60;i++)step(g);
  assert.ok(f.y<y0-40,'flew up: '+f.y);assert.ok(f.jet.fuel<JET_FUEL);
  for(let i=0;i<400;i++)step(g);
  assert.equal(f.jet,null,'fuel ran out');assert.ok(f.ground,'landed');
});
test('teleport moves the frog to a clear spot near the target, never into the ground',()=>{
  const g=flatGame(400),f=me(g);g.weapon='teleport';
  assert.equal(fire(g,0,1,700,470),true,'target inside the ground is moved up to a clear spot');
  assert.ok(Math.abs(f.x-700)<130&&!solid(g.mask,f.x,f.y-20),'clear at '+f.x+','+f.y);
  assert.equal(g.phase,'aim');assert.equal(g.ammo[g.team].teleport,1);
});
test('the drill bores a tunnel into a hill and then explodes',()=>{
  const g=flatGame(600);g.weapon='drill';const f=me(g);
  assert.equal(fire(g,Math.PI/4,.5),true);
  let bored=false;for(let i=0;i<300&&g.shots.length;i++){step(g);if(g.shots[0]?.bore>0)bored=true;}
  assert.ok(bored,'started boring');assert.equal(g.shots.length,0,'went off');
  assert.ok(!solid(g.mask,f.x+60,470)||!solid(g.mask,f.x+80,490)||!solid(g.mask,f.x+100,500),'a tunnel was carved');
});
test('a frog knocked sideways slides along the ground and stops',()=>{
  const g=flatGame(400),t=g.frogs[1];t.vx=400;t.ground=true;const x0=t.x;
  for(let i=0;i<120;i++)step(g);
  assert.ok(t.x>x0+5,'slid '+(t.x-x0));assert.equal(t.vx,0);assert.ok(t.ground);
});
test('a frog flying very fast is slowed to the speed cap',()=>{
  const g=flatGame(400),t=g.frogs[1];t.vx=3000;t.vy=-3000;t.ground=false;step(g);
  assert.ok(Math.hypot(t.vx,t.vy)<=701);
});
test('teleport puts the frog on the ground (no fall), never above the water',()=>{
  const g=flatGame(400),f=me(g);g.weapon='teleport';
  assert.equal(fire(g,0,1,600,200),true);assert.equal(f.y,449);assert.ok(f.ground);
  for(let i=0;i<60;i++)step(g);assert.equal(f.hp,100,'no fall damage');
});
