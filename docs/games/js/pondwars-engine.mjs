// POND WARS engine: turn-based frog artillery on a destructible island. No DOM here (tests run it in Node).
// Units are pixels and seconds; the world is W x H; the pond starts at WATER (anything below it drowns).
export const W = 1200, H = 600, WATER = 560, STEP = 1 / 60, G = 520;
export const MAPS={
island:{name:'Pond Island',max:4,recommended:3},
twin:{name:'Split Decision',max:4,recommended:4},
peaks:{name:'Croak Canyon',max:3,recommended:3},
small:{name:'Last Lily',max:2,recommended:2}
};
export const TURN_TIME=30, RETREAT_TIME=3, MOVE_BUDGET=160;
export const canMove=g=>g.phase==='aim'||(g.phase==='fire'&&g.retreat>0);
export const WEAPONS = {
  grenade: { name: 'Frag Grenade', short: 'Grenade', radius: 30, damage: 46, fuse: 3, wind: false, ammo: Infinity, power: 520 },
  rocket: { name: 'Bazooka', short: 'Rocket', radius: 27, damage: 42, wind: true, ammo: Infinity, power: 620 },
  cluster: { name:'Cluster Grenade',short:'Cluster',radius:24,damage:28,fuse:3,ammo:4,power:520,children:5 },
  shard: { name:'Shrapnel',radius:20,damage:22,fuse:1.1,power:300 },
  gold: { name:'Golden Foot',short:'Golden Foot',radius:58,damage:68,fuse:3,ammo:1,power:480,children:5 },
  toe: { name:'Golden Toe',radius:34,damage:36,fuse:1.5,power:300 },
  bat: { name:'Baseball Bat',short:'Bat',radius:0,damage:32,ammo:Infinity,power:1 },
  revolver: { name:'Revolver',short:'Revolver',radius:3,damage:25,ammo:Infinity,power:1200,gravity:0 },
  bow: { name:'Longbow',short:'Bow',radius:2,damage:35,ammo:Infinity,power:850,gravity:.28 },
  mine:{name:'Land Mine',short:'Mine',radius:40,damage:50,ammo:3,power:1},
  dynamite:{name:'Dynamite',short:'Dynamite',radius:48,damage:70,ammo:2,power:1,fuse:5},
  candles: { name: 'Red Candle Drop', short: 'Candles', radius: 21, damage: 26, wind: false, ammo: 1 },
};
const NAMES = [['Hopper', 'Lily', 'Ribbit', 'Pad'], ['Croak', 'Bog', 'Toady', 'Murk']];

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- terrain: 1 = ground ----------
export function makeTerrain(seed, map = 'island') {
  const r = rng(seed), mask = new Uint8Array(W * H), top = new Float32Array(W);
  const waves = Array.from({ length: 4 }, (_, i) => ({ a: (60 - i * 12) * (.6 + r() * .8), f: (i + 1) * (.004 + r() * .004), p: r() * 7 }));
  const base = 330 + r() * 50;
  for (let x = 0; x < W; x++) {
    let h = base;
    for (const w of waves) h += Math.sin(x * w.f + w.p) * w.a;
    const edge = Math.min(x, W - 1 - x);   // the island sinks into the pond at both ends
    if (edge < 120) h += (120 - edge) * (120 - edge) / 60;
    if(map==='twin')h=300+Math.sin(x*.015+rng(seed)()*4)*45+((x>495&&x<705)?H:0);
    if(map==='peaks')h=240+Math.sin(x*.013)*95+Math.sin(x*.029)*25;
    if(map==='small')h=340+Math.sin(x*.02)*35+(Math.abs(x-600)>260?H:0);
    top[x] = Math.max(140, h);
  }
  for (let x = 0; x < W; x++) for (let y = Math.floor(top[x]); y < H; y++) mask[y * W + x] = 1;
  // a few caves and a floating rock make it less flat
  const caves = 2 + Math.floor(r() * 3);
  for (let i = 0; i < caves; i++) { const cx = 200 + r() * 800; carve(mask, cx, top[Math.floor(cx)] + 50 + r() * 70, 18 + r() * 22); }
  if(map==='twin'||map==='small')return mask;
  const fx = 300 + r() * 600, fy = 120 + r() * 60;
  for (let y = -16; y <= 16; y++) for (let x = -70; x <= 70; x++) if ((x * x) / 4900 + (y * y) / 256 <= 1) { const X = Math.round(fx + x), Y = Math.round(fy + y); if (X >= 0 && X < W && Y >= 0 && Y < H) mask[Y * W + X] = 1; }
  return mask;
}
export function solid(mask, x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= W || y < 0) return false;
  if (y >= H) return true;
  return mask[y * W + x] === 1;
}
export function carve(mask, cx, cy, r) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) mask[y * W + x] = 0;
  return [x0, y0, x1, y1];
}
function surfaceBelow(mask, x, y) { for (let yy = Math.max(0, Math.floor(y)); yy < H; yy++) if (solid(mask, x, yy)) return yy; return H; }

