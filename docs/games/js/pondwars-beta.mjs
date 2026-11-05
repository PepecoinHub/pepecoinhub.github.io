// FROGAGEDDON: the page (drawing, controls, CPU turns). The rules live in pondwars-engine.mjs.
import { W, H, WATER, STEP, G, WEAPONS, TURN_TIME, newGame, startTurn, fire, walk, canMove, MAPS, makeTerrain, cpuPlan, me, aliveOf, safeDirection, retreatDirection } from './pondwars-beta-engine.mjs?v=20261106a';
import { KEY, applyInput, NetMatch, tabTransport } from './pondwars-beta-net.mjs?v=20261106a';
import { PLAYERS } from './pondwars-players.mjs';
import { bindHold } from './arcade-common.mjs';

const $ = s => document.querySelector(s);
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
if (framed || /[?&]embed=1(&|$)/.test(location.search)) document.documentElement.classList.add('embed');

const cv = $('#pw'), ctx = cv.getContext('2d');
// The battlefield is always W×H. On a wide screen the canvas gets wider instead of leaving empty bands at the sides:
// the sky, hills and water simply go on to the left and right (OX = world units added on each side).
let VW = W, OX = 0;
// ui: how much to enlarge the crosshair and power meter, so they stay readable when a phone shrinks the battlefield
let ui = 1;
function fitStage() {
  const r=cv.parentElement.getBoundingClientRect();
  VW=Math.max(W,Math.round(H*r.width/Math.max(1,r.height)));OX=(VW-W)/2;
  if(cv.width!==VW)cv.width=VW;
  const shown=Math.min(r.width/VW,r.height/H)||1;ui=Math.max(1,Math.min(2,.9/shown));
}
addEventListener('resize', () => requestAnimationFrame(fitStage));
if ('ResizeObserver' in window) { let ro = 0; new ResizeObserver(() => { cancelAnimationFrame(ro); ro = requestAnimationFrame(fitStage); }).observe(document.body); }
requestAnimationFrame(fitStage);
const ground = document.createElement('canvas'); ground.width = W; ground.height = H;
const gctx = ground.getContext('2d'), gimg = gctx.createImageData(W, H);
const descriptions={
rocket:'WIND AFFECTED · IMPACT DETONATION',bat:'CLOSE RANGE · HUGE KNOCKBACK',grenade:'3 SECOND FUSE · BOUNCES',
cluster:'3 SECOND FUSE · 5 FRAGMENTS',revolver:'TWO AIMED SHOTS · STRAIGHT TRAJECTORY',
mine:'ARMS AFTER 1s · PROXIMITY TRIGGER',drill:'BORES 150 PX INTO THE GROUND · THEN BOOM',candles:'CLICK THE MAP · THREE RED CANDLES FALL',
rope:'CLICK WHERE TO HOOK · A/D SWING · W/S SHORTER/LONGER · SPACE LETS GO',jetpack:'W FLY UP · A/D SIDEWAYS · 3.5s FUEL',teleport:'CLICK A SPOT ON THE MAP',dynamite:'PLACE AT YOUR FEET · 5 SECOND FUSE',bow:'FAST ARROW · GENTLE ARC',gold:'ONE PER MATCH · FIVE EXPLODING TOES'};
let soundOn=false,audio;
function beep(hz,d=.12){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),v=audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(hz,audio.currentTime);o.frequency.exponentialRampToValueAtTime(20,audio.currentTime+d);v.gain.setValueAtTime(.035,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
const TEAM = [{ name: 'PEP', band: '#2f7de1', text: '#cfe6ff' }, { name: 'FUD', band: '#e23b3b', text: '#ffd4d4' }];
// ---- team-colour helpers (parse #rgb/#rrggbb, mix toward a target, pick readable text) ----
function hexRGB(h){const s=String(h).replace('#','');const x=s.length===3?s.split('').map(c=>c+c).join(''):s.padEnd(6,'0').slice(0,6);return [parseInt(x.slice(0,2),16)||0,parseInt(x.slice(2,4),16)||0,parseInt(x.slice(4,6),16)||0];}
function mix(a,b,t){const A=hexRGB(a),B=hexRGB(b);return [0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t));}
function rgba(c,al){return `rgba(${c[0]},${c[1]},${c[2]},${al})`;}
// Readable text on a given background colour (white on dark, near-black on light).
function readable(h){const [r,gr,b]=hexRGB(h);return (r*0.299+gr*0.587+b*0.114)>150?'#1a1205':'#fff0cc';}
const playerArt=PLAYERS.map(p=>{const img=new Image();img.src=p.src;return img;});
const teamPlayers=[[0,1,2,3],[4,5,6,0]];
const weaponArt=Object.fromEntries(['rocket','bat','grenade','cluster','revolver','bow','gold','mine','dynamite','drill','candles','rope','jetpack','teleport'].map(w=>{const img=new Image();img.src='img/pondwars/'+w+'.svg';return[w,img];}));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let g = null, opts = { mode: 'cpu', level: 1, n: 3, map:'island', mapSeed:20261103 }, seed = 0;
let aimY = 300, parts = [], aim = -Math.PI / 4, aimX = W / 2, charging = false, chargeAt = 0, power = 0, held = { l: 0, r: 0 };
let paused=false, hudTime=0, visualDt=0;
const previousPose=new WeakMap();
function pose(o){const p=previousPose.get(o);const a=Math.min(1,acc/STEP);return p?{...o,x:p.x+(o.x-p.x)*a,y:p.y+(o.y-p.y)*a}:o;}
held.u = 0;
let acc = 0, last = 0, cpu = null, shake = 0, splashes = [];
// pending: the player's actions (jump, fire, weapon, skip) waiting for the next simulation step.
// Everything the player does goes through applyInput, the same path an online match replays.
let pending = [], net = null, remoteP = 0;
const touchUI = matchMedia('(pointer: coarse)');

