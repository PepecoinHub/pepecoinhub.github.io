// POND WARS: the page (drawing, controls, CPU turns). The rules live in pondwars-engine.mjs.
import { W, H, WATER, STEP, WEAPONS, newGame, startTurn, step, fire, walk, hop, skip, cpuPlan, me, aliveOf } from './pondwars-engine.mjs?v=20261103a';

const $ = s => document.querySelector(s);
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();
if (framed || /[?&]embed=1(&|$)/.test(location.search)) document.documentElement.classList.add('embed');

const cv = $('#pw'), ctx = cv.getContext('2d');
const ground = document.createElement('canvas'); ground.width = W; ground.height = H;
const gctx = ground.getContext('2d'), gimg = gctx.createImageData(W, H);
const TEAM = [{ name: 'PEP', band: '#2f7de1', text: '#cfe6ff' }, { name: 'FUD', band: '#e23b3b', text: '#ffd4d4' }];
const FS = 1.6;   // frogs are drawn bigger than their hit point
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let g = null, opts = { mode: 'cpu', level: 1, n: 3 }, seed = 0;
let aim = -Math.PI / 4, aimX = W / 2, charging = false, chargeAt = 0, power = 0, held = { l: 0, r: 0 };
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
    else { const s = (x >> 3 ^ y >> 3) & 1 ? 10 : 0; d[o] = 118 + n + s; d[o + 1] = 82 + n + s; d[o + 2] = 50 + s; }
    d[o + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

// ---------- drawing ----------
function sky(t) {
  const sk = ctx.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#8fd0ff'); sk.addColorStop(.7, '#d8f1ff'); sk.addColorStop(1, '#e9f8ff');
  ctx.fillStyle = sk; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffffcc';
  for (let i = 0; i < 6; i++) { const x = ((i * 233 + t * (6 + i)) % (W + 200)) - 100, y = 50 + (i * 47) % 120; ctx.beginPath(); ctx.ellipse(x, y, 60, 16, 0, 0, 7); ctx.ellipse(x + 34, y - 10, 34, 14, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#a9d8a0';
  ctx.beginPath(); ctx.moveTo(0, 470); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 430 + Math.sin(x * .008 + 1) * 30 + Math.sin(x * .02) * 8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
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
  ctx.fillStyle = '#0003'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 2, 0, 0, 7); ctx.fill();
  ctx.translate(0, bob); ctx.scale(FS, FS);
  ctx.fillStyle = '#3e9b3e'; ctx.beginPath(); ctx.ellipse(0, -7, 8, 7, 0, 0, 7); ctx.fill();           // body
  ctx.fillStyle = '#8fd27d'; ctx.beginPath(); ctx.ellipse(s * 1.5, -5, 4.5, 4, 0, 0, 7); ctx.fill();  // belly
  ctx.fillStyle = '#3e9b3e'; ctx.fillRect(-7, -2, 4, 3); ctx.fillRect(3, -2, 4, 3);                  // feet
  ctx.fillStyle = TEAM[f.team].band; ctx.fillRect(-7, -12, 14, 2.5);                                   // headband
  for (const ex of [-3.2, 3.2]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + s, -15, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex + s + (turn ? Math.cos(aim) * 1.3 : s), -15 + (turn ? Math.sin(aim) * 1.3 : 0), 1.4, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#a5402b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(s * 1.5, -8, 3, .2, 2.9); ctx.stroke();   // mouth
  ctx.restore();
  // name and health
  ctx.font = 'bold 12px Tahoma, Verdana, sans-serif'; ctx.textAlign = 'center';
  const label = f.name + ' ' + f.hp;
  ctx.fillStyle = '#000a'; ctx.fillRect(f.x - ctx.measureText(label).width / 2 - 3, f.y - 50, ctx.measureText(label).width + 6, 14);
  ctx.fillStyle = TEAM[f.team].text; ctx.fillText(label, f.x, f.y - 39);
  if (turn) { ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(f.x - 6, f.y - 64 + bob * 2); ctx.lineTo(f.x + 6, f.y - 64 + bob * 2); ctx.lineTo(f.x, f.y - 56 + bob * 2); ctx.fill(); }
}
function shot(s) {
  ctx.save(); ctx.translate(s.x, s.y);
  if (s.type === 'grenade') {
    ctx.fillStyle = '#2f6b2f'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill(); ctx.fillStyle = '#8fd27d'; ctx.fillRect(-1, -7, 3, 3);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Tahoma'; ctx.textAlign = 'center'; ctx.fillText(String(Math.max(1, Math.ceil(WEAPONS.grenade.fuse - s.t))), 0, -10);
  } else if (s.type === 'rocket') {
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
  for (const f of g.frogs) if (f.alive) frog(f, t);
    else if (f.gone === 'ko') { ctx.fillStyle = '#9aa3a8'; ctx.fillRect(f.x - 6, f.y - 14, 12, 14); ctx.beginPath(); ctx.arc(f.x, f.y - 14, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#555'; ctx.font = 'bold 7px Tahoma'; ctx.textAlign = 'center'; ctx.fillText('RIP', f.x, f.y - 7); }
  for (const s of g.shots) shot(s);
  for (const b of g.booms) {
    const k = b.t / .5;
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
      const cx = f.x + Math.cos(aim) * 52, cy = f.y - 8 + Math.sin(aim) * 52;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.moveTo(cx - 11, cy); ctx.lineTo(cx + 11, cy); ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy + 11); ctx.stroke();
      if (charging || cpu?.charging) {
        const p = cpu?.charging ? cpu.p : power;
        ctx.fillStyle = `hsl(${120 - p * 120} 90% 50%)`;
        for (let i = 1; i <= 10; i++) if (i / 10 <= p) { ctx.beginPath(); ctx.arc(f.x + Math.cos(aim) * (12 + i * 4), f.y - 8 + Math.sin(aim) * (12 + i * 4), 1.5 + i * .25, 0, 7); ctx.fill(); }
      }
    }
  }
  ctx.restore();
}

// ---------- the bar above the field ----------
function hud() {
  for (const t of [0, 1]) {
    const box = $('#hp' + t); box.replaceChildren();
    for (const f of g.frogs.filter(f => f.team === t)) { const i = document.createElement('i'); i.style.width = Math.max(2, f.hp * (innerWidth < 760 ? .22 : .5)) + 'px'; i.title = f.name + ': ' + f.hp; if (!f.alive) i.className = 'dead'; box.append(i); }
  }
  $('#name1').textContent = opts.mode === 'cpu' ? 'FUD (CPU)' : 'FUD';
  const f = me(g);
  $('#turn').textContent = g.phase === 'over' ? 'Game over' : `${f.name} (${TEAM[g.team].name})`;
  $('#turn').className = 't' + g.team;
  $('#timer').textContent = g.phase === 'aim' ? Math.ceil(g.timer) : '·';
  $('#timer').classList.toggle('low', g.phase === 'aim' && g.timer < 6);
  const wi = $('#wind i'); wi.style.width = Math.abs(g.wind) * 50 + '%'; wi.style.marginLeft = g.wind < 0 ? (50 - Math.abs(g.wind) * 50) + '%' : '50%';
  $('#wind').title = 'Wind ' + (g.wind < 0 ? '← ' : g.wind > 0 ? '→ ' : '') + Math.abs(g.wind * 10) + ': it pushes rockets';
  const mine = g.phase === 'aim' && !isCpu(g.team);
  document.querySelectorAll('.pw-controls button').forEach(b => { b.disabled = !mine; });
  document.querySelectorAll('[data-w]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.w === g.weapon)));
  const ammo = g.ammo[g.team].candles; $('#ammo').textContent = '×' + ammo; if (!ammo) $('[data-w="candles"]').disabled = true;
}

// ---------- turns, events, CPU ----------
function events() {
  for (const e of g.events) {
    if (e.type === 'turn') { const f = me(g); cpu = null; aim = f.face > 0 ? -Math.PI / 4 : -3 * Math.PI / 4; aimX = f.x; status(isCpu(g.team) ? `${f.name} (FUD, CPU) is thinking…` : `${f.name}'s turn (${TEAM[g.team].name}). Aim, hold, let go.`); }
    if (e.type === 'boom') shake = 9;
    if (e.type === 'splash' || e.type === 'plop') splashes.push({ x: e.x ?? W / 2, t: 0 });
    if (e.type === 'ko') status(`${e.name} is out of the war. 🐸💤`);
    if (e.type === 'timeout') status('Too slow! The turn goes to the other team.');
    if (e.type === 'over') over();
  }
  g.events.length = 0;
}
function cpuTick(dt) {
  if (!isCpu(g.team) || g.phase !== 'aim') return;
  if (!cpu) cpu = { wait: .9, plan: null };
  cpu.wait -= dt;
  if (cpu.wait > 0) return;
  if (!cpu.plan) { cpu.plan = cpuPlan(g); g.weapon = cpu.plan.weapon; cpu.aiming = true; cpu.from = aim; cpu.t = 0; cpu.wait = 0; return; }
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
  $('#over-title').textContent = w === -1 ? 'Nobody won. The pond won.' : opts.mode === 'cpu' ? (w === 0 ? 'PEP WINS! 🐸' : 'FUD wins this time.') : `${TEAM[w].name} WINS!`;
  $('#over-text').textContent = w === 0 ? 'The island belongs to the frogs with their own chain.' : w === 1 ? 'FUD got lucky. Rematch?' : 'Everybody ended up in the water.';
  $('#over').hidden = false; status('Game over.');
}

// ---------- start ----------
function start() {
  seed = (Math.random() * 4294967295) >>> 0 || 1;
  g = newGame({ seed, perTeam: opts.n, cpu: [false, opts.mode === 'cpu'], level: opts.level });
  paintGround(); startTurn(g); events();
  $('#menu').hidden = true; $('#over').hidden = true; cv.focus({ preventScroll: true });
}
function frame(now) {
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
  if (g && g.phase !== 'over') {
    if (charging) { power = Math.min(1, (now - chargeAt) / 1300); $('#power').style.width = power * 100 + '%'; }
    acc += dt;
    while (acc >= STEP) {
      if (g.phase === 'aim' && !isCpu(g.team)) { if (held.l) walk(g, -1); if (held.r) walk(g, 1); }
      step(g); acc -= STEP;
      for (const r of g.dirty) paintGround(...r); g.dirty.length = 0;
      events();
      if (g.phase === 'over') break;
    }
    cpuTick(dt);
    shake = Math.max(0, shake - dt * 30);
    hud();
  }
  if (g) draw(now / 1000);
  requestAnimationFrame(frame);
}

// ---------- controls ----------
const mine = () => g && g.phase === 'aim' && !isCpu(g.team);
function toWorld(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
function aimAt(e) { if (!mine()) return; const [x, y] = toWorld(e), f = me(g); aimX = Math.max(30, Math.min(W - 30, x)); aim = Math.atan2(y - (f.y - 8), x - f.x); f.face = x >= f.x ? 1 : -1; }
function beginCharge() { if (!mine() || charging) return; charging = true; chargeAt = performance.now(); power = 0; }
function release(cancelShort) {
  if (!charging) return;
  charging = false; const held = performance.now() - chargeAt; $('#power').style.width = '0%';
  if (cancelShort && held < 180) return;   // a short tap only aims
  if (mine()) fire(g, aim, Math.max(.08, power), aimX);
}
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || charging) aimAt(e); });
cv.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); cv.focus({ preventScroll: true }); cv.setPointerCapture(e.pointerId); aimAt(e); beginCharge(); });
cv.addEventListener('pointerup', () => release(true)); cv.addEventListener('pointercancel', () => { charging = false; });
const fb = $('#fire');
fb.addEventListener('pointerdown', e => { e.preventDefault(); fb.setPointerCapture(e.pointerId); beginCharge(); });
fb.addEventListener('pointerup', () => release(false)); fb.addEventListener('pointercancel', () => { charging = false; });
for (const [id, k] of [['#left', 'l'], ['#right', 'r']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); held[k] = 1; });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, () => { held[k] = 0; });
}
$('#hop').addEventListener('click', () => { if (mine()) hop(g); });
$('#skip').addEventListener('click', () => { if (mine()) { skip(g); status('Turn skipped.'); } });
document.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { if (mine() && !(b.dataset.w === 'candles' && !g.ammo[g.team].candles)) g.weapon = b.dataset.w; }));
document.addEventListener('keydown', e => {
  if (!g || e.target.closest('input,textarea')) return;
  const k = e.key;
  if (k === 'ArrowLeft') { held.l = 1; e.preventDefault(); }
  else if (k === 'ArrowRight') { held.r = 1; e.preventDefault(); }
  else if ((k === 'ArrowUp' || k === 'Enter') && !e.repeat) { e.preventDefault(); if (mine()) hop(g); }
  else if (k === 'w' || k === 's') { if (mine()) aim += (k === 'w' ? -1 : 1) * .05 * (me(g).face || 1); }
  else if (k === ' ') { e.preventDefault(); if (!e.repeat) beginCharge(); }
  else if (['1', '2', '3'].includes(k) && mine()) { const w = ['grenade', 'rocket', 'candles'][+k - 1]; if (w !== 'candles' || g.ammo[g.team].candles) g.weapon = w; }
});
document.addEventListener('keyup', e => { if (e.key === 'ArrowLeft') held.l = 0; if (e.key === 'ArrowRight') held.r = 0; if (e.key === ' ') release(false); });
window.addEventListener('blur', () => { held.l = held.r = 0; charging = false; });

// the menu
function pick(sel, key, parse) {
  document.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll(sel).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    opts[key] = parse(b.dataset[key]); $('#levels').hidden = opts.mode !== 'cpu';
  }));
}
pick('[data-mode]', 'mode', String); pick('[data-level]', 'level', Number); pick('[data-n]', 'n', Number);
$('#go').addEventListener('click', start); $('#again').addEventListener('click', start);
$('#tomenu').addEventListener('click', () => { $('#over').hidden = true; $('#menu').hidden = false; });

// a quiet island behind the menu
g = newGame({ seed: 20261103, perTeam: 3 }); paintGround(); g.phase = 'menu';
requestAnimationFrame(frame);