// ---------- a new match ----------
export function newGame({ seed = 1, perTeam = 3, cpu = [false, true], level = 1, map = 'island' } = {}) {
  map=MAPS[map]?map:'island';perTeam=Math.max(2,Math.min(MAPS[map].max,Math.floor(perTeam)||MAPS[map].recommended));
  const mask = makeTerrain(seed,map), r = rng(seed ^ 0x9e3779b9), frogs = [];
  const slots=[],candidates=[];
  for(let x=130;x<1070;x+=6){const y=surfaceBelow(mask,x,0)-1;if(y<470&&y>80)candidates.push({x,y});}
  for(let i=0;i<perTeam*2;i++){
    const team=i%2;
    const target=map==='twin'?(team===0?160:750)+(Math.floor(i/2)+.5)*290/perTeam:
      map==='small'?370+(i+.5)*460/(perTeam*2):150+(i+.5)*900/(perTeam*2);
    const available=candidates.filter(p=>slots.every(q=>Math.abs(q.x-p.x)>=58));
    available.sort((a,b)=>Math.abs(a.x-target)-Math.abs(b.x-target));
    if(!available.length)throw new Error('Map has insufficient safe spawn locations');
    slots.push(available[0]);
  }
  if(map!=='twin')for(let i=slots.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  for(let i=0;i<perTeam*2;i++){
    const team=i%2,{x,y}=slots[i];
    frogs.push({ id: i, team, name: NAMES[team][Math.floor(i / 2)], x, y, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: x < W / 2 ? 1 : -1, fallFrom: y, gone: '' });
  }
  return { seed, map, perTeam, mask, mines:[], retreat:0, movement:MOVE_BUDGET, frogs, shots: [], booms: [], texts: [], dirty: [], cpu, level, turn: 0, team: 0, next: [0, 0], current: 0,
    wind: 0, weapon: 'grenade', ammo: [0, 1].map(() => ({candles:1,cluster:4,gold:1,mine:3,dynamite:2})), pistolShots:0, phase: 'aim', timer: TURN_TIME, settle: 0, winner: null, rand: r, events: [] };
}
export function aliveOf(g, team) { return g.frogs.filter(f => f.alive && f.team === team); }
export function startTurn(g) {
  const team = g.turn % 2, list = aliveOf(g, team);
  g.team = team; g.current = list[g.next[team] % list.length].id; g.next[team]++;
  g.pistolShots = 0;g.retreat=0;g.movement=MOVE_BUDGET;
  g.wind = Math.round((g.rand() * 2 - 1) * 10) / 10; g.phase = 'aim'; g.timer = TURN_TIME; g.weapon = 'grenade'; g.settle = 0;
  g.events.push({ type: 'turn' });
}
export const me = g => g.frogs[g.current];
export function projectileOrigin(f, angle) {
  return {x:f.x+Math.cos(angle)*18,y:f.y-32+Math.sin(angle)*18};
}
export function makeProjectile(f, type, angle, power) {
  const speed=(type==='revolver'?1:Math.max(.08,Math.min(1,power)))*WEAPONS[type].power;
  return {type,...projectileOrigin(f,angle),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,t:0,owner:f.id,ownerClear:false};
}
export function safeDirection(g, dir) {
  const f=me(g),x=f.x+dir*24;
  if(x<20||x>W-20)return 0;
  const floor=surfaceBelow(g.mask,x,f.y-4);
  return floor<WATER-15&&floor-f.y<65&&!solid(g.mask,f.x+dir*8,f.y-30)?dir:0;
}
export function retreatDirection(g) {
  const f=me(g),hazards=[...g.shots,...g.mines,...aliveOf(g,1-f.team)];
  const near=hazards.sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];
  const dir=near?(f.x<near.x?-1:1):-f.face;
  return safeDirection(g,dir)||safeDirection(g,-dir);
}