function status(t) { $('#status').textContent = t; }
const isCpu = team => opts.mode === 'cpu' && team === 1;
const isOnline = team => !!net && team !== net.team;
const remoteTurn = () => !!net && !net.drives();

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
    else { const cellX=Math.floor(x/76),cellY=Math.floor(y/58),cx=cellX*76+38+Math.sin(cellY*7)*17,cy=cellY*58+29;const stone=Math.pow((x-cx)/29,2)+Math.pow((y-cy)/20,2)<1?24:0;const band=Math.sin(y*.055+x*.009)*13;const violet=g.map==='peaks';d[o]=(violet?128:173)+n+stone+band;d[o+1]=(violet?55:112)+n+stone;d[o+2]=(violet?103:48)+stone; }
    d[o + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

// ---------- drawing ----------
function sky(t) {
  const XL = -OX, XR = W + OX;
  const sk=ctx.createLinearGradient(0,0,0,H);sk.addColorStop(0,'#193d68');sk.addColorStop(.5,'#628d9f');sk.addColorStop(1,'#ecc99c');ctx.fillStyle=sk;ctx.fillRect(XL,0,XR-XL,H);
  ctx.fillStyle='#fce8b7';ctx.beginPath();ctx.arc(970,105,44,0,7);ctx.fill();
  for(let layer=0;layer<3;layer++){ctx.fillStyle=['#567789','#496d72','#355c5f'][layer];ctx.beginPath();ctx.moveTo(XL,H);
    for(let x=Math.floor(XL/10)*10;x<=XR+10;x+=10)ctx.lineTo(x,260+layer*65+Math.sin(x*.009+layer*2)*50+Math.sin(x*.023)*19);
    ctx.lineTo(XR,H);ctx.fill();}
  ctx.fillStyle='#fff1cd33';
  for(let i=0;i<6+Math.ceil(OX/200)*2;i++){const x=XL+(i*233+t*3)%(XR-XL+200)-100,y=45+i%3*42;ctx.beginPath();ctx.ellipse(x,y,65,11,0,0,7);ctx.ellipse(x+23,y-9,35,15,0,0,7);ctx.fill();}
  // Distant, slightly ruined frog castle.
  ctx.fillStyle='#365761';for(const [x,y,h] of [[180,252,85],[222,264,65],[258,240,95]]){ctx.fillRect(x,y,25,h);for(let k=0;k<3;k++)ctx.fillRect(x+k*10,y-9,5,10);ctx.fillStyle='#edc78a';ctx.fillRect(x+10,y+18,5,9);ctx.fillStyle='#365761';}
}
function water(t) {
  const XL = -OX, XR = W + OX;
  ctx.fillStyle = '#2b7fb8cc'; ctx.beginPath(); ctx.moveTo(XL, H);
  for (let x = Math.floor(XL / 10) * 10; x <= XR + 10; x += 10) ctx.lineTo(x, WATER + Math.sin(x * .03 + t * (reduce ? 0 : 2)) * 3);
  ctx.lineTo(XR, H); ctx.fill();
  ctx.fillStyle = '#ffffff55'; for (let x = Math.floor(XL / 90) * 90 + 20; x < XR; x += 90) ctx.fillRect(x + Math.sin(t + x) * 6, WATER + 12, 26, 2);
  ctx.fillStyle = '#3fae5a'; for (const x of [70, 1090, 1150]) { ctx.beginPath(); ctx.ellipse(x, WATER + 4, 16, 5, 0, .3, 6.0); ctx.fill(); }
}
function frog(f, t) {
  const turn = g.current === f.id && g.phase === 'aim' && f.alive;
  ctx.save(); ctx.translate(f.x, f.y);
  const bob = turn && !reduce ? Math.sin(t * 6) * 1 : 0, s = f.face;
  const band = TEAM[f.team].band, dark = rgba(mix(band, '#000000', .55), 1);
  const mk = 1 + (ui - 1) * .6;               // markers grow a little on small/phone screens
  // ---- team platform disc under the frog's feet: a bold, high-contrast team marker ----
  // Colour tells teams apart; the SHAPE differs per team too, so colour-blind players and
  // players who pick two similar custom colours can still read PEP (team 0) vs FUD (team 1).
  ctx.save();
  ctx.translate(0, 2); ctx.scale(mk, mk);
  ctx.lineWidth = 2.5;
  if (f.team === 0) {                          // PEP: solid filled disc, single light ring
    ctx.fillStyle = rgba(hexRGB(band), .9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 24, 9, 0, 0, 7); ctx.stroke();
  } else {                                     // FUD: open double ring (hollow centre), dark+team rings
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 25, 10, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = rgba(hexRGB(band), .9); ctx.lineWidth = 4; ctx.strokeStyle = rgba(hexRGB(band), 1);
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 8, 0, 0, 7); ctx.stroke();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 15, 5.5, 0, 0, 7); ctx.stroke();
  }
  // team initial baked into the marker: a colour-independent shape cue (P vs F)
  ctx.font = 'bold 9px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeStyle = dark;
  ctx.strokeText(TEAM[f.team].name[0], 0, 0); ctx.fillText(TEAM[f.team].name[0], 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  ctx.translate(0,-29+bob);
  if(!reduce && f.flipT!==null && f.flipT!==undefined && !f.ground)ctx.rotate(-f.hopFace*Math.PI*2*Math.min(1,f.flipT/.7));
  else if(!reduce && turn && f.ground && (held.l||held.r))ctx.rotate(Math.sin(t*18)*.055);
  const choice=teamPlayers[f.team][Math.floor(f.id/2)]??0,person=PLAYERS[choice],art=playerArt[choice];
  ctx.scale(s*person.face,1);
  if(art.naturalWidth){
    const [sx,sy,sw,sh]=person.rect||[0,0,art.naturalWidth,art.naturalHeight],height=64,width=Math.min(64,height*sw/sh);
    // team-colour glow hugging the sprite, so the team still reads when the under-foot disc
    // is hidden by terrain. The halo pulses on a frog's turn unless reduced-motion is on.
    const glow = turn && !reduce ? 7 + Math.sin(t * 5) * 3 : 5;
    ctx.save(); ctx.shadowColor = band; ctx.shadowBlur = glow;
    ctx.drawImage(art,sx,sy,sw,sh,-width/2,-35,width,height);
    ctx.drawImage(art,sx,sy,sw,sh,-width/2,-35,width,height); // second pass deepens the outline
    ctx.restore();
    ctx.drawImage(art,sx,sy,sw,sh,-width/2,-35,width,height);
  }
  ctx.scale(person.face,1);
  if(turn && weaponArt[g.weapon]?.naturalWidth)ctx.drawImage(weaponArt[g.weapon],10,-6,29,29);
  ctx.restore();
  // team pennant flag above the frog: a second team-colour cue near the label, readable even
  // when the under-foot disc is occluded. It waves on a frog's turn unless reduced-motion is on.
  const flagW = 15 * mk, flagH = 10 * mk, poleTop = f.y - 82 - 13 * mk, poleBot = f.y - 82 + 3;
  const wave = turn && !reduce ? Math.sin(t * 5) * 2.2 : 0;
  ctx.strokeStyle = '#2b2410'; ctx.lineWidth = 1.5 * mk;
  ctx.beginPath(); ctx.moveTo(f.x, poleBot); ctx.lineTo(f.x, poleTop); ctx.stroke();
  ctx.fillStyle = band; ctx.strokeStyle = dark; ctx.lineWidth = 1 * mk;
  ctx.beginPath(); ctx.moveTo(f.x, poleTop);
  ctx.lineTo(f.x + flagW, poleTop + flagH / 2 + wave);
  ctx.lineTo(f.x, poleTop + flagH);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // name and health
  ctx.font = 'bold 12px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
  const label = f.name + ' ' + f.hp;
  const bw = ctx.measureText(label).width;
  // label box tinted with the team colour (dark base so text stays high-contrast) + team outline
  ctx.fillStyle = rgba(mix(band, '#0c0b08', .62), .85);
  ctx.fillRect(f.x - bw / 2 - 3, f.y - 82, bw + 6, 15);
  ctx.strokeStyle = rgba(hexRGB(band), 1); ctx.lineWidth = 1.5;
  ctx.strokeRect(f.x - bw / 2 - 3, f.y - 82, bw + 6, 15);
  ctx.fillStyle = TEAM[f.team].text; ctx.fillText(label, f.x, f.y - 70);
  if (turn) { ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(f.x - 6, f.y - 96 + bob * 2); ctx.lineTo(f.x + 6, f.y - 96 + bob * 2); ctx.lineTo(f.x, f.y - 87 + bob * 2); ctx.fill(); }
}
// ---------- effects: flying dirt and smoke after a blast, sparkles for the teleport ----------
function debris(x, y, r) {
  if (reduce) return;
  for (let i = 0; i < Math.min(26, 8 + r / 2); i++) { const a = -Math.PI * Math.random(), v = 120 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 1, life: .9 + Math.random() * .6, t: 0, s: 2 + Math.random() * 3, c: Math.random() < .3 ? '#6fae4c' : Math.random() < .5 ? '#7a4e33' : '#5c3a26' }); }
  for (let i = 0; i < 6; i++) parts.push({ x: x + (Math.random() - .5) * r, y: y + (Math.random() - .5) * r * .6, vx: (Math.random() - .5) * 30, vy: -20 - Math.random() * 30, g: 0, life: 1.4, t: 0, s: r * .35 + Math.random() * 8, c: 'smoke' });
}
// a frog at 0 HP pops: green bits and a little smoke on top of the normal blast debris
function frogPop(x, y) {
  shake = Math.max(shake, 7); beep(110, .3);
  if (reduce) return;
  for (let i = 0; i < 22; i++) { const a = -Math.PI * Math.random(), v = 90 + Math.random() * 230;
    parts.push({ x, y: y - 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 1, life: .8 + Math.random() * .7, t: 0, s: 3 + Math.random() * 3, c: ['#5fbf4a', '#3e8d34', '#9be37a', '#2f7de1'][i % 4] }); }
}
function sparkle(x, y) { if (reduce) return; for (let i = 0; i < 18; i++) { const a = Math.random() * 7, v = 40 + Math.random() * 120; parts.push({ x, y: y - 25, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: .7, t: 0, s: 2.5, c: '#bdf3ff' }); } }
function drawParts(dt) {
  parts = parts.filter(p => (p.t += dt) < p.life);
  for (const p of parts) {
    p.vy += p.g * G * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = 1 - p.t / p.life;
    if (p.c === 'smoke') { ctx.fillStyle = `rgba(70,70,70,${.35 * k})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.4 - k * .4), 0, 7); ctx.fill(); }
    else { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); ctx.globalAlpha = 1; }
  }
}
function shot(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  if(s.type==='drill'){ctx.rotate(Math.atan2(s.vy,s.vx));ctx.fillStyle='#708454';ctx.fillRect(-10,-4,14,8);ctx.fillStyle='#a8b4ba';ctx.beginPath();ctx.moveTo(4,-5);ctx.lineTo(13,0);ctx.lineTo(4,5);ctx.fill();ctx.restore();return;}
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
  ctx.translate(OX, 0);
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
  for (const f of g.frogs) if (f.alive) frog(pose(f), t);
    else if (f.gone === 'ko') { ctx.fillStyle = '#9aa3a8'; ctx.fillRect(f.x - 6, f.y - 14, 12, 14); ctx.beginPath(); ctx.arc(f.x, f.y - 14, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#555'; ctx.font = 'bold 7px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('RIP', f.x, f.y - 7); }
  for(const m of g.mines) {ctx.drawImage(weaponArt.mine,m.x-10,m.y-13,20,20);if(m.t>1){ctx.fillStyle=Math.sin(t*8)>0?'#ff6b45':'#602d28';ctx.fillRect(m.x-2,m.y-12,4,3);}}
  // rope and jetpack flame of the frog whose turn it is
  for (const f of g.frogs) if (f.alive && f.rope) { ctx.strokeStyle = '#d8b878'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.x, f.y - 30); ctx.lineTo(f.rope.x, f.rope.y); ctx.stroke(); ctx.fillStyle = '#a8b4ba'; ctx.beginPath(); ctx.arc(f.rope.x, f.rope.y, 3.5, 0, 7); ctx.fill(); }
  for (const f of g.frogs) if (f.alive && f.jet) { ctx.fillStyle = '#c95d36'; ctx.fillRect(f.x - f.face * 12 - 4, f.y - 40, 8, 22); if (g.ctl && (g.ctl.y < 0 || g.ctl.x) && g.frogs[g.current] === f) { ctx.fillStyle = Math.random() < .5 ? '#ffc05b' : '#fff1b8'; ctx.beginPath(); ctx.moveTo(f.x - f.face * 12 - 4, f.y - 18); ctx.lineTo(f.x - f.face * 12 + 4, f.y - 18); ctx.lineTo(f.x - f.face * 12, f.y - 4 + Math.random() * 8); ctx.fill(); }
    ctx.fillStyle = '#000a'; ctx.fillRect(f.x - 16, f.y - 76, 32, 4); ctx.fillStyle = '#ffc05b'; ctx.fillRect(f.x - 16, f.y - 76, 32 * Math.max(0, f.jet.fuel) / 3.5, 4); }
  for (const s of g.shots) shot(pose(s));
  drawParts(visualDt);
  for (const b of g.booms) {
    const k = b.t / .5;
    for(let i=0;i<12;i++){const a=i*Math.PI/6,r=b.r*(.6+k*2);ctx.fillStyle=i%2?'#e8b85c':'#674b3e';ctx.fillRect(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r+35*k*k,4*(1-k),4*(1-k));}
    ctx.fillStyle = `rgba(255,${200 - k * 150},40,${1 - k})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (.6 + k * .9), 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (.4 + k * 1.4), 0, 7); ctx.stroke();
  }
  water(t);
  splashes = splashes.filter(s => (s.t += visualDt) < .8);
  for (const s of splashes) { ctx.fillStyle = `rgba(220,240,255,${1 - s.t / .8})`; for (let i = -3; i <= 3; i++) ctx.fillRect(s.x + i * 5, WATER - Math.sin((s.t / .8) * Math.PI) * (20 - Math.abs(i) * 4), 3, 6); }
  ctx.font = 'bold 16px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
  for (const x of g.texts) { ctx.globalAlpha = Math.max(0, 1 - x.t / 1.4); ctx.fillStyle = '#000'; ctx.fillText(x.text, x.x + 1, x.y - x.t * 30 + 1); ctx.fillStyle = x.text[0] === '-' ? '#ff4a4a' : '#fff'; ctx.fillText(x.text, x.x, x.y - x.t * 30); ctx.globalAlpha = 1; }
  // aim: a crosshair for the frog whose turn it is (not shown for the CPU before it decides)
  if (g.phase === 'aim' && (!isCpu(g.team) || cpu?.aiming)) {
    const f = me(g);
    if (g.weapon === 'teleport') {
      ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(aimX, aimY - 25, 16, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#9fe3ff'; ctx.font = 'bold 11px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('TELEPORT HERE', aimX, aimY - 48);
    } else if (g.weapon === 'candles') {
      ctx.strokeStyle = '#e0414c'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(aimX, 0); ctx.lineTo(aimX, WATER); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#e0414c'; ctx.font = 'bold 12px Tahoma'; ctx.fillText('CANDLES DROP HERE', aimX, 18);
    } else {
      const s = ui, ox = f.x, oy = f.y - 32, dx = Math.cos(aim), dy = Math.sin(aim);
      const cx = ox + dx * 52 * s, cy = oy + dy * 52 * s;
      ctx.strokeStyle = '#000a'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.arc(cx, cy, 7 * s, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(cx, cy, 7 * s, 0, 7); ctx.moveTo(cx - 11 * s, cy); ctx.lineTo(cx + 11 * s, cy); ctx.moveTo(cx, cy - 11 * s); ctx.lineTo(cx, cy + 11 * s); ctx.stroke();
      const p = charging ? power : cpu?.charging ? cpu.p : remoteP;
      if (charging || cpu?.charging || remoteP > 0) powerMeter(ox, oy, dx, dy, p, s, t);
    }
  }
  // first seconds of a turn on a phone: how the controls work
  if (touchUI.matches && mine() && g.timer > TURN_TIME - 5 && !charging) {
    const text = 'TAP TO AIM · HOLD FIRE TO SHOOT', size = Math.round(13 * ui);
    ctx.font = `bold ${size}px Tahoma, Verdana, sans-serif`; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + size;
    ctx.globalAlpha = Math.min(1, g.timer - (TURN_TIME - 5)); ctx.fillStyle = '#000b'; ctx.fillRect(W / 2 - w / 2, 8, w, size * 1.8);
    ctx.fillStyle = '#ffe680'; ctx.fillText(text, W / 2, 8 + size * 1.3); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// The charge: a row of beads growing out of the frog along the aim, green to red, with the percentage above.
// Empty beads stay as outlines, so the full length is visible from the first moment.
function powerMeter(ox, oy, dx, dy, p, s, t) {
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const d = (14 + i * 8) * s, r = (2.2 + i * .5) * s, x = ox + dx * d, y = oy + dy * d, on = i / n <= p + 1e-6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    if (on) { ctx.fillStyle = `hsl(${120 - (i / n) * 120} 95% 52%)`; ctx.fill(); ctx.strokeStyle = '#0008'; ctx.lineWidth = 1.5 * s; ctx.stroke(); }
    else { ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.5 * s; ctx.stroke(); }
  }
  if (p >= 1 && !reduce) {   // full power: the last bead pulses
    const d = (14 + n * 8) * s, k = (Math.sin(t * 14) + 1) / 2;
    ctx.strokeStyle = `rgba(255,80,40,${.4 + k * .5})`; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(ox + dx * d, oy + dy * d, (2.2 + n * .5 + 4 + k * 4) * s, 0, 7); ctx.stroke();
  }
  const size = Math.round(15 * s), label = Math.round(p * 100) + '%';
  ctx.font = `bold ${size}px Tahoma, Verdana, sans-serif`; ctx.textAlign = 'center';
  ctx.lineWidth = 4 * s; ctx.strokeStyle = '#000c'; ctx.strokeText(label, ox, oy - 62 - 8 * s);
  ctx.fillStyle = `hsl(${120 - p * 120} 95% 60%)`; ctx.fillText(label, ox, oy - 62 - 8 * s);
}

// ---------- the bar above the field ----------
function hud() {
  for (const t of [0, 1]) {
    const box = $('#hp' + t); box.replaceChildren();
    for (const f of g.frogs.filter(f => f.team === t)) { const i = document.createElement('i'); i.style.width = Math.max(2, f.hp * (innerWidth < 760 ? .22 : .5)) + 'px'; i.title = f.name + ': ' + f.hp;i.style.background=TEAM[t].band; if (!f.alive) i.className = 'dead'; box.append(i); }
  }
  for(const t of [0,1]){$('#name'+t).textContent=TEAM[t].name+(t===1&&isCpu(1)?' (CPU)':isOnline(t)?' (ONLINE)':'');$('#name'+t).style.color=TEAM[t].band;}
  const f = me(g);
  $('#turn').textContent = g.phase === 'over' ? 'Game over' : `${f.name} (${TEAM[g.team].name})`;
  $('#turn').className = 't' + g.team;
  $('#turn').style.color=TEAM[g.team].band;
  $('#timer').textContent = g.phase === 'aim' ? Math.ceil(g.timer) : g.retreat>0?'RUN '+Math.ceil(g.retreat):'·';
  $('#timer').classList.toggle('low', g.phase === 'aim' && g.timer < 6);
  const wi = $('#wind i'); wi.style.width = Math.abs(g.wind) * 50 + '%'; wi.style.marginLeft = g.wind < 0 ? (50 - Math.abs(g.wind) * 50) + '%' : '50%';
  $('#wind').title = 'Wind ' + (g.wind < 0 ? '← ' : g.wind > 0 ? '→ ' : '') + Math.abs(g.wind * 10) + ': it pushes rockets';
  const mine = !paused && g.phase === 'aim' && !isCpu(g.team) && !remoteTurn();
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
  $('#weapon-detail').textContent=(descriptions[g.weapon]||'')+(WEAPONS[g.weapon].utility?' · TURN GOES ON':' · MAX '+WEAPONS[g.weapon].damage+' HP'+(g.weapon==='cluster'||g.weapon==='gold'?' + FRAGMENTS':''));
  // The FIRE button only shows on touch screens: tap the map to aim or pick a spot, then press here.
  const fu=me(g);$('#fire').textContent=g.weapon==='rope'?(fu.rope?'LET GO':'FIRE THE ROPE'):g.weapon==='jetpack'?(fu.jet?'JETPACK OFF':'START JETPACK'):g.weapon==='teleport'?'TELEPORT HERE':g.weapon==='candles'?'DROP CANDLES':g.weapon==='bat'?'SWING THE BAT':g.weapon==='revolver'?'FIRE · '+(2-g.pistolShots)+' LEFT':'HOLD TO FIRE';
  // phones hide the weapon readout, so the arsenal button names the weapon in hand
  $('#arsenal-open').textContent=touchUI.matches?'▲ '+(WEAPONS[g.weapon].short||'Arsenal'):'Arsenal';
  $('#angle-read').textContent=Math.round(-aim*180/Math.PI)+'°';
}

// ---------- turns, events, CPU ----------
function events() {
  for (const e of g.events) {
    if (e.type === 'turn') { closeArsenal();keys.clear();clearCharge();pending=[];remoteP=0;aimPointer=null;held.l=held.r=held.u=0; const f = me(g); cpu = null; aim = f.face > 0 ? -Math.PI / 4 : -3 * Math.PI / 4; aimX = f.x;
      status(isCpu(g.team) ? `${f.name} (${TEAM[g.team].name}, CPU) is thinking…` : isOnline(g.team) ? `${f.name} (${TEAM[g.team].name}) is playing on the other device…` : touchUI.matches ? `${f.name}: tap the map to aim · hold FIRE to shoot · ◀ ▶ walk · ↑ jump, twice for a backflip` : `${f.name}: A/D move · Space jump · Space ×2 backflip · Right click arsenal · Hold left click fire`); }
    if (e.type === 'fire') {closeArsenal();keys.clear();held.l=held.r=0;clearCharge();remoteP=0;status(g.retreat>0?'RETREAT · 3 seconds to find cover!':'Revolver: aim your second shot.');}
    if (e.type === 'boom') {shake=9;beep(65,.35);if(e.r)debris(e.x,e.y,e.r);}
    if (e.type === 'rope') {beep(520,.06);status('Hooked! A/D swing · W/S shorter/longer · Space lets go. Your turn goes on.');}
    if (e.type === 'unrope') status('Let go of the rope.');
    if (e.type === 'jet') {beep(180,.2);status('Jetpack on: W flies up, A/D sideways. Your turn goes on.');}
    if (e.type === 'teleport') {beep(880,.1);sparkle(e.from.x,e.from.y);sparkle(e.to.x,e.to.y);status('Teleported! Your turn goes on.');}
    if (e.type === 'miss') status(g.weapon==='rope'?'Nothing to hook there. Aim at the ground or a cliff.':'No room there. Pick another spot.');
    if (e.type === 'splash' || e.type === 'plop') splashes.push({ x: e.x ?? W / 2, t: 0 });
    if (e.type === 'ko') { status(`${e.name} popped and is out of the war.`); if (e.x !== undefined) frogPop(e.x, e.y); }
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
  $('#again').disabled = !!net && !net.host; $('#again').textContent = net && !net.host ? 'The host starts the rematch' : 'Play again';
}

// ---------- start ----------
// What both devices need to build the same match. Names, colors and characters are only looks.
function menuSetup() {
  return { seed: opts.mapSeed, map: opts.map, perTeam: opts.n,
    names: [0, 1].map(t => $('#team' + t).value.trim().slice(0, 18) || (t ? 'FUD' : 'PEP')),
    colors: [...teamColors], players: teamPlayers.map(list => list.slice()) };
}
// A setup may come from the other device, so every value is checked before use.
function applyLooks(s) {
  for (const t of [0, 1]) {
    const name = typeof s.names?.[t] === 'string' ? s.names[t].trim().slice(0, 18) : '';
    TEAM[t].name = name || (t ? 'FUD' : 'PEP');
    const c = s.colors?.[t];
    if (Number.isInteger(c) && c >= 0 && c < COLORS.length) teamColors[t] = c;
    s.players?.[t]?.slice?.(0, teamPlayers[t].length).forEach((p, i) => { if (Number.isInteger(p) && p >= 0 && p < PLAYERS.length) teamPlayers[t][i] = p; });
  }
  if (teamColors[0] === teamColors[1]) teamColors[1] = (teamColors[0] + 1) % COLORS.length;
  for (const t of [0, 1]) { TEAM[t].band = COLORS[teamColors[t]].hex; TEAM[t].text = '#fff0cc'; }
}
function start() {
  const setup = menuSetup();
  if (net) { net.begin(setup); if (!net.g) menuButton(); return; }   // online: starts when the other tab is there
  seed = setup.seed; applyLooks(setup);
  g = newGame({ seed, map: setup.map, perTeam: setup.perTeam, cpu: [false, opts.mode === 'cpu'], level: opts.level });
  startTurn(g); launch();
}
function launch() {
  paused=false;$('#pause').textContent='Pause';acc=0;pending=[];remoteP=0;clearCharge();held.l=held.r=held.u=0;paintGround();events();hud();
  $('#menu').hidden = true; $('#over').hidden = true; cv.focus({ preventScroll: true });
}
// One step of this device's input: held keys and buttons as bits, plus the queued actions.
function localInput() {
  if(mine()&&arsenal.hidden&&!me(g).rope&&!me(g).jet){const dir=(keys.has("KeyS")||keys.has("ArrowDown")?1:0)-(keys.has("KeyW")||keys.has("ArrowUp")?1:0);aim+=dir*1.5*STEP*(me(g).face||1);}
  if (!movementAllowed()) return { m: 0, a: pending.splice(0) };
  const up = keys.has('KeyW') || keys.has('ArrowUp') || held.u, down = keys.has('KeyS') || keys.has('ArrowDown');
  return { m: (held.l ? KEY.L : 0) | (held.r ? KEY.R : 0) | (up ? KEY.U : 0) | (down ? KEY.D : 0), a: pending.splice(0) };
}
function frame(now) {
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
  visualDt=paused?0:dt;
  if (g && !paused && !['over','menu'].includes(g.phase)) {
    if (charging) { power = Math.min(1, (now - chargeAt) / 1300); $('#power').style.width = power * 100 + '%'; fb.style.setProperty('--charge', power.toFixed(3)); }
    acc += dt;
    while (acc >= STEP) {
      for(const o of [...g.frogs,...g.shots])previousPose.set(o,{x:o.x,y:o.y});
      if (!net) applyInput(g, localInput());
      else if (net.drives()) { net.view = [aim, aimX, aimY, charging ? power : 0]; net.advance(localInput()); }
      else {
        // the other device's turn: replay its steps; catch up when they arrive in a bunch
        const lag = net.backlog();
        if (!net.pump(lag > 12 ? lag - 6 : 1)) acc = STEP;
      }
      acc -= STEP;
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
const mine = () => !paused && g && g.phase === 'aim' && !isCpu(g.team) && !remoteTurn();
const movementAllowed=()=>!paused&&g&&!isCpu(g.team)&&!remoteTurn()&&canMove(g)&&$('#menu').hidden;
const keys=new Set();
const arsenal=document.createElement('div');
arsenal.className='pw-arsenal';arsenal.hidden=true;arsenal.setAttribute('role','dialog');arsenal.setAttribute('aria-label','Choose a weapon');
arsenal.innerHTML='<div class="arsenal-title">ARSENAL <span>1–0 · C R J T · ESC TO CLOSE</span><button type="button" aria-label="Close weapon selection">×</button></div><div class="pw-weapons">'+$('#weapon-options').innerHTML+'</div>';
document.body.append(arsenal);
for(const b of arsenal.querySelectorAll('[data-w]'))b.setAttribute('aria-label',WEAPONS[b.dataset.w].name);
arsenal.addEventListener('focusin',e=>{const b=e.target.closest('[data-w]');if(b)arsenal.querySelector('.arsenal-title span').textContent=WEAPONS[b.dataset.w].name;});
function clearCharge(){charging=false;power=0;$('#power').style.width='0%';$('#fire').style.setProperty('--charge','0');}
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
arsenal.addEventListener('pointerover',e=>{const b=e.target.closest('[data-w]');if(b)arsenal.querySelector('.arsenal-title span').textContent=WEAPONS[b.dataset.w].name;});
arsenal.querySelector('.arsenal-title button').onclick=()=>closeArsenal(true);
// Which kind of pointer was used last: a long press with a finger must not open the arsenal or a browser menu.
let lastPointer = 'mouse', aimPointer = null;
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);
cv.addEventListener('contextmenu',e=>{e.preventDefault();if(lastPointer==='mouse')openArsenal(e.clientX,e.clientY);});
arsenal.addEventListener('contextmenu',e=>{e.preventDefault();closeArsenal(true);});
document.addEventListener('pointerdown',e=>{if(!arsenal.hidden&&!arsenal.contains(e.target)&&e.button===0){closeArsenal(true);e.preventDefault();e.stopPropagation();}},true);
// iPhone: holding a finger down selects text and shows the copy/paste bubble. Only the name fields may select text.
const typing = t => (t?.nodeType === 1 ? t : t?.parentElement)?.closest?.('input,textarea,select');
document.addEventListener('selectstart', e => { if (!typing(e.target)) e.preventDefault(); });
document.addEventListener('contextmenu', e => { if (lastPointer !== 'mouse' && !typing(e.target)) e.preventDefault(); });
const unselect = () => { const s = getSelection?.(); if (s && s.rangeCount && !typing(s.anchorNode)) s.removeAllRanges(); };
// The battlefield and the hold buttons run on pointer events. Cancelling touchstart stops the long-press
// loupe, the callout and double-tap zoom on iOS; pointer events still arrive.
for (const el of [cv, $('#fire'), $('#left'), $('#right'), $('#hop')]) el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); unselect(); }, { passive: false });
function jump(){if(!movementAllowed()||!arsenal.hidden)return;clearCharge();pending.push({t:'jump'});}
function toWorld(e) { const r = cv.getBoundingClientRect(); const scale=Math.min(r.width/VW,r.height/H),padX=(r.width-VW*scale)/2,padY=(r.height-H*scale)/2; return [(e.clientX-r.left-padX)/scale-OX,(e.clientY-r.top-padY)/scale]; }
function aimAt(e) {
  if (!mine()) return;
  const [x, y] = toWorld(e), f = me(g), d = x >= f.x ? 1 : -1;
  aimX = Math.max(30, Math.min(W - 30, x)); aimY = y; aim = Math.atan2(y - (f.y - 32), x - f.x);
  pending = pending.filter(a => a.t !== 'face');
  if (f.face !== d) pending.push({ t: 'face', d });
}
function beginCharge() { if (!mine() || charging || !arsenal.hidden) return; charging = true; chargeAt = performance.now(); power = 0; }
function release(cancelShort) {
  if (!charging) return;
  const heldFor = performance.now() - chargeAt; clearCharge();
  if (!mine()) return;
  if (WEAPONS[g.weapon].utility) { pending.push({ t: 'fire', a: aim, p: 1, x: aimX, y: aimY }); return; }   // rope, jetpack, teleport: a tap is enough
  if (cancelShort && heldFor < 180) return;   // a short click only aims
  pending.push({ t: 'fire', a: aim, p: Math.max(.08, Math.min(1, heldFor / 1300)), x: aimX, y: aimY });
}
// Mouse: move to aim, hold the left button to charge, let go to fire.
// Touch and pen: tap or drag on the battlefield only aims; the FIRE button charges and fires.
// One thumb can hold FIRE while the other finger keeps adjusting the aim.
cv.addEventListener('pointerdown', e => {
  if (e.button) return; e.preventDefault(); unselect(); cv.focus({ preventScroll: true });
  if (e.pointerType === 'mouse') { cv.setPointerCapture(e.pointerId); aimAt(e); beginCharge(); return; }
  if (aimPointer !== null) return;
  aimPointer = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {} aimAt(e);
});
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerId === aimPointer) aimAt(e); });
cv.addEventListener('pointerup', e => { if (e.pointerId === aimPointer) aimPointer = null; else if (e.pointerType === 'mouse') release(true); });
cv.addEventListener('pointercancel', e => { if (e.pointerId === aimPointer) aimPointer = null; else if (e.pointerType === 'mouse') clearCharge(); });
cv.addEventListener('lostpointercapture', e => { if (e.pointerId === aimPointer) aimPointer = null; else if (e.pointerType === 'mouse' && charging) clearCharge(); });
const fb = $('#fire');
bindHold(fb,beginCharge,()=>release(false),clearCharge);
for (const [id, k] of [['#left', 'l'], ['#right', 'r']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); held[k] = 1; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, () => { held[k] = 0; });
}
$('#arsenal-open').onclick=e=>{const r=e.target.getBoundingClientRect();openArsenal(r.left,r.top-250);};
// ↑ reacts on touch-down (a quick second tap is the backflip); hold it to fly up with the jetpack.
// A keyboard "click" on the focused button (detail 0) still jumps.
const hopButton = $('#hop');
hopButton.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); try { hopButton.setPointerCapture(e.pointerId); } catch {} if (g && me(g).jet) held.u = 1; else jump(); });
hopButton.addEventListener('click', e => { if (e.detail === 0) jump(); });
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) hopButton.addEventListener(t, () => { held.u = 0; });
$('#skip').addEventListener('click', () => { if (mine()) { pending.push({ t: 'skip' }); status('Turn skipped.'); } });
function chooseWeapon(w) { if (mine() && !g.pistolShots && g.ammo[g.team][w] !== 0) { clearCharge(); pending.push({ t: 'weapon', w }); closeArsenal(true); } }
document.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => chooseWeapon(b.dataset.w)));
document.addEventListener('keydown', e => {
  if(e.code==='Escape'){closeArsenal(true);return;}
  if (!g || e.target.closest('input,textarea,select') || !$('#menu').hidden || !$('#over').hidden) return;
  const k=e.code;
  if(k==='Enter'){e.preventDefault();if(!e.repeat)beginCharge();return;}
  if(k==='Space'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)jump();return;}
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(k)){
    e.preventDefault();if(movementAllowed()&&arsenal.hidden){keys.add(k);held.l=keys.has('ArrowLeft')||keys.has('KeyA');held.r=keys.has('ArrowRight')||keys.has('KeyD');}
  }else if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(k)){
    e.preventDefault();if(mine()&&arsenal.hidden)keys.add(k);
  }else if((/^Digit[0-9]$/.test(k)||['KeyC','KeyR','KeyJ','KeyT'].includes(k))&&mine()){
    const w={KeyC:'candles',KeyR:'rope',KeyJ:'jetpack',KeyT:'teleport'}[k]||['drill','rocket','bat','grenade','cluster','revolver','bow','gold','mine','dynamite'][Number(k.slice(-1))];
    chooseWeapon(w);
  }
},true);
document.addEventListener('keyup',e=>{if(e.code==='Enter'){e.preventDefault();release(false);}keys.delete(e.code);if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){held.l=keys.has('ArrowLeft')||keys.has('KeyA');held.r=keys.has('ArrowRight')||keys.has('KeyD');}if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();}},true);
// Online the other device keeps playing, so leaving the tab only lets go of the controls.
function pauseGame(){closeArsenal();keys.clear();held.l=held.r=held.u=0;aimPointer=null; if(net){clearCharge();return;} if(!g || ['menu','over'].includes(g.phase))return;paused=true;pending=[];clearCharge();$('#pause').textContent='Resume';status('PAUSED · The pond can wait.');hud();}
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

