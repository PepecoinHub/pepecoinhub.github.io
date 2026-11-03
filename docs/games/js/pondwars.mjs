// POND WARS: the page (drawing, controls, CPU turns). The rules live in pondwars-engine.mjs.
import { W, H, WATER, STEP, WEAPONS, newGame, startTurn, step, fire, walk, hop, backflip, canMove, MAPS, makeTerrain, skip, cpuPlan, me, aliveOf, projectileOrigin, safeDirection, retreatDirection } from './pondwars-engine.mjs?v=20261103c';
import { PLAYERS } from './pondwars-players.mjs';
import { bindHold } from './arcade-common.mjs';

const $ = s => document.querySelector(s);
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
if (framed || /[?&]embed=1(&|$)/.test(location.search)) document.documentElement.classList.add('embed');

const cv = $('#pw'), ctx = cv.getContext('2d');
const ground = document.createElement('canvas'); ground.width = W; ground.height = H;
const gctx = ground.getContext('2d'), gimg = gctx.createImageData(W, H);
const descriptions={
rocket:'WIND AFFECTED · IMPACT DETONATION',bat:'CLOSE RANGE · HUGE KNOCKBACK',grenade:'3 SECOND FUSE · BOUNCES',
cluster:'3 SECOND FUSE · 5 FRAGMENTS',revolver:'TWO AIMED SHOTS · STRAIGHT TRAJECTORY',
mine:'ARMS AFTER 1s · PROXIMITY TRIGGER',dynamite:'PLACE AT YOUR FEET · 5 SECOND FUSE',bow:'FAST ARROW · GENTLE ARC',gold:'ONE PER MATCH · FIVE EXPLODING TOES'};
let soundOn=false,audio;
function beep(hz,d=.12){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),v=audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(hz,audio.currentTime);o.frequency.exponentialRampToValueAtTime(20,audio.currentTime+d);v.gain.setValueAtTime(.035,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
const TEAM = [{ name: 'PEP', band: '#2f7de1', text: '#cfe6ff' }, { name: 'FUD', band: '#e23b3b', text: '#ffd4d4' }];
const playerArt=PLAYERS.map(p=>{const img=new Image();img.src=p.src;return img;});
const teamPlayers=[[0,1,2,3],[4,5,6,0]];
const weaponArt=Object.fromEntries(['rocket','bat','grenade','cluster','revolver','bow','gold','mine','dynamite'].map(w=>{const img=new Image();img.src='img/pondwars/'+w+'.svg';return[w,img];}));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let g = null, opts = { mode: 'cpu', level: 1, n: 3, map:'island', mapSeed:20261103 }, seed = 0;
let aim = -Math.PI / 4, aimX = W / 2, charging = false, chargeAt = 0, power = 0, held = { l: 0, r: 0 };
let paused=false, hudTime=0;
let acc = 0, last = 0, cpu = null, shake = 0, splashes = [];

function status(t) { $('#status').textContent = t; }
const isCpu = team => opts.mode === 'cpu' && team === 1;

// ---------- the ground picture, redrawn only where it changes ----------
function paintGround(x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) {
  const m = g.mask, d = gimg.data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, o = i * 4;
    if (!m[i]) { d[o + 3] = 0; continue; }
    let depth = 0; while (depth < 9 && y - depth - 1 >= 0 && m[i - (depth + 1) * W]) depth++;
    const n = ((x * 73856093) ^ (y * 19349663)) & 15;
    if (depth < 3) { d[o] = 92 + n; d[o + 1] = 176 + n; d[o + 2] = 64; }
    else if (depth < 6) { d[o] = 58 + n; d[o + 1] = 128 + n; d[o + 2] = 46; }
    else { const stone=((x*13+y*7)%53<3)?30:0;const band=Math.sin(y*.08+x*.012)*12;d[o]=96+n+stone+band;d[o+1]=63+n+stone;d[o+2]=51+stone; }
    d[o + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

// ---------- drawing ----------
function sky(t) {
  const sk=ctx.createLinearGradient(0,0,0,H);sk.addColorStop(0,'#193d68');sk.addColorStop(.5,'#628d9f');sk.addColorStop(1,'#ecc99c');ctx.fillStyle=sk;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#fce8b7';ctx.beginPath();ctx.arc(970,105,44,0,7);ctx.fill();
  for(let layer=0;layer<3;layer++){ctx.fillStyle=['#567789','#496d72','#355c5f'][layer];ctx.beginPath();ctx.moveTo(0,H);
    for(let x=0;x<=W;x+=10)ctx.lineTo(x,260+layer*65+Math.sin(x*.009+layer*2)*50+Math.sin(x*.023)*19);
    ctx.lineTo(W,H);ctx.fill();}
  ctx.fillStyle='#fff1cd33';
  for(let i=0;i<6;i++){const x=(i*233+t*3)%(W+200)-100,y=45+i%3*42;ctx.beginPath();ctx.ellipse(x,y,65,11,0,0,7);ctx.ellipse(x+23,y-9,35,15,0,0,7);ctx.fill();}
  // Distant, slightly ruined frog castle.
  ctx.fillStyle='#365761';for(const [x,y,h] of [[180,252,85],[222,264,65],[258,240,95]]){ctx.fillRect(x,y,25,h);for(let k=0;k<3;k++)ctx.fillRect(x+k*10,y-9,5,10);ctx.fillStyle='#edc78a';ctx.fillRect(x+10,y+18,5,9);ctx.fillStyle='#365761';}
}
function water(t) {
  ctx.fillStyle = '#2b7fb8cc'; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, WATER + Math.sin(x * .03 + t * (reduce ? 0 : 2)) * 3);
  ctx.lineTo(W, H); ctx.fill();
  ctx.fillStyle = '#ffffff55'; for (let x = 20; x < W; x += 90) ctx.fillRect(x + Math.sin(t + x) * 6, WATER + 12, 26, 2);
  ctx.fillStyle = '#3fae5a'; for (const x of [70, 1090, 1150]) { ctx.beginPath(); ctx.ellipse(x, WATER + 4, 16, 5, 0, .3, 6.0); ctx.fill(); }
}
function frog(f, t) {
  const turn = g.current === f.id && g.phase === 'aim' && f.alive;
  ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y));
  const bob = turn && !reduce ? Math.sin(t * 6) * 1 : 0, s = f.face;
  ctx.fillStyle=TEAM[f.team].band;ctx.beginPath();ctx.ellipse(0,2,20,4,0,0,7);ctx.fill();
  ctx.translate(0,-29+bob);
  if(!reduce && f.flipT!==null && f.flipT!==undefined && !f.ground)ctx.rotate(-f.hopFace*Math.PI*2*Math.min(1,f.flipT/.7));
  else if(!reduce && turn && f.ground && (held.l||held.r))ctx.rotate(Math.sin(t*18)*.055);
  const choice=teamPlayers[f.team][Math.floor(f.id/2)]??0,person=PLAYERS[choice],art=playerArt[choice];
  ctx.scale(s*person.face,1);
  if(art.naturalWidth){
    const [sx,sy,sw,sh]=person.rect||[0,0,art.naturalWidth,art.naturalHeight],height=64,width=Math.min(64,height*sw/sh);
    ctx.drawImage(art,sx,sy,sw,sh,-width/2,-35,width,height);
  }
  ctx.scale(person.face,1);
  if(turn && weaponArt[g.weapon]?.naturalWidth)ctx.drawImage(weaponArt[g.weapon],10,-6,29,29);
  ctx.restore();
  // name and health
  ctx.font = 'bold 12px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
  const label = f.name + ' ' + f.hp;
  ctx.fillStyle = '#000c'; ctx.fillRect(f.x - ctx.measureText(label).width / 2 - 3, f.y - 82, ctx.measureText(label).width + 6, 15);
  ctx.fillStyle = TEAM[f.team].text; ctx.fillText(label, f.x, f.y - 70);
  if (turn) { ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(f.x - 6, f.y - 96 + bob * 2); ctx.lineTo(f.x + 6, f.y - 96 + bob * 2); ctx.lineTo(f.x, f.y - 87 + bob * 2); ctx.fill(); }
}
function shot(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  if(s.type==='dynamite'){ctx.drawImage(weaponArt.dynamite,-10,-18,20,25);ctx.fillStyle='#fff3ba';ctx.font='bold 12px monospace';ctx.fillText(Math.max(1,Math.ceil(5-s.t)),0,-22);}
  else if (WEAPONS[s.type].fuse) {
    ctx.fillStyle = ['gold','toe'].includes(s.type)?'#ffd257':s.type==='cluster'?'#c95d36':'#436d32'; if(['gold','toe'].includes(s.type)){ctx.rotate(s.t*5);ctx.fillRect(-5,-9,8,15);for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-5+i*3,-9,2.5,0,7);ctx.fill();}} ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = '#8fd27d'; ctx.fillRect(-1, -7, 3, 3);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Tahoma'; ctx.textAlign = 'center'; ctx.fillText(String(Math.max(1, Math.ceil(WEAPONS.grenade.fuse - s.t))), 0, -10);
  } else if (s.type==='revolver'||s.type==='bow'){ctx.rotate(Math.atan2(s.vy,s.vx));ctx.fillStyle=s.type==='bow'?'#e2b67e':'#fff4bb';ctx.fillRect(-14,-1,22,2);ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(4,-4);ctx.lineTo(4,4);ctx.fill();} else if (s.type === 'rocket') {
    ctx.rotate(Math.atan2(s.vy, s.vx)); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-7, -2.5, 12, 5); ctx.fillStyle = '#e23b3b'; ctx.fillRect(5, -2.5, 3, 5);
    ctx.fillStyle = '#ffb000'; ctx.fillRect(-11 - Math.random() * 4, -1.5, 4, 3);
  } else {
    ctx.fillStyle = '#7a1218'; ctx.fillRect(-1, -16, 2, 30); ctx.fillStyle = '#e0414c'; ctx.fillRect(-5, -10, 10, 18);
  }
  ctx.restore();
}
function draw(t) {
  ctx.save();
  if (shake > 0 && !reduce) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  sky(t);
  ctx.drawImage(ground, 0, 0);
  // Small rooted details follow the real surface, and disappear with destroyed soil.
  for(let x=135;x<W-120;x+=39){
    let y=0;while(y<WATER && !g.mask[y*W+x])y++;
    if(y>=WATER)continue;
    ctx.strokeStyle='#a6c65b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y-9);ctx.moveTo(x,y);ctx.lineTo(x+5,y-7);ctx.stroke();
    if(x%3===0){ctx.fillStyle='#ede0ae';ctx.fillRect(x+11,y-11,3,10);ctx.fillStyle='#c1684d';ctx.beginPath();ctx.ellipse(x+12,y-12,7,4,0,Math.PI,Math.PI*2);ctx.fill();}
  }
  for (const f of g.frogs) if (f.alive) frog(f, t);
    else if (f.gone === 'ko') { ctx.fillStyle = '#9aa3a8'; ctx.fillRect(f.x - 6, f.y - 14, 12, 14); ctx.beginPath(); ctx.arc(f.x, f.y - 14, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#555'; ctx.font = 'bold 7px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('RIP', f.x, f.y - 7); }
  for(const m of g.mines) {ctx.drawImage(weaponArt.mine,m.x-10,m.y-13,20,20);if(m.t>1){ctx.fillStyle=Math.sin(t*8)>0?'#ff6b45':'#602d28';ctx.fillRect(m.x-2,m.y-12,4,3);}}
  for (const s of g.shots) shot(s);
  for (const b of g.booms) {
    const k = b.t / .5;
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=b.r*(.6+k*2);ctx.fillStyle=i%2?'#e8b85c':'#674b3e';ctx.fillRect(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r+35*k*k,4*(1-k),4*(1-k));}
    ctx.fillStyle = `rgba(255,${200 - k * 150},40,${1 - k})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (.6 + k * .9), 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (.4 + k * 1.4), 0, 7); ctx.stroke();
  }
  water(t);
  splashes = splashes.filter(s => (s.t += 1 / 60) < .8);
  for (const s of splashes) { ctx.fillStyle = `rgba(220,240,255,${1 - s.t / .8})`; for (let i = -3; i <= 3; i++) ctx.fillRect(s.x + i * 5, WATER - Math.sin((s.t / .8) * Math.PI) * (20 - Math.abs(i) * 4), 3, 6); }
  ctx.font = 'bold 16px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
  for (const x of g.texts) { ctx.globalAlpha = Math.max(0, 1 - x.t / 1.4); ctx.fillStyle = '#000'; ctx.fillText(x.text, x.x + 1, x.y - x.t * 30 + 1); ctx.fillStyle = x.text[0] === '-' ? '#ff4a4a' : '#fff'; ctx.fillText(x.text, x.x, x.y - x.t * 30); ctx.globalAlpha = 1; }
  // aim: a crosshair for the frog whose turn it is (not shown for the CPU before it decides)
  if (g.phase === 'aim' && (!isCpu(g.team) || cpu?.aiming)) {
    const f = me(g);
    if (g.weapon === 'candles') {
      ctx.strokeStyle = '#e0414c'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(aimX, 0); ctx.lineTo(aimX, WATER); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0414c'; ctx.font = 'bold 12px Tahoma'; ctx.fillText('CANDLES DROP HERE', aimX, 18);
    } else {
      const cx = f.x + Math.cos(aim) * 52, cy = f.y - 32 + Math.sin(aim) * 52;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.moveTo(cx - 11, cy); ctx.lineTo(cx + 11, cy); ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy + 11); ctx.stroke();
      if (charging || cpu?.charging) {
        const p = cpu?.charging ? cpu.p : power;
        ctx.fillStyle = `hsl(${120 - p * 120} 90% 50%)`;
        for (let i = 1; i <= 10; i++) if (i / 10 <= p) { ctx.beginPath(); ctx.arc(f.x + Math.cos(aim) * (12 + i * 4), f.y - 32 + Math.sin(aim) * (12 + i * 4), 1.5 + i * .25, 0, 7); ctx.fill(); }
      }
    }
  }
  ctx.restore();
}

// ---------- the bar above the field ----------
function hud() {
  for (const t of [0, 1]) {
    const box = $('#hp' + t); box.replaceChildren();
    for (const f of g.frogs.filter(f => f.team === t)) { const i = document.createElement('i'); i.style.width = Math.max(2, f.hp * (innerWidth < 760 ? .22 : .5)) + 'px'; i.title = f.name + ': ' + f.hp;i.style.background=TEAM[t].band; if (!f.alive) i.className = 'dead'; box.append(i); }
  }
  for(const t of [0,1]){$('#name'+t).textContent=TEAM[t].name+(t===1&&isCpu(1)?' (CPU)':'');$('#name'+t).style.color=TEAM[t].band;}
  const f = me(g);
  $('#turn').textContent = g.phase === 'over' ? 'Game over' : `${f.name} (${TEAM[g.team].name})`;
  $('#turn').className = 't' + g.team;
  $('#turn').style.color=TEAM[g.team].band;
  $('#timer').textContent = g.phase === 'aim' ? Math.ceil(g.timer) : g.retreat>0?'RUN '+Math.ceil(g.retreat):'·';
  $('#timer').classList.toggle('low', g.phase === 'aim' && g.timer < 6);
  const wi = $('#wind i'); wi.style.width = Math.abs(g.wind) * 50 + '%'; wi.style.marginLeft = g.wind < 0 ? (50 - Math.abs(g.wind) * 50) + '%' : '50%';
  $('#wind').title = 'Wind ' + (g.wind < 0 ? '← ' : g.wind > 0 ? '→ ' : '') + Math.abs(g.wind * 10) + ': it pushes rockets';
  const mine = !paused && g.phase === 'aim' && !isCpu(g.team);
  document.querySelectorAll('.pw-controls button').forEach(b => { b.disabled = !mine; });
  for(const id of ['#left','#right','#hop'])$(id).disabled=!movementAllowed();
  $('#movement').textContent='MOVE '+Math.floor(g.movement);
  document.querySelectorAll('[data-w]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === g.weapon)));
  document.querySelectorAll('[data-w]').forEach(b=>{
    const w=b.dataset.w, count=g.ammo[g.team][w];
    b.disabled=!mine || count===0 || (g.pistolShots>0 && w!=='revolver');
    b.querySelector('small').textContent=Number.isFinite(count)?'× '+count:w==='revolver'?(2-g.pistolShots)+' SHOTS':'UNLIMITED';
  });
  $('#weapon-name').textContent=WEAPONS[g.weapon].name;
  $('#weapon-detail').textContent=(descriptions[g.weapon]||'')+' · MAX '+WEAPONS[g.weapon].damage+' HP'+(g.weapon==='cluster'||g.weapon==='gold'?' + FRAGMENTS':'');
  $('#fire').textContent=g.weapon==='bat'?'SWING THE BAT':g.weapon==='revolver'?'FIRE · '+(2-g.pistolShots)+' LEFT':'HOLD TO FIRE';
  $('#angle-read').textContent=Math.round(-aim*180/Math.PI)+'°';
}

// ---------- turns, events, CPU ----------
function events() {
  for (const e of g.events) {
    if (e.type === 'turn') { closeArsenal();keys.clear();charging=false;held.l=held.r=0;$('#power').style.width='0%'; const f = me(g); cpu = null; aim = f.face > 0 ? -Math.PI / 4 : -3 * Math.PI / 4; aimX = f.x; status(isCpu(g.team) ? `${f.name} (${TEAM[g.team].name}, CPU) is thinking…` : `${f.name}: A/D move · Space jump · Space ×2 backflip · Right click arsenal · Hold left click fire`); }
    if (e.type === 'fire') {closeArsenal();keys.clear();held.l=held.r=0;clearCharge();status(g.retreat>0?'RETREAT · 3 seconds to find cover!':'Revolver: aim your second shot.');}
    if (e.type === 'boom') {shake=9;beep(65,.35);}
    if (e.type === 'splash' || e.type === 'plop') splashes.push({ x: e.x ?? W / 2, t: 0 });
    if (e.type === 'ko') status(`${e.name} is out of the war.`);
    if (e.type === 'timeout') status('Too slow! The turn goes to the other team.');
    if (e.type === 'over') over();
  }
  g.events.length = 0;
}
function cpuTick(dt) {
  if(!isCpu(g.team))return;
  if(g.phase==='fire'&&g.retreat>0){const dir=retreatDirection(g);if(dir)for(let i=0;i<Math.max(1,Math.round(dt/STEP));i++)walk(g,dir);return;}
  if(g.phase!=='aim')return;
  if (!cpu) cpu = { wait: .65, plan: null,move:0 };
  cpu.wait -= dt;
  if (cpu.wait > 0) return;
  if(!cpu.plan&&cpu.move<.8&&g.movement>80){
    const f=me(g),target=aliveOf(g,1-g.team).sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0];
    const danger=g.mines.some(m=>Math.hypot(m.x-f.x,m.y-f.y)<85);
    const dir=danger?retreatDirection(g):target&&Math.abs(target.x-f.x)>200?safeDirection(g,target.x>f.x?1:-1):0;
    cpu.move+=dt;
    if(dir){for(let i=0;i<Math.max(1,Math.round(dt/STEP));i++)walk(g,dir);return;}
  }
  if(cpu.plan&&cpu.shotNumber!==g.pistolShots){cpu.plan=null;cpu.t=0;}
  if (!cpu.plan) { cpu.plan = cpuPlan(g);cpu.shotNumber=g.pistolShots; g.weapon = cpu.plan.weapon; cpu.aiming = true; cpu.from = aim; cpu.t = 0; cpu.wait = 0; return; }
  cpu.t += dt;
  const k = Math.min(1, cpu.t / .7);
  if (g.weapon === 'candles') aimX = me(g).x + (cpu.plan.tx - me(g).x) * k;
  else aim = cpu.from + (cpu.plan.angle - cpu.from) * k;
  if (k < 1) return;
  cpu.charging = true; cpu.p = Math.min(cpu.plan.power, (cpu.t - .7) / 1.1);
  if (cpu.p >= cpu.plan.power) { cpu.charging = false; fire(g, cpu.plan.angle, cpu.plan.power, cpu.plan.tx); }
}
function over() {
  const w = g.winner;
  $('#over-title').textContent = w === -1 ? 'Nobody won. The pond won.' : `${TEAM[w].name} WINS!`;
  $('#over-text').textContent = w>=0 ? TEAM[w].name+' claim the pond. Rematch?' : 'Everybody ended up in the water.';
  $('#over').hidden = false; status('Game over.');
}

// ---------- start ----------
function start() {
  seed = opts.mapSeed;
  for(const t of [0,1]){TEAM[t].name=$('#team'+t).value.trim().slice(0,18)||(t?'FUD':'PEP');TEAM[t].band=COLORS[teamColors[t]].hex;TEAM[t].text='#fff0cc';}
  g = newGame({ seed, map:opts.map, perTeam: opts.n, cpu: [false, opts.mode === 'cpu'], level: opts.level });
  paused=false;$('#pause').textContent='Pause';acc=0;charging=false;held.l=held.r=0;paintGround(); startTurn(g); events();hud();
  $('#menu').hidden = true; $('#over').hidden = true; cv.focus({ preventScroll: true });
}
function frame(now) {
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
  if (g && !paused && !['over','menu'].includes(g.phase)) {
    if (charging) { power = Math.min(1, (now - chargeAt) / 1300); $('#power').style.width = power * 100 + '%'; }
    acc += dt;
    while (acc >= STEP) {
      if (movementAllowed()) { if (held.l) walk(g, -1); if (held.r) walk(g, 1); }
      step(g); acc -= STEP;
      for (const r of g.dirty) paintGround(...r); g.dirty.length = 0;
      events();
      if (g.phase === 'over') break;
    }
    cpuTick(dt);
    shake = Math.max(0, shake - dt * 30);
    hudTime+=dt;if(hudTime>.08){hud();hudTime=0;}
  }
  if (g) draw(now / 1000);
  requestAnimationFrame(frame);
}

// ---------- controls ----------
const mine = () => !paused && g && g.phase === 'aim' && !isCpu(g.team);
const movementAllowed=()=>!paused&&g&&!isCpu(g.team)&&canMove(g)&&$('#menu').hidden;
const keys=new Set();
const arsenal=document.createElement('div');
arsenal.className='pw-arsenal';arsenal.hidden=true;arsenal.setAttribute('role','dialog');arsenal.setAttribute('aria-label','Choose a weapon');
arsenal.innerHTML='<div class="arsenal-title">ARSENAL <span>1–9 · ESC TO CLOSE</span><button type="button" aria-label="Close weapon selection">×</button></div><div class="pw-weapons">'+$('#weapon-options').innerHTML+'</div>';
document.body.append(arsenal);
function clearCharge(){charging=false;power=0;$('#power').style.width='0%';}
function closeArsenal(focus=false){arsenal.hidden=true;if(focus)cv.focus({preventScroll:true});}
function openArsenal(x,y){
  if(!mine())return;
  if(!arsenal.hidden){closeArsenal(true);return;}
  clearCharge();keys.clear();held.l=held.r=0;arsenal.hidden=false;hud();
  const r=arsenal.getBoundingClientRect();
  arsenal.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';
  arsenal.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))+'px';
  arsenal.querySelector('[data-w]:not(:disabled)')?.focus({preventScroll:true});
}
arsenal.querySelector('.arsenal-title button').onclick=()=>closeArsenal(true);
cv.addEventListener('contextmenu',e=>{e.preventDefault();openArsenal(e.clientX,e.clientY);});
arsenal.addEventListener('contextmenu',e=>{e.preventDefault();closeArsenal(true);});
document.addEventListener('pointerdown',e=>{if(!arsenal.hidden&&!arsenal.contains(e.target)&&e.button===0){closeArsenal(true);e.preventDefault();e.stopPropagation();}},true);
function jump(){if(!movementAllowed()||!arsenal.hidden)return;clearCharge();if(me(g).ground)hop(g);else backflip(g);}
function toWorld(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
function aimAt(e) { if (!mine()) return; const [x, y] = toWorld(e), f = me(g); aimX = Math.max(30, Math.min(W - 30, x)); aim = Math.atan2(y - (f.y - 32), x - f.x); f.face = x >= f.x ? 1 : -1; }
function beginCharge() { if (!mine() || charging || !arsenal.hidden) return; charging = true; chargeAt = performance.now(); power = 0; }
function release(cancelShort) {
  if (!charging) return;
  charging = false; const held = performance.now() - chargeAt; $('#power').style.width = '0%';
  if (cancelShort && held < 180) return;   // a short tap only aims
  if (mine()) fire(g, aim, Math.max(.08, Math.min(1,held/1300)), aimX);
}
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || charging) aimAt(e); });
cv.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); aimAt(e); beginCharge(); });
cv.addEventListener('pointerup', () => release(true)); cv.addEventListener('pointercancel', clearCharge);cv.addEventListener('lostpointercapture',()=>{if(charging)clearCharge();});
const fb = $('#fire');
bindHold(fb,beginCharge,()=>release(false),()=>{charging=false;$('#power').style.width='0%';});
for (const [id, k] of [['#left', 'l'], ['#right', 'r']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); held[k] = 1; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, () => { held[k] = 0; });
}
$('#arsenal-open').onclick=e=>{const r=e.target.getBoundingClientRect();openArsenal(r.left,r.top-250);};
$('#hop').addEventListener('click', jump);
$('#skip').addEventListener('click', () => { if (mine()) { skip(g); status('Turn skipped.'); } });
document.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { if (mine() && !g.pistolShots && g.ammo[g.team][b.dataset.w]!==0) {clearCharge();g.weapon = b.dataset.w;closeArsenal(true);hud();} }));
document.addEventListener('keydown', e => {
  if(e.code==='Escape'){closeArsenal(true);return;}
  if (!g || e.target.closest('input,textarea,select') || !$('#menu').hidden || !$('#over').hidden) return;
  const k=e.code;
  if(k==='Space'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)jump();return;}
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(k)){
    e.preventDefault();if(movementAllowed()&&arsenal.hidden){keys.add(k);held.l=keys.has('ArrowLeft')||keys.has('KeyA');held.r=keys.has('ArrowRight')||keys.has('KeyD');}
  }else if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(k)){
    e.preventDefault();if(mine()&&arsenal.hidden)aim+=(['ArrowUp','KeyW'].includes(k)?-1:1)*.05*(me(g).face||1);
  }else if(/^Digit[1-9]$/.test(k)&&mine()){
    const w=['rocket','bat','grenade','cluster','revolver','bow','gold','mine','dynamite'][Number(k.slice(-1))-1];
    if(!g.pistolShots&&g.ammo[g.team][w]!==0){clearCharge();g.weapon=w;closeArsenal(true);hud();}
  }
},true);
document.addEventListener('keyup',e=>{keys.delete(e.code);if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){held.l=keys.has('ArrowLeft')||keys.has('KeyA');held.r=keys.has('ArrowRight')||keys.has('KeyD');}if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();}},true);
function pauseGame(){closeArsenal();keys.clear(); if(!g || ['menu','over'].includes(g.phase))return;paused=true;held.l=held.r=0;clearCharge();$('#pause').textContent='Resume';status('PAUSED · The pond can wait.');hud();}
window.addEventListener('blur',pauseGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data==='pondwars-pause')pauseGame();});
$('#pause').onclick=()=>{if(paused){paused=false;last=performance.now();acc=0;$('#pause').textContent='Pause';status(isCpu(g.team)?'CPU is planning its move…':g.retreat>0?'RETREAT · Find cover!':'Your turn · Aim, move or select a weapon.');cv.focus();}else pauseGame();};
$('#sound').onclick=()=>{soundOn=!soundOn;$('#sound').textContent='Sound: '+(soundOn?'on':'off');if(soundOn)beep(440);};
$('#restart').onclick=()=>{pauseGame();$('#menu').hidden=false;};


// the menu
function pick(sel, key, parse) {
  document.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll(sel).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    opts[key] = parse(b.dataset[key]); $('#levels').hidden = opts.mode !== 'cpu';paintPlayers();
  }));
}
const COLORS=[{name:'Blue',hex:'#4f9ef0'},{name:'Red',hex:'#ef6c63'},{name:'Green',hex:'#70c963'},{name:'Yellow',hex:'#edcf54'},{name:'Purple',hex:'#bc92e9'},{name:'Orange',hex:'#ef9a4f'}],teamColors=[0,1];
function portrait(canvas,index){
  const img=playerArt[index],p=PLAYERS[index],c=canvas.getContext('2d');c.clearRect(0,0,48,52);
  if(!img.naturalWidth)return;
  const [sx,sy,sw,sh]=p.rect||[0,0,img.naturalWidth,img.naturalHeight],h=48,w=Math.min(46,h*sw/sh);
  c.imageSmoothingEnabled=sw>50;c.drawImage(img,sx,sy,sw,sh,(48-w)/2,52-h,w,h);
}
function paintPlayers(){
  for(const team of [0,1]){
    const box=$('#players'+team);box.replaceChildren();
    for(let slot=0;slot<opts.n;slot++){
      const row=document.createElement('label');row.className='player-row';
      const thumb=document.createElement('canvas');thumb.width=48;thumb.height=52;thumb.setAttribute('aria-hidden','true');portrait(thumb,teamPlayers[team][slot]);
      const caption=document.createElement('span');caption.textContent='Frog '+(slot+1);
      const select=document.createElement('select');select.setAttribute('aria-label','Team '+(team+1)+' frog '+(slot+1)+' character');
      PLAYERS.forEach((p,i)=>{const option=document.createElement('option');option.value=i;option.textContent=p.name;select.append(option);});select.value=teamPlayers[team][slot];
      select.onchange=()=>{teamPlayers[team][slot]=Number(select.value);portrait(thumb,Number(select.value));};
      row.append(thumb,caption,select);box.append(row);
    }
  }
}
function paintColors(){
  document.querySelectorAll('.color-pick').forEach(box=>{
    const team=Number(box.dataset.team);box.replaceChildren();
    COLORS.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='color-swatch';b.style.background=c.hex;b.title=c.name;b.setAttribute('aria-label',c.name);b.setAttribute('aria-pressed',String(teamColors[team]===i));b.disabled=teamColors[1-team]===i;b.onclick=()=>{teamColors[team]=i;paintColors();};box.append(b);});
  });
}
function mapPreview(recommend=false){
  const info=MAPS[opts.map];if(recommend)opts.n=info.recommended;opts.n=Math.min(opts.n,info.max);
  document.querySelectorAll('[data-n]').forEach(b=>{b.disabled=Number(b.dataset.n)>info.max;b.setAttribute('aria-pressed',String(Number(b.dataset.n)===opts.n));});
  $('#map-info').textContent=info.name+' · up to '+info.max+' frogs / team';
  const c=$('#map-preview').getContext('2d'),mask=makeTerrain(opts.mapSeed,opts.map);c.fillStyle='#264c68';c.fillRect(0,0,300,150);
  c.fillStyle='#9fc15d';for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4)if(mask[y*W+x])c.fillRect(x/4,y/4,1,1);
  c.fillStyle='#4b9ab1';c.fillRect(0,WATER/4,300,(H-WATER)/4);
  paintPlayers();
}
$('#map-choice').onchange=e=>{opts.map=e.target.value;opts.mapSeed=crypto.getRandomValues(new Uint32Array(1))[0];mapPreview(true);};
$('#reroll-map').onclick=()=>{opts.mapSeed=crypto.getRandomValues(new Uint32Array(1))[0];mapPreview();};
$('#roll-map').onclick=()=>{const maps=Object.keys(MAPS);opts.map=maps[Math.floor(Math.random()*maps.length)];$('#map-choice').value=opts.map;opts.mapSeed=crypto.getRandomValues(new Uint32Array(1))[0];mapPreview(true);};
paintColors();mapPreview();
pick('[data-mode]', 'mode', String); pick('[data-level]', 'level', Number); pick('[data-n]', 'n', Number);
$('#go').addEventListener('click', start); $('#again').addEventListener('click', start);
$('#tomenu').addEventListener('click', () => { $('#over').hidden = true; $('#menu').hidden = false; });

// a quiet island behind the menu
g = newGame({ seed: 20261103, perTeam: 3 }); paintGround(); g.phase = 'menu';
requestAnimationFrame(frame);
$('#go').disabled=true;$('#go').textContent='LOADING THE CREW…';
Promise.all(playerArt.map(img=>img.decode().catch(()=>null))).then(()=>{paintPlayers();$('#go').disabled=false;$('#go').textContent='START THE WAR →';});