// ---------- actions of the frog whose turn it is ----------
export function walk(g, dir) {
  const f = me(g); if (!canMove(g) || !f.alive || !f.ground || g.movement<1) return false;
  f.face = dir;
  const nx = f.x + dir;
  if (nx < 2 || nx > W - 3) return false;
  for (let up = 0; up <= 3; up++) if (!solid(g.mask, nx, f.y - up) && !solid(g.mask, nx, f.y - up - 10)) { g.movement--;f.x = nx; f.y -= up; if (!solid(g.mask, f.x, f.y + 1)) { f.ground = false; f.fallFrom = f.y; } return true; }
  return false;
}
export function hop(g) {
  const f = me(g); if (!canMove(g) || !f.alive || !f.ground || g.movement<60) return false;
  g.movement-=60;
  f.hopAge=0;f.hopFace=f.face;f.flipped=false;f.flipT=null;
  f.vx = f.face * 95; f.vy = -235; f.ground = false; f.fallFrom = f.y - 40; g.events.push({ type: 'hop' }); return true;
}
export function backflip(g) {
  const f=me(g);
  if(!canMove(g)||g.movement<25||!f.alive||f.ground||f.flipped||!(f.hopAge<=.3))return false;
  g.movement-=25;f.flipped=true;f.flipT=0;f.vx=-f.hopFace*135;f.vy=-300;f.fallFrom=f.y-60;
  g.events.push({type:'hop'});return true;
}
// angle in radians (0 = right, -PI/2 = up), power 0..1; for candles, tx is the x where they fall
export function fire(g, angle, power, tx) {
  const f = me(g), w = WEAPONS[g.weapon];
  if (g.phase !== 'aim' || !f.alive || !w || !Number.isFinite(angle) || !Number.isFinite(power)) return false;
  if (g.pistolShots && g.weapon !== 'revolver') return false;
  if (Number.isFinite(w.ammo) && g.weapon !== 'candles') {
    if (!(g.ammo[g.team][g.weapon] > 0)) return false;
    g.ammo[g.team][g.weapon]--;
  }
  if (g.weapon === 'revolver') g.pistolShots++;
  g.retreat=(g.weapon==='revolver'&&g.pistolShots===1)?0:RETREAT_TIME;
  if(g.retreat>0)g.movement=90;
  if(['mine','dynamite'].includes(g.weapon)){
    const charge={type:g.weapon,x:f.x+f.face*20,y:f.y-3,vx:0,vy:0,t:0};
    if(g.weapon==='mine')g.mines.push(charge);else g.shots.push(charge);
    g.phase='fire';g.events.push({type:'fire',weapon:g.weapon});return true;
  }
  if (g.weapon === 'bat') {
    const direction = Math.cos(angle)>=0?1:-1; f.face=direction;
    g.texts.push({x:f.x+direction*25,y:f.y-25,text:'WHACK!',t:0,team:f.team});
    for (const target of g.frogs) if (target.alive && target.id!==f.id && (target.x-f.x)*direction>=0 && Math.hypot(target.x-f.x,target.y-f.y)<65) {
      hurt(g,target,w.damage); target.vx=direction*440;target.vy=-310;target.ground=false;target.fallFrom=target.y;
    }
    g.phase='fire';g.events.push({type:'fire',weapon:'bat'});return true;
  }
  if (g.weapon === 'candles') {
    if (!(g.ammo[g.team].candles > 0)) return false;
    g.ammo[g.team].candles--;
    const x = Math.max(30, Math.min(W - 30, tx ?? f.x));
    for (let i = -1; i <= 1; i++) g.shots.push({ type: 'candles', x: x + i * 34, y: -30 - Math.abs(i) * 40, vx: 0, vy: 60, t: 0 });
  } else {
    const p = (g.weapon==='revolver'?1:Math.max(.08, Math.min(1, power))) * w.power;
    g.shots.push(makeProjectile(f,g.weapon,angle,power));
    f.face = Math.cos(angle) >= 0 ? 1 : -1;
  }
  g.phase = 'fire'; g.events.push({ type: 'fire', weapon: g.weapon }); return true;
}
export function skip(g) { if (g.phase === 'aim') { g.phase = 'settle'; g.settle = .4; } }