// ---------- online test between two tabs (groundwork for real online play) ----------
// pondwars-beta.html?net=host in one tab, pondwars-beta.html?net=join in another tab of the same browser.
// Optional &room=name keeps several test pairs apart. Nothing leaves the device: the tabs talk over BroadcastChannel.
function setupNet(host) {
  const room = (new URLSearchParams(location.search).get('room') || 'test').replace(/[^\w-]/g, '').slice(0, 32) || 'test';
  net = new NetMatch(tabTransport(room), { host });
  opts.mode = 'net';
  document.querySelector('[data-mode]').closest('.pw-pick').hidden = true; $('#levels').hidden = true;
  for (const id of ['#pause', '#restart']) $(id).disabled = true;
  net.onstart = (game, setup) => { g = game; applyLooks(setup); launch(); };
  net.onrestore = () => { status('Back in sync with the other tab.'); if (g.phase === 'over') over(); };
  net.onview = v => {
    if (net.drives() || !v.every(Number.isFinite)) return;
    aim = v[0]; aimX = Math.max(30, Math.min(W - 30, v[1])); aimY = v[2]; remoteP = Math.max(0, Math.min(1, v[3]));
  };
  net.onpeer = menuButton;
  net.onproblem = m => { status(m); console.warn('FROGAGEDDON online:', m); };
  if (!host) {
    // the guest plays the host's setup, so its own menu only waits
    for (const s of ['.team-setup', '.player-setup', '.map-setup', '.pw-pick', '.match-rules']) document.querySelectorAll('#menu ' + s).forEach(el => { el.hidden = true; });
    net.join(); const ping = setInterval(() => { if (net.g) clearInterval(ping); else net.join(); }, 1000);
  }
}
let crewReady = false;
function menuButton() {
  const go = $('#go');
  if (!crewReady) { go.disabled = true; go.textContent = 'LOADING THE CREW…'; return; }
  if (net && !net.host) { go.disabled = true; go.textContent = 'WAITING FOR THE HOST TAB…'; return; }
  if (net && !net.peer) { go.disabled = !!net.waiting; go.textContent = net.waiting ? 'WAITING FOR THE ?net=join TAB…' : 'START ONLINE TEST →'; return; }
  go.disabled = false; go.textContent = net ? 'START ONLINE TEST →' : 'START THE WAR →';
}
const netParam = new URLSearchParams(location.search).get('net');
if ((netParam === 'host' || netParam === 'join') && 'BroadcastChannel' in window) setupNet(netParam === 'host');

