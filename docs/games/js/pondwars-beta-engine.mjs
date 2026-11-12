// POND WARS engine: turn-based frog artillery on a destructible island. No DOM here (tests run it in Node).
// Units are pixels and seconds; the world is W x H; the pond starts at WATER (anything below it drowns).
// Movement and projectile ideas (bounce off the real slope, wind that drifts between turns, step-up walking,
// slide after a knockback, speed caps, rope / jetpack / teleport / drill) are inspired by Squeak & Destroy
// (MIT, Los Polos Amigos Kft.); the code here is our own.
import { EXPANSION, ARSENAL_BUILD, normalizePacks, starterAmmo, packEnabled } from './pondwars-arsenal.mjs';
import { EXPANSION_MAPS, buildExpansionMap } from './pondwars-maps.mjs';
export const W = 1200, H = 600, WATER = 560, STEP = 1 / 60, G = 520;
export const MAPS={
island:{name:'Pond Island',max:4,recommended:3},
twin:{name:'Split Decision',max:4,recommended:4},
peaks:{name:'Croak Canyon',max:3,recommended:3},
small:{name:'Last Lily',max:2,recommended:2},
...EXPANSION_MAPS,
};
export const TURN_TIME=30, RETREAT_TIME=3, MOVE_BUDGET=160;
export const WIND_ACC=230, STEP_UP=6, STEP_DOWN=6, ROPE_MAX=330, JET_FUEL=3.5;
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
  // a frog at 0 HP pops: a small crater, but the blast reaches its neighbours (a few HP and a shove)
  frog: { name:'Frog Blast', radius:20, reach:75, damage:15 },
  drill: { name:'Drill Shell', short:'Drill', radius:34, damage:44, ammo:2, power:560, gravity:.3 },
  // utilities: they do not end the turn
  rope: { name:'Grapple Rope', short:'Rope', radius:0, damage:0, ammo:5, power:1, utility:true },
  jetpack: { name:'Jetpack', short:'Jetpack', radius:0, damage:0, ammo:2, power:1, utility:true },
  teleport: { name:'Teleport', short:'Teleport', radius:0, damage:0, ammo:2, power:1, utility:true },
};
for (const [id, spec] of Object.entries(EXPANSION)) WEAPONS[id] = spec;
export function weaponAllowed(g, id) {
  const w = WEAPONS[id];
  if (!w || !('ammo' in w) || w.child) return false;
  if (w.expansion) return packEnabled(g && g.packs, id);
  return true;
}
const NAMES = [['Hopper', 'Lily', 'Ribbit', 'Pad'], ['Croak', 'Bog', 'Toady', 'Murk']];

export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.state = () => a;   // rng(next.state()) continues the same sequence (used to save and resume a match online)
  return next;
}

// ---------- terrain: 1 = ground ----------
export function makeTerrain(seed, map = 'island') {
  if (EXPANSION_MAPS[map]) return buildExpansionMap(map, seed);
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
// the outward surface normal around (x, y): points away from the solid ground nearby
export function normalAt(mask, x, y, r = 5) {
  let sx = 0, sy = 0;
  for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) if (ox * ox + oy * oy <= r * r && solid(mask, x + ox, y + oy)) { sx -= ox; sy -= oy; }
  const d = Math.hypot(sx, sy);
  return d ? { x: sx / d, y: sy / d } : { x: 0, y: -1 };
}
function surfaceBelow(mask, x, y) { for (let yy = Math.max(0, Math.floor(y)); yy < H; yy++) if (solid(mask, x, yy)) return yy; return H; }