// ---------- simulation ----------
export function stepShot(g, s, mask = g.mask, frogs = g.frogs) {
  const w = WEAPONS[s.type];
  s.t += STEP;
  if(!s.ownerClear){const owner=frogs.find(f=>f.id===s.owner);if(!owner||Math.abs(s.x-owner.x)>15||s.y<owner.y-58||s.y>owner.y+2)s.ownerClear=true;}
  s.vy += G * (w.gravity ?? 1) * STEP;
  if (w.wind) s.vx += g.wind * 140 * STEP;
  const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP;
  if (w.fuse) {
    if (solid(mask, nx, ny)) {
      const hitX = solid(mask, nx, s.y), hitY = solid(mask, s.x, ny);
      if (hitX || !hitY) s.vx = -s.vx * .5;
      if (hitY || !hitX) s.vy = -s.vy * .42;
      s.vx *= .9;
      if (Math.abs(s.vy) < 25 && solid(mask, s.x, s.y + 2)) s.vy = 0;
    } else { s.x = nx; s.y = ny; }
    if (s.t >= w.fuse) return 'boom';
  } else {
    // rockets and candles go off on ground or on a frog
    const n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
    for (let i = 1; i <= n; i++) {
      const x = s.x + (nx - s.x) * i / n, y = s.y + (ny - s.y) * i / n;
      if (solid(mask, x, y) || frogs.some(f => f.alive && (f.id!==s.owner||s.ownerClear) && Math.abs(f.x - x) < 15 && y > f.y - 58 && y < f.y + 2)) { s.x = x; s.y = y; return 'boom'; }
    }
    s.x = nx; s.y = ny;
  }
  if (s.y > WATER + 6) return 'splash';
  if (s.x < -200 || s.x > W + 200 || s.y > H + 50 || s.t > 12 || (s.type==='revolver' && s.y < -200)) return 'gone';
  return '';
}
export function explode(g, x, y, type) {
  const w = WEAPONS[type];
  if(type==='revolver'||type==='bow'){
    const target=g.frogs.filter(f=>f.alive&&Math.abs(f.x-x)<18&&y>f.y-61&&y<f.y+5).sort((a,b)=>Math.hypot(a.x-x,a.y-28-y)-Math.hypot(b.x-x,b.y-28-y))[0];
    if(target)hurt(g,target,w.damage);
    g.dirty.push(carve(g.mask,x,y,w.radius));g.booms.push({x,y,r:5,t:0});g.events.push({type:'boom'});return;
  }
  g.dirty.push(carve(g.mask, x, y, w.radius));
  g.booms.push({ x, y, r: w.radius, t: 0 });
  g.events.push({ type: 'boom' });
  for (const f of g.frogs) {
    if (!f.alive) continue;
    const dx = f.x - x, dy = (f.y - 11) - y, d = Math.hypot(dx, dy), reach = w.radius * 1.7;
    if (d > reach) continue;
    const k = 1 - d / reach, dmg = Math.round(w.damage * (.35 + .65 * k));
    hurt(g, f, dmg);
    const push = 260 * k + 60, nx = d ? dx / d : 0;
    f.vx += nx * push; f.vy -= 150 * k + 90; f.ground = false; f.fallFrom = f.y;
  }
}
function hurt(g, f, dmg) {
  if (dmg <= 0 || !f.alive) return;
  f.hp = Math.max(0, f.hp - dmg); g.texts.push({ x: f.x, y: f.y - 30, text: '-' + dmg, t: 0, team: f.team });
}
function stepFrog(g, f) {
  if (!f.alive) return;
  if(Number.isFinite(f.hopAge))f.hopAge+=STEP;
  if(f.flipT!==null&&f.flipT!==undefined)f.flipT+=STEP;
  if (f.ground) { if (!solid(g.mask, f.x, f.y + 1)) { f.ground = false; f.fallFrom = f.y; } else return; }
  f.vy += G * STEP; f.vx *= .995;
  const parts=Math.max(1,Math.ceil(Math.hypot(f.vx*STEP,f.vy*STEP)/3));
  for(let part=0;part<parts&&!f.ground;part++){
  let nx=f.x+f.vx*STEP/parts,ny=f.y+f.vy*STEP/parts;
  if(solid(g.mask,nx,f.y-14)||solid(g.mask,nx,f.y-40)){nx=f.x;f.vx*=-.25;}
  if (f.vy > 0 && solid(g.mask, nx, ny)) {
    // land on top of the ground
    let y = Math.floor(ny); while (y > 0 && solid(g.mask, nx, y)) y--;
    f.x = nx; f.y = y; f.ground = true;f.flipT=null;f.hopAge=Infinity;
    const drop = f.y - f.fallFrom;
    if (drop > 90) hurt(g, f, Math.min(40, Math.round((drop - 90) / 4)));
    f.vx = 0; f.vy = 0;
  } else if (f.vy<0 && solid(g.mask,nx,ny-55)) {
    f.x=nx;f.vy=0;
  } else { f.x = nx; f.y = ny; }
  }
  if (f.y > WATER) { f.alive = false; f.hp = 0; f.gone = 'splash'; g.events.push({ type: 'splash', x: f.x }); g.texts.push({ x: f.x, y: WATER - 20, text: 'SPLASH!', t: 0, team: f.team }); }
  else if (f.x < -40 || f.x > W + 40) { f.alive = false; f.hp = 0; f.gone = 'away'; }
}
// one fixed step of the whole game
export function step(g) {
  if (g.winner !== null) return;
  for(const m of g.mines.slice()){
    m.t+=STEP;
    if(!solid(g.mask,m.x,m.y+3)){m.vy+=G*STEP;m.y+=m.vy*STEP;}else m.vy=0;
    if(m.y>WATER){g.mines.splice(g.mines.indexOf(m),1);continue;}
    if(m.t>1 && g.frogs.some(f=>f.alive&&Math.hypot(f.x-m.x,f.y-m.y)<32)){
      explode(g,m.x,m.y,'mine');g.mines.splice(g.mines.indexOf(m),1);
    }
  }
  for (const s of g.shots.slice()) {
    const r = stepShot(g, s);
    if (r === 'boom') {
      if (WEAPONS[s.type].children) {
        const type=s.type==='gold'?'toe':'shard';
        for(let i=0;i<5;i++){const a=-Math.PI+(i+.5)*Math.PI/5;g.shots.push({type,x:s.x,y:s.y-5,vx:Math.cos(a)*(160+g.rand()*100),vy:Math.sin(a)*240-60,t:0});}
      }
      explode(g, s.x, s.y, s.type); g.shots.splice(g.shots.indexOf(s), 1); }
    else if (r) { g.shots.splice(g.shots.indexOf(s), 1); if (r === 'splash') g.events.push({ type: 'plop', x: s.x }); }
  }
  for (const f of g.frogs) stepFrog(g, f);
  for (const f of g.frogs) if (f.alive && f.hp <= 0 && f.ground) { f.alive = false; f.gone = 'ko'; g.events.push({ type: 'ko', name: f.name }); }
  g.booms = g.booms.filter(b => (b.t += STEP) < .5);
  g.texts = g.texts.filter(t => (t.t += STEP) < 1.4);
  if (g.phase === 'aim') {
    g.timer -= STEP;
    if (!me(g).alive) { g.phase = 'settle'; g.settle = .6; }
    else if (g.timer <= 0) { g.phase = 'settle'; g.settle = .3; g.events.push({ type: 'timeout' }); }
  } else if (g.phase === 'fire') {
    if(g.weapon==='revolver'&&g.pistolShots===1)g.timer=Math.max(0,g.timer-STEP);
    g.retreat=Math.max(0,g.retreat-STEP);
    if (!g.shots.length && g.retreat<=0) {
      if(g.weapon==='revolver' && g.pistolShots===1 && me(g).alive && me(g).hp>0) { g.phase='aim';g.timer=Math.max(0,g.timer); }
      else {g.phase='settle';g.settle=.9;}
    }
  } else if (g.phase === 'settle') {
    const still = g.frogs.every(f => !f.alive || f.ground);
    if (still && !g.shots.length) g.settle -= STEP;
    if (g.settle <= 0) {
      const a = aliveOf(g, 0).length, b = aliveOf(g, 1).length;
      if (!a || !b) { g.winner = a ? 0 : b ? 1 : -1; g.phase = 'over'; g.events.push({ type: 'over' }); return; }
      g.turn++; startTurn(g);
    }
  }
}