// ---------- title screen: any key, click or tap continues to the menu ----------
const title = $('#title'), titleArt = $('#title-art');
const noArt = () => title.classList.add('no-art');   // without the picture a painted fireball stays behind the logo
titleArt.addEventListener('error', noArt);
if (titleArt.complete && !titleArt.naturalWidth) noArt();
if (!reduce) for (let i = 0; i < 18; i++) {
  const e = document.createElement('i');
  e.style.left = (3 + Math.random() * 94) + '%';
  e.style.setProperty('--d', (4 + Math.random() * 5).toFixed(2) + 's');
  e.style.setProperty('--w', (Math.random() * 6).toFixed(2) + 's');
  e.style.setProperty('--x', Math.round((Math.random() - .5) * 160) + 'px');
  $('#title-embers').append(e);
}
function leaveTitle(e) {
  if (title.hidden || title.classList.contains('leaving')) return;
  e?.preventDefault(); e?.stopImmediatePropagation();
  title.classList.add('leaving'); beep(70, .5);
  setTimeout(() => { title.hidden = true; ($('#go').disabled ? $('#menu') : $('#go')).focus?.({ preventScroll: true }); }, reduce ? 0 : 450);
}
title.addEventListener('click', leaveTitle);   // click, not pointerdown: the tap must not land on the menu below
window.addEventListener('keydown', e => { if (!title.hidden && !['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) leaveTitle(e); }, true);
title.focus({ preventScroll: true });

// a quiet island behind the menu
g = newGame({ seed: 20261103, perTeam: 3 }); paintGround(); g.phase = 'menu';
requestAnimationFrame(frame);
menuButton();
Promise.all(playerArt.map(img=>img.decode().catch(()=>null))).then(()=>{paintPlayers();crewReady=true;menuButton();});