// ---------- a new match ----------
export function newGame({ seed = 1, perTeam = 3, cpu = [false, true], level = 1, map = 'island', packs: packInput } = {}) {
  const packs = normalizePacks(packInput);
  map=MAPS[map]?map:'island';perTeam=Math.max(2,Math.min(MAPS[map].max,Math.floor(perTeam)||MAPS[map].recommended));
  const mask = makeTerrain(seed,map), r = rng(seed ^ 0x9e3779b9), frogs = [];
  const slots=[],candidates=[];
  for(let x=130;x<1070;x+=6){const y=surfaceBelow(mask,x,0)-1;if(y<470&&y>80)candidates.push({x,y});}
  for(let i=0;i<perTeam*2;i++){
    const team=i%2;
    const target=map==='twin'?(team===0?160:750)+(Math.floor(i/2)+.5)*290/perTeam:
      map==='small'?370+(i+.5)*460/(perTeam*2):
      map==='doom'?(team===0?160:940)+Math.floor(i/2)*70:
      map==='farm'?(team===0?120:720)+(Math.floor(i/2)+.5)*380/perTeam:
      150+(i+.5)*900/(perTeam*2);
    const available=candidates.filter(p=>slots.every(q=>Math.abs(q.x-p.x)>=58));
    available.sort((a,b)=>Math.abs(a.x-target)-Math.abs(b.x-target));
    if(!available.length)throw new Error('Map has insufficient safe spawn locations');
    slots.push(available[0]);
  }
  if(map!=='twin'&&!MAPS[map].split)for(let i=slots.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  for(let i=0;i<perTeam*2;i++){
    const team=i%2,{x,y}=slots[i];
    frogs.push({ id: i, team, name: NAMES[team][Math.floor(i / 2)], x, y, vx: 0, vy: 0, hp: 100, alive: true, ground: true, face: x < W / 2 ? 1 : -1, fallFrom: y, gone: '' });
  }
  const ammo = [0, 1].map(() => starterAmmo(packs));
  return { seed, map, perTeam, mask, mines:[], retreat:0, movement:MOVE_BUDGET, frogs, shots: [], booms: [], texts: [], dirty: [], cpu, level, turn: 0, team: 0, next: [0, 0], current: 0,
    ...(Object.keys(packs).length?{arsenalBuild:ARSENAL_BUILD}:{}), wind: 0, weapon: 'grenade', ammo, packs, ctl:{x:0,y:0}, pistolShots:0, phase: 'aim', timer: TURN_TIME, settle: 0, winner: null, rand: r, events: [] };
}
export function aliveOf(g, team) { return g.frogs.filter(f => f.alive && f.team === team); }
export function startTurn(g) {
  const team = g.turn % 2, list = aliveOf(g, team);
  g.team = team; g.current = list[g.next[team] % list.length].id; g.next[team]++;
  g.pistolShots = 0;g.retreat=0;g.movement=MOVE_BUDGET;
  // the wind drifts from turn to turn instead of jumping around (first turn: random)
  g.wind = g.turn === 0 ? Math.round((g.rand() * 2 - 1) * 10) / 10 : Math.max(-1, Math.min(1, Math.round((g.wind + (g.rand() - .5) * .8) * 10) / 10));
  for (const f of g.frogs) { f.rope = null; f.jet = null; }
  g.ctl = { x: 0, y: 0 };
  g.phase = 'aim'; g.timer = TURN_TIME; g.weapon = 'grenade'; g.settle = 0;
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
  for (let up = 0; up <= STEP_UP; up++) if (!solid(g.mask, nx, f.y - up) && !solid(g.mask, nx, f.y - up - 10) && !solid(g.mask, nx, f.y - up - 30)) {
    g.movement--; f.x = nx; f.y -= up; settleFeet(g, f); return true;
  }
  return false;
}
// after a step: walk down a gentle slope instead of falling off every pixel
function settleFeet(g, f) {
  if (solid(g.mask, f.x, f.y + 1)) return;
  for (let d = 1; d <= STEP_DOWN; d++) if (solid(g.mask, f.x, f.y + d + 1)) { f.y += d; return; }
  f.ground = false; f.fallFrom = f.y;
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
export function fire(g, angle, power, tx, ty) {
  const f = me(g), w = WEAPONS[g.weapon];
  if (g.phase !== 'aim' || !f.alive || !w || !Number.isFinite(angle) || !Number.isFinite(power)) return false;
  if (w.expansion) {
    if (!weaponAllowed(g, g.weapon) || w.ready === false) return false;
    return fireExpansion(g, f, w, angle, power, tx, ty);
  }
  if (w.utility) return useUtility(g, f, angle, tx, ty);
  f.rope = null; f.jet = null;
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
function spendExpansion(g, w) {
  if (!Number.isFinite(w.ammo)) return true;
  if (!(g.ammo[g.team][g.weapon] > 0)) return false;
  g.ammo[g.team][g.weapon]--;
  return true;
}
function beginShot(g) {
  const f = me(g);
  f.rope = null; f.jet = null;
  g.retreat = RETREAT_TIME;
  g.movement = 90;
  g.phase = 'fire';
  g.events.push({ type: 'fire', weapon: g.weapon });
}
// Melee, placed and thrown expansion weapons. Later packs add roles before the final return.
function fireExpansion(g, f, w, angle, power, tx, ty) {
  if (w.role === 'melee') {
    if (!spendExpansion(g, w)) return false;
    const dir = Math.cos(angle) >= 0 ? 1 : -1;
    f.face = dir;
    g.texts.push({ x: f.x + dir * 28, y: f.y - 28, text: w.cry || 'WHACK!', t: 0, team: f.team });
    for (const target of g.frogs) {
      if (!target.alive || target.id === f.id) continue;
      if ((target.x - f.x) * dir < 0) continue;
      if (Math.hypot(target.x - f.x, target.y - f.y) >= w.range) continue;
      hurt(g, target, w.damage);
      target.vx += dir * w.knockVx;
      target.vy += w.knockVy;
      target.ground = false;
      target.fallFrom = target.y;
    }
    if (w.crater > 0) g.dirty.push(carve(g.mask, f.x + dir * 36, f.y + 2, w.crater));
    g.booms.push({ x: f.x + dir * 30, y: f.y - 8, r: Math.max(6, w.crater || 8), t: 0 });
    beginShot(g);
    return true;
  }
  if (w.role === 'mine') {
    if (!spendExpansion(g, w)) return false;
    g.mines.push({ type: g.weapon, x: f.x + f.face * 22, y: f.y - 4, vx: 0, vy: 0, t: 0 });
    beginShot(g);
    return true;
  }
  if (w.role === 'salvo') {
    if (!spendExpansion(g, w)) return false;
    const x = Math.max(40, Math.min(W - 40, Number.isFinite(tx) ? tx : f.x));
    const n = w.count, child = WEAPONS[w.childType];
    for (let i = 0; i < n; i++) {
      g.shots.push({ type: w.childType, x: x + (i - (n - 1) / 2) * w.spread, y: -20 - (i % 3) * 34, vx: 0, vy: child.power, t: 0, owner: f.id, ownerClear: true });
    }
    beginShot(g);
    return true;
  }
  if (w.role === 'throw' || w.role === 'rocket') {
    if (!spendExpansion(g, w)) return false;
    g.shots.push(makeProjectile(f, g.weapon, angle, power));
    f.face = Math.cos(angle) >= 0 ? 1 : -1;
    beginShot(g);
    return true;
  }
  if (w.role === 'guide') {
    if (!spendExpansion(g, w)) return false;
    const speed = w.power;
    g.shots.push({ type: g.weapon, ...projectileOrigin(f, angle), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, heading: angle, pitch: Math.max(-1.1, Math.min(1.1, angle)), t: 0, owner: f.id, ownerClear: false });
    f.face = Math.cos(angle) >= 0 ? 1 : -1;
    f.rope = null; f.jet = null;
    g.retreat = 0;
    g.phase = 'guide';
    g.events.push({ type: 'fire', weapon: g.weapon });
    return true;
  }
  if (w.role === 'strike') {
    if (!spendExpansion(g, w)) return false;
    const x = Math.max(40, Math.min(W - 40, Number.isFinite(tx) ? tx : f.x));
    // The donkey comes from the sky, so it lands on the first surface at that x (a floating island
    // above is hit, not passed through). ty is kept for the call signature only.
    const ground = surfaceBelow(g.mask, x, 0);
    g.shots.push({ type: g.weapon, x, y: ground - 1, targetX: x, targetY: ground - 1, vx: 0, vy: 0, t: 0, warning: true, owner: f.id, ownerClear: true });
    beginShot(g);
    return true;
  }
  return false;
}
export function detonateGuided(g) {
  if (g.phase !== 'guide') return false;
  const i = g.shots.findIndex(s => WEAPONS[s.type]?.role === 'guide');
  if (i < 0) return false;
  const s = g.shots[i];
  explode(g, s.x, s.y, s.type, s.vx, s.vy);
  g.shots.splice(i, 1);
  g.phase = 'settle';
  g.settle = .9;
  g.events.push({ type: 'detonate' });
  return true;
}
// ---------- utilities: rope, jetpack, teleport (the turn goes on) ----------
function useUtility(g, f, angle, tx, ty) {
  const kind = g.weapon, left = g.ammo[g.team][kind];
  if (kind === 'rope' && f.rope) { f.rope = null; g.events.push({ type: 'unrope' }); return true; }
  if (kind === 'jetpack' && f.jet) { f.jet = null; return true; }
  if (!(left > 0)) return false;
  if (kind === 'rope') {
    const ox = f.x, oy = f.y - 30, dx = Math.cos(angle), dy = Math.sin(angle);
    for (let d = 14; d <= ROPE_MAX; d += 3) {
      const x = ox + dx * d, y = oy + dy * d;
      if (x < 0 || x >= W || y < 0 || y >= WATER) break;
      if (solid(g.mask, x, y)) {
        g.ammo[g.team].rope--; f.jet = null;
        f.rope = { x, y, len: Math.max(26, d - 2), t: 0 };
        f.ground = false; f.fallFrom = f.y; f.vy = Math.min(f.vy, -40);
        g.events.push({ type: 'rope', x, y }); return true;
      }
    }
    g.events.push({ type: 'miss' }); return false;
  }
  if (kind === 'jetpack') {
    g.ammo[g.team].jetpack--; f.rope = null; f.jet = { fuel: JET_FUEL };
    g.events.push({ type: 'jet' }); return true;
  }
  if (kind === 'teleport') {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const spot = clearSpot(g, tx, ty);
    if (!spot) { g.events.push({ type: 'miss' }); return false; }
    g.ammo[g.team].teleport--;
    g.events.push({ type: 'teleport', from: { x: f.x, y: f.y }, to: spot });
    f.x = spot.x; f.y = spot.y; f.vx = 0; f.vy = 0; f.rope = null; f.jet = null; f.ground = true; f.fallFrom = f.y;
    return true;
  }
  return false;
}
// the nearest place around (x, y) where a whole frog can stand on the ground (not over the water)
function clearSpot(g, x, y) {
  const body = (px, py) => [-8, 0, 8].every(ox => [-4, -20, -36, -50].every(oy => !solid(g.mask, px + ox, py + oy)));
  for (let r = 0; r <= 120; r += 6) for (let i = 0; i < (r ? 16 : 1); i++) {
    const a = i * Math.PI / 8, px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
    if (px <= 20 || px >= W - 20 || py <= 60 || solid(g.mask, px, py)) continue;
    const gy = surfaceBelow(g.mask, px, py);
    if (gy >= WATER - 5) continue;
    if (body(px, gy - 1)) return { x: px, y: gy - 1 };
  }
  return null;
}
export function skip(g) { if (g.phase === 'aim') { g.phase = 'settle'; g.settle = .4; } }
function stepDoge(g, s, mask, frogs) {
  const w = WEAPONS.doge, ctl = g.ctl || { x: 0, y: 0 };
  // A/D (◀ ▶) turn the nose clockwise / anticlockwise; W/S (↑ ↓) swing the nose toward straight up / straight down.
  // The flyer always flies where its nose points (the old code mixed a heading for x with a separate pitch for y,
  // so turning left and right felt the same and the Doge could not really be steered).
  s.heading += ctl.x * w.turnRate * STEP;
  if (ctl.y) {
    const want = ctl.y < 0 ? -Math.PI / 2 : Math.PI / 2;
    const diff = Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading));
    s.heading += Math.sign(diff) * Math.min(Math.abs(diff), w.pitchRate * STEP);
  }
  s.heading = Math.atan2(Math.sin(s.heading), Math.cos(s.heading));
  s.pitch = s.heading;
  const wantX = Math.cos(s.heading) * w.cruise, wantY = Math.sin(s.heading) * w.cruise;
  s.vx += (wantX - s.vx) * w.lag * STEP;
  s.vy += (wantY - s.vy) * w.lag * STEP;
  s.vy += G * w.guideGravity * STEP;
  const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP;
  const n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
  for (let i = 1; i <= n; i++) {
    const x = s.x + (nx - s.x) * i / n, y = s.y + (ny - s.y) * i / n;
    if (solid(mask, x, y) || frogs.some(f => f.alive && (f.id !== s.owner || s.ownerClear) && Math.abs(f.x - x) < 15 && y > f.y - 58 && y < f.y + 2)) {
      s.x = x; s.y = y; return 'boom';
    }
  }
  s.x = nx; s.y = ny;
  if (s.t >= w.lifetime) return 'boom';
  if (s.y > WATER + 6) return 'splash';
  if (s.x < -200 || s.x > W + 200) return 'gone';
  return '';
}
// Red candles: no blast. Each candle falls straight down; a frog it lands right on top of gets hurt and
// bounced off, then the candle sinks into the ground for 2 seconds and is gone (no crater).
export const CANDLE_SINK = 2;
const centredOn = (f, x, y, half) => f.alive && Math.abs(f.x - x) < half && y > f.y - 58 && y < f.y + 2;
function stepCandle(g, s, mask, frogs) {
  if (s.sink != null) { s.sink += STEP; return s.sink >= CANDLE_SINK ? 'gone' : ''; }
  s.vy += G * STEP;
  const ny = s.y + s.vy * STEP, n = Math.max(1, Math.ceil(Math.abs(ny - s.y) / 2));
  for (let i = 1; i <= n; i++) {
    const y = s.y + (ny - s.y) * i / n;
    const f = frogs.find(o => centredOn(o, s.x, y, 9) && !(s.hit || []).includes(o.id));
    if (f) { s.hit = [...(s.hit || []), f.id]; s.hitNow = f.id; }
    if (solid(mask, s.x, y)) { s.y = y; s.vy = 0; s.sink = 0; return ''; }
  }
  s.y = ny;
  return s.y > WATER + 6 ? 'splash' : '';
}
// Miner's pickaxe: thrown with a spin. The first frog it touches takes the hit ('pickhit').
// If it bites the ground or flies for outTime, it turns and homes back to the thrower through the terrain,
// still able to hit anyone in the way; reaching the thrower is a catch ('caught'), which refunds it.
function stepPickaxe(g, s, mask, frogs) {
  const w = WEAPONS.pickaxe, owner = frogs.find(f => f.id === s.owner);
  const touch = (x, y) => frogs.find(f => f.alive && (f.id !== s.owner || (s.ownerClear && !s.back)) && Math.abs(f.x - x) < 14 && y > f.y - 56 && y < f.y + 2);
  if (!s.back) {
    s.vy += G * w.gravity * STEP;
    const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP, n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
    for (let i = 1; i <= n; i++) {
      const x = s.x + (nx - s.x) * i / n, y = s.y + (ny - s.y) * i / n;
      const f = touch(x, y); if (f) { s.x = x; s.y = y; s.hitNow = f.id; return 'pickhit'; }
      if (solid(mask, x, y)) { s.dig = { x, y }; s.back = true; s.x = s.x + (nx - s.x) * (i - 1) / n; s.y = s.y + (ny - s.y) * (i - 1) / n; return ''; }
    }
    s.x = nx; s.y = ny;
    if (s.y > WATER + 6) return 'splash';
    if (s.t >= w.outTime || s.x < -150 || s.x > W + 150) s.back = true;
    return '';
  }
  if (!owner || !owner.alive) return 'gone';
  const dx = owner.x - s.x, dy = owner.y - 30 - s.y, d = Math.hypot(dx, dy) || 1;
  if (d < 22) return 'caught';
  s.vx += (dx / d * w.returnSpeed - s.vx) * 5 * STEP; s.vy += (dy / d * w.returnSpeed - s.vy) * 5 * STEP;
  const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP, n = Math.max(1, Math.ceil(Math.hypot(nx - s.x, ny - s.y) / 3));
  for (let i = 1; i <= n; i++) { const x = s.x + (nx - s.x) * i / n, y = s.y + (ny - s.y) * i / n, f = touch(x, y); if (f) { s.x = x; s.y = y; s.hitNow = f.id; return 'pickhit'; } }
  s.x = nx; s.y = ny;
  return s.t > 8 ? 'gone' : '';
}
function stepDonkey(g, s, mask) {
  const w = WEAPONS.donkey;
  if (s.t < w.warn) { s.x = s.targetX; s.y = s.targetY; s.vx = 0; s.vy = 0; s.warning = true; return ''; }
  if (s.warning) { s.warning = false; s.x = s.targetX; s.y = Math.max(8, s.targetY - w.drop); s.vy = 60; s.vx = 0; }
  s.vy += G * w.strikeGravity * STEP;
  const ny = s.y + s.vy * STEP, steps = Math.max(1, Math.ceil(Math.abs(ny - s.y)));
  for (let i = 1; i <= steps; i++) {
    const y = s.y + (ny - s.y) * i / steps;
    if (solid(mask, s.x, y) || y >= s.targetY) { s.y = y; return 'boom'; }
  }
  s.y = ny;
  if (s.y > WATER + 6) return 'splash';
  return '';
}

// ---------- simulation ----------
export function stepShot(g, s, mask = g.mask, frogs = g.frogs) {
  const w = WEAPONS[s.type];
  s.t += STEP;
  if(!s.ownerClear){const owner=frogs.find(f=>f.id===s.owner);if(!owner||Math.abs(s.x-owner.x)>15||s.y<owner.y-58||s.y>owner.y+2)s.ownerClear=true;}
  if (s.type === 'doge') return stepDoge(g, s, mask, frogs);
  if (s.type === 'donkey') return stepDonkey(g, s, mask);
  if (s.type === 'candles') return stepCandle(g, s, mask, frogs);
  if (s.type === 'pickaxe') return stepPickaxe(g, s, mask, frogs);
  s.vy += G * (w.gravity ?? 1) * STEP;
  if (w.wind) s.vx += g.wind * WIND_ACC * STEP;
  const nx = s.x + s.vx * STEP, ny = s.y + s.vy * STEP;
  if (s.type === 'drill') return stepDrill(g, s, mask, frogs, nx, ny);
  if (w.fuse) {
    // Sweep every pixel, including fused grenades. A thin wall must not be skipped.
    const count=Math.max(1,Math.ceil(Math.hypot(nx-s.x,ny-s.y)));
    const dx=(nx-s.x)/count,dy=(ny-s.y)/count;
    for(let i=0;i<count;i++){
      const x=s.x+dx,y=s.y+dy;
      if(!solid(mask,x,y)){s.x=x;s.y=y;continue;}
      const n=normalAt(mask,s.x,s.y,5),vn=s.vx*n.x+s.vy*n.y;
      if (vn < 0) {
        const tx = s.vx - vn * n.x, ty = s.vy - vn * n.y;
        const rest = w.bell ? 0.92 : 0.82, bounce = w.bell ? 0.55 : 0.45;
        s.vx = tx * rest - vn * bounce * n.x;
        s.vy = ty * rest - vn * bounce * n.y;
        if (w.bell && vn < -40) s.ding = true;
      }
      if(Math.hypot(s.vx,s.vy)<28&&solid(mask,s.x,s.y+2)){s.vx*=.5;s.vy=0;}
      if(solid(mask,s.x,s.y)){s.x+=n.x;s.y+=n.y;}
      break;
    }
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
// drill shell: flies with light gravity; on the first bite into the ground it bores straight on,
// carving a tunnel, and goes off after 150 px or when it comes out the other side
function stepDrill(g, s, mask, frogs, nx, ny) {
  if (s.bore === undefined) {
    if (frogs.some(f => f.alive && (f.id !== s.owner || s.ownerClear) && Math.abs(f.x - nx) < 15 && ny > f.y - 58 && ny < f.y + 2)) { s.x = nx; s.y = ny; return 'boom'; }
    if (solid(mask, nx, ny)) { const sp = Math.hypot(s.vx, s.vy) || 1; s.dx = s.vx / sp; s.dy = s.vy / sp; s.bore = 0; s.x = nx; s.y = ny; }
    else { s.x = nx; s.y = ny; if (s.y > WATER + 6) return 'splash'; if (s.x < -200 || s.x > W + 200 || s.t > 12) return 'gone'; return ''; }
  }
  const sp = 300 * STEP;
  s.x += s.dx * sp; s.y += s.dy * sp; s.vx = s.dx * 300; s.vy = s.dy * 300; s.bore += sp;
  if (mask === g.mask) g.dirty.push(carve(mask, s.x, s.y, 9)); else carve(mask, s.x, s.y, 9);
  if (s.bore >= 150 || (s.bore > 12 && !solid(mask, s.x + s.dx * 10, s.y + s.dy * 10)) || s.y > WATER || s.x < 0 || s.x >= W || s.y < 0) return 'boom';
  return '';
}
// vx, vy: the speed of the shell that exploded. A hit frog takes part of that momentum and gets moved.
export function explode(g, x, y, type, vx = 0, vy = 0) {
  const w = WEAPONS[type];
  if(type==='revolver'||type==='bow'){
    const target=g.frogs.filter(f=>f.alive&&Math.abs(f.x-x)<18&&y>f.y-61&&y<f.y+5).sort((a,b)=>Math.hypot(a.x-x,a.y-28-y)-Math.hypot(b.x-x,b.y-28-y))[0];
    if(target){hurt(g,target,w.damage);const dir=Math.sign(vx)||(target.x>=x?1:-1);knock(g,target,dir*(type==='bow'?140:110),-100);}
    g.dirty.push(carve(g.mask,x,y,w.radius));g.booms.push({x,y,r:5,t:0});g.events.push({type:'boom'});return;
  }
  const hole = w.crater ?? w.radius;
  g.dirty.push(carve(g.mask, x, y, hole));
  g.booms.push({ x, y, r: w.radius, t: 0 });
  g.events.push({ type: 'boom', weapon:type, x, y, r: w.radius });
  const reach = w.reach ?? w.radius * 1.7, carry = Math.max(-80, Math.min(80, vx * .14));
  for (const f of g.frogs) {
    if (!f.alive) continue;
    const dx = f.x - x, dy = (f.y - 11) - y, d = Math.hypot(dx, dy);
    if (d > reach) continue;
    const k = 1 - d / reach, dmg = Math.round(w.damage * (.35 + .65 * k));
    hurt(g, f, dmg);
    // Away from the blast, at least a little sideways (a hit from straight above still moves the frog),
    // plus the shell's own momentum: a rocket from the left shoves the frog to the right.
    const push = (260 * k + 60) * (w.knock ?? 1), away = Math.abs(dx) > 3 ? Math.sign(dx) : Math.sign(vx) || (f.x >= x ? 1 : -1);
    const side = d && Math.abs(dx / d) > .25 ? dx / d : away * .25;
    knock(g, f, side * push + carry * k, -(150 * k + 90));
  }
}
function knock(g, f, vx, vy) { f.vx += vx; f.vy += vy; f.ground = false; f.fallFrom = f.y; }
function hurt(g, f, dmg) {
  if (dmg <= 0 || !f.alive) return;
  f.hp = Math.max(0, f.hp - dmg); g.texts.push({ x: f.x, y: f.y - 30, text: '-' + dmg, t: 0, team: f.team });
}
// a frog on the ground with speed left over (knocked back): slides along the surface, losing speed
function slide(g, f) {
  const dir = Math.sign(f.vx), n = Math.max(1, Math.round(Math.abs(f.vx) * STEP));
  for (let i = 0; i < n; i++) {
    const nx = f.x + dir;
    if (nx < 2 || nx > W - 3) { f.vx = 0; return; }
    let moved = false;
    for (let up = 0; up <= STEP_UP; up++) if (!solid(g.mask, nx, f.y - up) && !solid(g.mask, nx, f.y - up - 10) && !solid(g.mask, nx, f.y - up - 30)) { f.x = nx; f.y -= up; moved = true; break; }
    if (!moved) { f.vx = 0; return; }
    if (!solid(g.mask, f.x, f.y + 1)) {
      let d = 1; while (d <= STEP_DOWN && !solid(g.mask, f.x, f.y + d + 1)) d++;
      if (d > STEP_DOWN) { f.ground = false; f.fallFrom = f.y; f.vy = 0; return; }
      f.y += d;
    }
  }
  f.vx *= .86; if (Math.abs(f.vx) < 12) f.vx = 0;
}
function stepFrog(g, f) {
  if (!f.alive) return;
  if(Number.isFinite(f.hopAge))f.hopAge+=STEP;
  if(f.flipT!==null&&f.flipT!==undefined)f.flipT+=STEP;
  const active = g.frogs[g.current] === f && g.phase === 'aim', ctl = g.ctl || { x: 0, y: 0 };
  // jetpack: up = lift (beats gravity), left/right = sideways thrust; fuel only burns while thrusting
  if (f.jet) {
    const up = active && ctl.y < 0, side = active ? ctl.x : 0;
    if (up || side) {
      if (up) { f.vy -= 980 * STEP; f.ground = false; }
      f.vx += side * 520 * STEP;
      f.vy = Math.max(-260, f.vy); f.vx = Math.max(-240, Math.min(240, f.vx));
      f.jet.fuel -= STEP; f.fallFrom = f.y;
      if (side) f.face = side > 0 ? 1 : -1;
      if (f.jet.fuel <= 0) f.jet = null;
    }
  }
  if (f.ground) {
    if (!solid(g.mask, f.x, f.y + 1)) { f.ground = false; f.fallFrom = f.y; }
    else if (Math.abs(f.vx) > 12) { slide(g, f); if (f.ground) return; }
    else { f.vx = 0; return; }
  }
  f.vy += G * STEP; f.vx *= f.jet ? .99 : .995;
  // rope: pump left/right along the swing, shorten (up) or lengthen (down) the rope
  if (f.rope) {
    const r = f.rope, dx = f.x - r.x, dy = f.y - 30 - r.y, d = Math.hypot(dx, dy) || 1;
    if (active) {
      let tx = -dy / d, ty = dx / d; if (tx < 0) { tx = -tx; ty = -ty; }
      f.vx += tx * ctl.x * 330 * STEP; f.vy += ty * ctl.x * 330 * STEP;
      r.len = Math.max(26, Math.min(ROPE_MAX, r.len + ctl.y * 150 * STEP));
      if (ctl.x) f.face = ctl.x > 0 ? 1 : -1;
    }
    r.t += STEP; f.fallFrom = Math.min(f.fallFrom, f.y);
  }
  // speed caps: a huge blast cannot throw a frog through a wall in one step
  const sp = Math.hypot(f.vx, f.vy); if (sp > 700) { f.vx *= 700 / sp; f.vy *= 700 / sp; }
  if (f.vy > 560) f.vy = 560;
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
    // a knocked-back frog keeps part of its speed and slides; a hop or a fall just stops
    f.vx = Math.abs(f.vx) > 150 ? f.vx * .45 : 0; f.vy = 0; f.rope = null;
  } else if (f.vy<0 && solid(g.mask,nx,ny-55)) {
    f.x=nx;f.vy=0;
  } else { f.x = nx; f.y = ny; }
  }
  // the rope holds: never further than its length from the anchor; the anchor can be blown away
  if (f.rope && f.alive) {
    const r = f.rope;
    if (!solid(g.mask, r.x, r.y) && !solid(g.mask, r.x, r.y - 2) && !solid(g.mask, r.x + 2, r.y) && !solid(g.mask, r.x - 2, r.y)) f.rope = null;
    else {
      const dx = f.x - r.x, dy = f.y - 30 - r.y, d = Math.hypot(dx, dy) || 1;
      if (d > r.len) {
        const px = r.x + dx / d * r.len, py = r.y + dy / d * r.len + 30;
        if (!solid(g.mask, px, py - 14) && !solid(g.mask, px, py - 40)) { f.x = px; f.y = py; }
        const vr = (f.vx * dx + f.vy * dy) / d;
        if (vr > 0) { f.vx -= vr * dx / d; f.vy -= vr * dy / d; }
      }
    }
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
    const spec = WEAPONS[m.type] || WEAPONS.mine;
    const arm = spec.arm ?? 1, prox = spec.prox ?? 32;
    if(m.t>arm && g.frogs.some(f=>f.alive&&Math.hypot(f.x-m.x,f.y-m.y)<prox)){
      explode(g,m.x,m.y,m.type||'mine');g.mines.splice(g.mines.indexOf(m),1);
    }
  }
  for (const s of g.shots.slice()) {
    const r = stepShot(g, s);
    if (s.hitNow != null) {
      const f = g.frogs.find(o => o.id === s.hitNow), w = WEAPONS[s.type]; s.hitNow = null;
      if (f && s.type === 'candles') { hurt(g, f, w.damage); knock(g, f, (f.x >= s.x ? 1 : -1) * 150, -260); }
      if (f && s.type === 'pickaxe') { hurt(g, f, w.damage); knock(g, f, (Math.sign(s.vx) || (f.x >= s.x ? 1 : -1)) * w.knockVx, w.knockVy); g.texts.push({ x: f.x, y: f.y - 70, text: w.cry, t: 0 }); g.events.push({ type: 'pickhit', x: s.x, y: s.y }); }
    }
    if (s.dig) { g.dirty.push(carve(g.mask, s.dig.x, s.dig.y, WEAPONS.pickaxe.crater)); g.events.push({ type: 'dig', x: s.dig.x, y: s.dig.y }); s.dig = null; }
    if (r === 'caught') { const o = g.frogs.find(f => f.id === s.owner); if (o && g.ammo[o.team]) g.ammo[o.team].pickaxe = (g.ammo[o.team].pickaxe || 0) + 1; g.texts.push({ x: s.x, y: s.y - 20, text: 'CAUGHT', t: 0 }); g.events.push({ type: 'catch', x: s.x, y: s.y }); g.shots.splice(g.shots.indexOf(s), 1); continue; }
    if (s.ding) { s.ding = false; g.events.push({ type: 'bell', x: s.x, y: s.y }); g.texts.push({ x: s.x, y: s.y - 14, text: 'DING', t: 0 }); }
    if (r === 'boom') {
      if (WEAPONS[s.type].children) {
        const type=WEAPONS[s.type].childType ?? (s.type==='gold'?'toe':'shard');
        for(let i=0;i<5;i++){const a=-Math.PI+(i+.5)*Math.PI/5;g.shots.push({type,x:s.x,y:s.y-5,vx:Math.cos(a)*(160+g.rand()*100),vy:Math.sin(a)*240-60,t:0});}
      }
      explode(g, s.x, s.y, s.type, s.vx, s.vy); g.shots.splice(g.shots.indexOf(s), 1); }
    else if (r) { g.shots.splice(g.shots.indexOf(s), 1); if (r === 'splash') g.events.push({ type: 'plop', x: s.x }); }
  }
  if (g.phase !== 'aim') for (const f of g.frogs) { f.rope = null; f.jet = null; }
  for (const f of g.frogs) stepFrog(g, f);
  // A frog at 0 HP pops once it lands. Neighbours can drop to 0 too and pop when they land: chain reactions are allowed.
  for (const f of g.frogs) if (f.alive && f.hp <= 0 && f.ground) {
    f.alive = false; f.gone = 'ko'; g.events.push({ type: 'ko', name: f.name, x: f.x, y: f.y });
    g.texts.push({ x: f.x, y: f.y - 50, text: 'KABOOM!', t: 0, team: f.team });
    explode(g, f.x, f.y - 12, 'frog');
    const below = surfaceBelow(g.mask, f.x, f.y);   // the gravestone sits at the bottom of the new crater
    if (below >= WATER) f.gone = 'boom'; else f.y = below - 1;
  }
  g.booms = g.booms.filter(b => (b.t += STEP) < .5);
  g.texts = g.texts.filter(t => (t.t += STEP) < 1.4);
  if (g.phase === 'aim') {
    g.timer -= STEP;
    if (!me(g).alive) { g.phase = 'settle'; g.settle = .6; }
    else if (g.timer <= 0) { g.phase = 'settle'; g.settle = .3; g.events.push({ type: 'timeout' }); }
  } else if (g.phase === 'guide') {
    if (!g.shots.some(s => WEAPONS[s.type]?.role === 'guide')) { g.phase = 'settle'; g.settle = .9; }
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