// ---------- the CPU player: tries many throws in its head and picks a good one ----------
function simulate(g, type, angle, power, target) {
  const f=me(g),w=WEAPONS[type],s=makeProjectile(f,type,angle,power);
  if(type==='mine'||type==='dynamite')Object.assign(s,{x:f.x+f.face*20,y:f.y-3,vx:0,vy:0});
  for(let i=0;i<720;i++){const end=stepShot(g,s);if(end==='boom')break;if(end)return {score:-1e9};}
  let score=0;
  for(const o of g.frogs){
    if(!o.alive)continue;
    if(type==='revolver'||type==='bow'){
      if(Math.abs(o.x-s.x)<18&&s.y>o.y-61&&s.y<o.y+5)score+=(o.team===f.team?-1.8:1)*w.damage;
    }else{
      const retreat=(type==='dynamite'||type==='mine')&&o.id===f.id?retreatDirection(g)*70:0;
      const d=Math.hypot(o.x+retreat-s.x,o.y-11-s.y),reach=w.radius*1.7;
      if(d<reach)score+=(o.team===f.team?-1.8:1)*w.damage*(.35+.65*(1-d/reach))*(w.children?1.35:1);
    }
  }
  if(!score)score=-Math.hypot(target.x-s.x,target.y-s.y)/10;
  return {score};
}
export function cpuPlan(g) {
  const f=me(g),enemies=aliveOf(g,1-f.team);
  const target=enemies.slice().sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y))[0];
  let best={score:-1e9,weapon:'grenade',angle:-Math.PI/2,power:.5};
  if(!target)return best;
  const available=type=>!Number.isFinite(WEAPONS[type].ammo)||g.ammo[f.team][type]>0;
  for(const type of g.pistolShots?['revolver']:['rocket','grenade','cluster','gold','bow','revolver']){
    if(!available(type))continue;
    const powers=type==='revolver'?[1]:[.25,.4,.55,.7,.85,1];
    for(let degrees=-175;degrees<=-5;degrees+=g.level===2?5:10)for(const power of powers){
      const angle=degrees*Math.PI/180,r=simulate(g,type,angle,power,target);
      if(r.score>best.score)best={score:r.score,weapon:type,angle,power};
    }
    if(type==='bow'||type==='revolver'){
      const angle=Math.atan2(target.y-30-(f.y-32),target.x-f.x),r=simulate(g,type,angle,1,target);
      if(r.score>best.score)best={score:r.score,weapon:type,angle,power:1};
    }
  }
  if(!g.pistolShots&&Math.hypot(target.x-f.x,target.y-f.y)<65){
    const dir=target.x>f.x?1:-1;
    const friends=aliveOf(g,f.team).some(o=>o.id!==f.id&&(o.x-f.x)*dir>=0&&Math.hypot(o.x-f.x,o.y-f.y)<65);
    if(!friends&&best.score<40)best={score:40,weapon:'bat',angle:dir===1?0:-Math.PI,power:1};
    if(retreatDirection(g)&&available('dynamite')){
      const r=simulate(g,'dynamite',0,1,target);
      if(r.score>best.score)best={score:r.score,weapon:'dynamite',angle:0,power:1};
    }
  }
  const wobble=[.35,.17,.03][g.level]??.17,pw=[.25,.12,.03][g.level]??.12;   // how far the CPU misses: easy, normal, hard
  if(!['bat','dynamite','mine'].includes(best.weapon)){
    best.angle+=(g.rand()*2-1)*wobble;
    best.power=Math.max(.1,Math.min(1,best.power+(g.rand()*2-1)*pw));
  }
  return best;
}
