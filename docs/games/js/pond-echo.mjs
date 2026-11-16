import { World, LEVEL, HZ, MAX_JUMP, MAX_TICKS, WAVE_SPEED, WAVE_RANGE, quantizeJump, echoWaves, replay, chainOf, encodeRun, decodeRun, cleanNick, MAX_CHAIN } from './pond-echo-sim.mjs';
import { createSound } from './arcade-common.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const DRAG_FULL = 150;                       // world units of drag for a full-power jump
const GHOST_COLORS = ['#bff3ff', '#ffd6f5', '#fff0a8', '#d4ffc4', '#ffd0b0', '#e2d6ff'];
const store = {
  get(k) { try { return localStorage.getItem('pond-echo:' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('pond-echo:' + k, v); } catch {} },
};
const beep = createSound($('sound'));

// ------------------------------------------------------------------ state
let nick = cleanNick(store.get('nick') || '');
$('nick').value = nick === 'fren' ? '' : nick;
$('nick').addEventListener('input', () => { nick = cleanNick($('nick').value); store.set('nick', nick); });

const saved = k => { const c = store.get(k); return c ? decodeRun(c) : null; };
let lastRun = saved('last'), bestRun = saved('best'), friendRun = null;
let tries = Number(store.get('tries')) || 0;
let echoPick = 'off';
let echo = null;             // the run playing next to you
let ghosts = [];             // [{run, frames, color, depth}]
let world, inputs, aim = null, pendingJump = null, finishedAt = -1, session = 'play', replaySrc = null;
let recorder = null;

const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('echo')) {
  friendRun = decodeRun(hash.get('echo'));
  if (friendRun) { echoPick = 'friend'; showIntro(friendRun); }
  else setStatus('That echo link is broken or from another crossing.');
}

function runScore(r) {
  const rp = replay(r);
  if (rp.result?.res === 'win') return 10000 - rp.result.t / HZ;   // wins first, faster is better
  const f = rp.frames.at(-1); return f ? f[0] : 0;                 // otherwise: how far you got
}

// ------------------------------------------------------------------ session
function startRun() {
  echo = echoPick === 'last' ? lastRun : echoPick === 'best' ? bestRun : echoPick === 'friend' ? friendRun : null;
  if (echo && chainOf(echo).length >= MAX_CHAIN) setStatus('This echo is already ' + MAX_CHAIN + ' frogs deep. Your run will not carry more.');
  world = new World(LEVEL, echo ? echoWaves(echo) : []);
  ghosts = echo ? chainOf(echo).map((r, i) => ({ run: r, frames: replay(r).frames, color: GHOST_COLORS[i % GHOST_COLORS.length], depth: i + 1 })) : [];
  inputs = []; aim = null; pendingJump = null; finishedAt = -1; session = 'play'; replaySrc = null;
  tries++; store.set('tries', String(tries)); $('tries').textContent = tries;
  $('result').hidden = true; $('intro').hidden = true;
  $('echo-hud').hidden = !echo;
  if (echo) $('echo-name').textContent = chainOf(echo).map(r => r.n).join(' + ');
  setMode(echo ? 'ECHO: ' + echo.n.toUpperCase() : 'SOLO');
  setStatus(echo ? hintFor(echo) : 'Drag back, let go. The pond remembers.');
  canvas.focus({ preventScroll: true });
}

function startReplay(run, forClip = false) {
  // the run is replayed in a fresh world with its echoes, exactly as it happened
  world = new World(LEVEL, run.p ? echoWaves(run.p) : []);
  ghosts = run.p ? chainOf(run.p).map((r, i) => ({ run: r, frames: replay(r).frames, color: GHOST_COLORS[i % GHOST_COLORS.length], depth: i + 1 })) : [];
  inputs = run.j.slice(); aim = null; pendingJump = null; finishedAt = -1; session = 'replay'; replaySrc = run;
  $('result').hidden = true;
  setMode(forClip ? 'RECORDING' : 'REPLAY');
  setStatus(names(run) + (forClip ? ' · recording clip…' : ' · replay'));
}

const names = run => chainOf(run).map(r => r.n).join(' × ');
function hintFor(run) {
  const rp = replay(run);
  if (rp.result?.res === 'fall') return run.n + ' fell in at ' + (rp.result.t / HZ).toFixed(1) + ' s. Watch where. That splash is yours to use.';
  if (rp.result?.res === 'win') return run.n + ' made it in ' + (rp.result.t / HZ).toFixed(1) + ' s. Jump with them, or after their waves.';
  return run.n + ' is out there. Their waves move your lilies.';
}

function finishRun() {
  const r = world.result;
  const run = { n: nick, j: inputs.map(x => x.slice()), e: r.t, r: r.res, p: echo || null };
  lastRun = run; store.set('last', encodeRun(run));
  if (!bestRun || runScore(run) > runScore(bestRun)) { bestRun = run; store.set('best', encodeRun(run)); }
  syncEchoButtons();
  showResult(run);
}

// ------------------------------------------------------------------ result card
function assistFrom(w) {
  const a = w.assists.at(-1);
  if (!a) return null;
  const nickOf = String(a.src).replace(/^echo\d+:/, '');
  return { nick: nickOf, lily: a.lily };
}

function showResult(run) {
  const r = world.result, secs = (r.t / HZ).toFixed(1);
  const assist = r.res === 'win' ? assistFrom(world) : null;
  const echoFell = echo && replay(echo).result?.res === 'fall';
  $('result-kicker').textContent = r.res === 'win' ? 'MADE IT ACROSS · ' + secs + ' S' : r.res === 'fall' ? 'SPLASH · ' + secs + ' S' : 'TIME UP';
  if (r.res === 'win') {
    $('result-title').textContent = assist ? 'Across, on ' + assist.nick + '’s wave.' : 'Across. Both frogs dry.';
    $('result-text').textContent = assist
      ? (echoFell ? assist.nick + ' never made it. Their splash did.' : 'Their wave moved a lily you landed on.') + ' Send this run back: they will see both of you.'
      : 'Your run is an echo now. Send it to someone and see what they do with your waves.';
  } else if (r.res === 'fall') {
    const far = Math.round(Math.max(0, (world.frog.x - LEVEL.startX) / (LEVEL.finishX - LEVEL.startX)) * 100);
    $('result-title').textContent = far > 70 ? 'So close. The little one is wet.' : 'Splash.';
    $('result-text').textContent = 'You got ' + far + '% of the way. Your fall made the biggest wave in the pond. It is saved as an echo: send it, it might carry someone across.';
  } else {
    $('result-title').textContent = 'The pond got bored.';
    $('result-text').textContent = 'One minute is the limit. Try again, or try with an echo.';
  }
  $('result-assist').hidden = !assist;
  if (assist) $('result-assist').textContent = '🌊 Assist: ' + assist.nick + (echoFell ? ' (fell in, still helped)' : '');
  $('share').textContent = r.res === 'win' && echo ? 'Send our replay 📤' : r.res === 'fall' ? 'Share this fall 📤' : 'Share my echo 📤';
  $('clip').hidden = !canRecord();
  $('share-status').textContent = '';
  $('result').hidden = false;
  $('again').focus({ preventScroll: true });
}

function shareText(run) {
  const rp = replay(run), parents = chainOf(run).slice(1).map(r => r.n);
  if (rp.result?.res === 'win' && parents.length) return '🐸 ' + run.n + ' crossed the pond on ' + parents[0] + '’s wave. Play with our echo:';
  if (rp.result?.res === 'win') return '🐸 I crossed POND ECHO in ' + (rp.result.t / HZ).toFixed(1) + ' s. Can you do it with my echo?';
  return '🌊 I fell in just before the far bank. OK, how do you get across here? My splash is still in the pond:';
}

async function share(run) {
  const url = location.origin + location.pathname + '#echo=' + encodeRun(run);
  const text = shareText(run);
  try {
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { await navigator.share({ title: 'POND ECHO', text, url }); $('share-status').textContent = 'Sent. Now wait for the splash.'; return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); $('share-status').textContent = 'Copied: text + link. Paste it on Discord or the Pond Bulletin.'; }
  catch { $('share-status').textContent = url; }
}

// ------------------------------------------------------------------ clip (canvas → video)
function canRecord() { return typeof MediaRecorder !== 'undefined' && !!canvas.captureStream; }
function clipType() {
  for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}
function recordClip(run) {
  if (!canRecord()) return;
  const type = clipType(), chunks = [];
  try { recorder = new MediaRecorder(canvas.captureStream(60), type ? { mimeType: type, videoBitsPerSecond: 4e6 } : undefined); }
  catch { $('share-status').textContent = 'This browser cannot record clips.'; return; }
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pond-echo-' + names(run).replace(/[^\w-]+/g, '-') + (/mp4/.test(blob.type) ? '.mp4' : '.webm');
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    recorder = null; setStatus('Clip saved. Drop it on Discord with your echo link.');
  };
  startReplay(run, true);
  recorder.start();
}

// ------------------------------------------------------------------ view transform (landscape, or rotated for portrait phones)
let view = { s: 1, ox: 0, oy: 0, rot: false, dpr: 1, cw: 960, ch: 540 };
function layout() {
  const box = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  const cw = Math.max(1, Math.round(box.width)), ch = Math.max(1, Math.round(box.height));
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  const rot = ch > cw * 1.05;
  const ww = rot ? LEVEL.h : LEVEL.w, wh = rot ? LEVEL.w : LEVEL.h;
  const s = Math.min(cw / ww, ch / wh);
  view = { s, rot, dpr, cw, ch, ox: (cw - ww * s) / 2, oy: (ch - wh * s) / 2 };
}
function applyView() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.translate(view.ox, view.oy); ctx.scale(view.s, view.s);
  if (view.rot) { ctx.translate(0, LEVEL.w); ctx.rotate(-Math.PI / 2); }   // world x runs bottom → top
}
function toWorld(px, py) {
  const box = canvas.getBoundingClientRect();
  let x = (px - box.left - view.ox) / view.s, y = (py - box.top - view.oy) / view.s;
  return view.rot ? { x: LEVEL.w - y, y: x } : { x, y };
}
new ResizeObserver(layout).observe(canvas); layout();

// ------------------------------------------------------------------ input
canvas.addEventListener('pointerdown', e => {
  if (session !== 'play' || world.result || e.button > 0) return;
  e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
  const p = toWorld(e.clientX, e.clientY);
  aim = { id: e.pointerId, sx: p.x, sy: p.y, dx: 0, dy: 0, keys: false };
});
canvas.addEventListener('pointermove', e => {
  if (!aim || aim.id !== e.pointerId) return;
  const p = toWorld(e.clientX, e.clientY);
  setAim((aim.sx - p.x) * MAX_JUMP / DRAG_FULL, (aim.sy - p.y) * MAX_JUMP / DRAG_FULL);
});
canvas.addEventListener('pointerup', e => { if (aim && aim.id === e.pointerId) release(); });
canvas.addEventListener('pointercancel', () => { aim = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function setAim(dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d > MAX_JUMP) { dx *= MAX_JUMP / d; dy *= MAX_JUMP / d; }
  aim.dx = dx; aim.dy = dy;
}
function release() {
  const a = aim; aim = null;
  if (!a || Math.hypot(a.dx, a.dy) < 12 || session !== 'play') return;
  pendingJump = quantizeJump(a.dx, a.dy);
}

const keyAim = { ang: 0, pow: 0.75 };
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === 'KeyR') { e.preventDefault(); if (!recorder) startRun(); return; }
  if (session !== 'play' || !world || world.result || !$('help').hidden) return;
  const turn = view.rot ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
  const push = view.rot ? { ArrowUp: 1, ArrowDown: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
  if (e.code in turn || e.code in push || e.code === 'Space' || e.code === 'Enter') e.preventDefault(); else return;
  if (!aim) aim = { id: 'k', sx: 0, sy: 0, dx: 0, dy: 0, keys: true };
  if (e.code in turn) keyAim.ang = Math.max(-1.4, Math.min(1.4, keyAim.ang + turn[e.code] * 0.06));
  if (e.code in push) keyAim.pow = Math.max(0.1, Math.min(1, keyAim.pow + push[e.code] * 0.04));
  setAim(Math.cos(keyAim.ang) * keyAim.pow * MAX_JUMP, Math.sin(keyAim.ang) * keyAim.pow * MAX_JUMP);
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) release();
});

// ------------------------------------------------------------------ loop
let acc = 0, prev = performance.now();
function frame(now) {
  acc += Math.min(250, now - prev); prev = now;
  while (acc >= 1000 / HZ) { acc -= 1000 / HZ; tick(); }
  draw();
  requestAnimationFrame(frame);
if (location.hostname === 'localhost') window.__pondEcho = () => world;   // read-only hook for local browser tests
}
function tick() {
  if (!world) return;
  if (session === 'play') {
    if (pendingJump && world.canJump()) {
      const t = world.tick;
      if (world.jump(pendingJump[0], pendingJump[1])) { inputs.push([t, pendingJump[0], pendingJump[1]]); beep(520, 0.06); }
    }
    pendingJump = null;
  } else {
    while (inputs.length && inputs[0][0] <= world.tick) { const [, dx, dy] = inputs.shift(); world.jump(dx, dy); }
  }
  const mode = world.frog.mode;
  if (world.tick < MAX_TICKS + 3 * HZ) world.step();
  if (mode === 'air' && world.frog.mode === 'lily') beep(300, 0.07, 'triangle');
  if (mode === 'air' && world.frog.mode === 'fell') beep(140, 0.35, 'sawtooth');
  if (mode === 'air' && world.frog.mode === 'won') { beep(660, 0.1); setTimeout(() => beep(880, 0.15), 110); }
  if (world.result && finishedAt < 0) finishedAt = world.tick;
  if (finishedAt >= 0 && world.tick === finishedAt + Math.round(1.1 * HZ)) {
    if (session === 'play') finishRun();
    else { if (recorder) recorder.stop(); else { setMode('REPLAY DONE'); $('result').hidden = false; } session = 'done'; }
  }
  if (session === 'play' || session === 'replay') $('time').firstChild.nodeValue = (Math.min(world.tick, world.result?.t ?? 1e9) / HZ).toFixed(1);
}

// ------------------------------------------------------------------ drawing
const texture = (() => {
  const c = document.createElement('canvas'); c.width = LEVEL.w; c.height = LEVEL.h; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, LEVEL.h); grd.addColorStop(0, '#2a7480'); grd.addColorStop(1, '#1f5f6c');
  g.fillStyle = grd; g.fillRect(0, 0, LEVEL.w, LEVEL.h);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#ffffff10'; for (let i = 0; i < 260; i++) g.fillRect(rnd() * LEVEL.w, rnd() * LEVEL.h, 2 + rnd() * 10, 1.5);
  const bank = (x0, x1, edge) => {
    g.fillStyle = '#6b5a35'; g.fillRect(x0, 0, x1 - x0, LEVEL.h);
    g.fillStyle = '#5e9b48'; g.fillRect(edge < 0 ? x0 : x0 + 10, 0, x1 - x0 - 10, LEVEL.h);
    for (let i = 0; i < 90; i++) { g.fillStyle = rnd() > 0.5 ? '#4c873b' : '#79b45a'; g.fillRect(x0 + 12 + rnd() * (x1 - x0 - 28), rnd() * LEVEL.h, 3, 6 + rnd() * 6); }
    for (let y = 0; y < LEVEL.h; y += 22) { g.fillStyle = '#4b7a3a'; g.fillRect(edge < 0 ? x1 - 10 : x0, y + rnd() * 8, 10, 10); }
  };
  bank(0, LEVEL.startX, -1); bank(LEVEL.finishX, LEVEL.w, 1);
  return c;
})();

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#163f45'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!world) return;
  applyView();
  ctx.drawImage(texture, 0, 0);
  label(LEVEL.startX / 2, 'START');
  label((LEVEL.finishX + LEVEL.w) / 2, 'FAR BANK');
  // rings
  for (const w of world.waves) {
    const r = (world.tick - w.t) * WAVE_SPEED / HZ; if (r <= 0) continue;
    const a = Math.max(0, 1 - r / (WAVE_RANGE + 40)) * Math.min(1, w.s);
    const col = w.src === 'me' ? '255,255,255' : hexRgb(colorOfSrc(w.src));
    ctx.strokeStyle = `rgba(${col},${a * 0.8})`; ctx.lineWidth = 2 + w.s * 1.4;
    ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2); ctx.stroke();
    if (w.s > 2 && r < 60) { ctx.fillStyle = `rgba(${col},${a})`; for (let k = 0; k < 10; k++) { const an = k * 0.628 + w.t; ctx.fillRect(w.x + Math.cos(an) * r * 0.6 - 2, w.y + Math.sin(an) * r * 0.6 - 2, 4, 4); } }
  }
  for (const L of world.lilies) lily(L);
  // reach + aim
  const f = world.frog;
  if (session === 'play' && !world.result && f.mode !== 'air') {
    ctx.setLineDash([3, 7]); ctx.strokeStyle = '#ffffff30'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, MAX_JUMP, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (aim && Math.hypot(aim.dx, aim.dy) >= 12) {
      const tx = f.x + aim.dx, ty = f.y + aim.dy, full = Math.hypot(aim.dx, aim.dy) >= MAX_JUMP - 1;
      ctx.strokeStyle = full ? '#ffcf4a' : '#ffffffcc'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(f.x, f.y);
      const lift = Math.hypot(aim.dx, aim.dy) * 0.3, [ux, uy] = view.rot ? [1, 0] : [0, -1];   // screen-up in world units
      ctx.quadraticCurveTo((f.x + tx) / 2 + ux * lift, (f.y + ty) / 2 + uy * lift, tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx - 5, ty); ctx.lineTo(tx + 5, ty); ctx.moveTo(tx, ty - 5); ctx.lineTo(tx, ty + 5); ctx.stroke();
    }
  }
  // ghosts under the player
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const g = ghosts[i], fr = g.frames[Math.min(world.tick, g.frames.length) - 1];
    if (!fr) { frogSprite(LEVEL.start.x, LEVEL.start.y, 0, 0, g.color, 0.45, g.run.n); continue; }
    if (fr[3] === 'fell') { bubbles(fr[0], fr[1], g.color, world.tick - g.frames.length); tag(fr[0], fr[1], g.run.n + ' 💦', g.color); continue; }
    frogSprite(fr[0], fr[1], fr[2], ghostAngle(g, world.tick), g.color, 0.5, g.run.n);
  }
  if (f.mode === 'fell') bubbles(f.x, f.y, '#ffffff', world.tick - finishedAt);
  else frogSprite(f.x, f.y, f.h, myAngle(), null, 1, null);
  if (session === 'replay' || session === 'done') banner();
}

const angles = new WeakMap();
function myAngle() { const a = world.frog.air || null; if (a) angles.set(world, Math.atan2(a.dy, a.dx)); return angles.get(world) ?? 0; }
function ghostAngle(g, t) {
  const fr = g.frames, i = Math.min(t, fr.length) - 1, j = Math.max(0, i - 3);
  const dx = fr[i][0] - fr[j][0], dy = fr[i][1] - fr[j][1];
  if (Math.abs(dx) + Math.abs(dy) > 2) g.ang = Math.atan2(dy, dx);
  return g.ang ?? 0;
}
function colorOfSrc(src) { const d = Number(/^echo(\d+)/.exec(src)?.[1] || 1); return GHOST_COLORS[(d - 1) % GHOST_COLORS.length]; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); }

function upright(x, y, fn) {         // draw text the right way up even when the world is rotated
  ctx.save(); ctx.translate(x, y); if (view.rot) ctx.rotate(Math.PI / 2); fn(); ctx.restore();
}
function label(x, text) {
  upright(x, view.rot ? LEVEL.h / 2 : LEVEL.h - 16, () => { ctx.fillStyle = '#ffffffb0'; ctx.font = 'bold 12px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText(text, 0, 0); });
}
function tag(x, y, text, color) {
  upright(x, y, () => {
    ctx.font = 'bold 11px Tahoma, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = '#0b2a30cc'; ctx.fillRect(-w / 2, -40, w, 15);
    ctx.fillStyle = color; ctx.fillText(text, 0, -29);
  });
}
function lily(L) {
  const last = L.i === 5;
  ctx.save(); ctx.translate(L.x, L.y);
  ctx.fillStyle = '#0d3b3a55'; ctx.beginPath(); ctx.ellipse(3, 4, L.r, L.r * 0.92, 0, 0, Math.PI * 2); ctx.fill();
  const notch = 0.35 + L.i * 1.7;
  ctx.fillStyle = last ? '#5aa84a' : '#4f9a3c';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L.r, notch + 0.32, notch + Math.PI * 2 - 0.32); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2f6d2b'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#78c25e80'; ctx.lineWidth = 1.2;
  for (let k = 1; k < 6; k++) { const an = notch + k * 1.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * L.r * 0.8, Math.sin(an) * L.r * 0.8); ctx.stroke(); }
  if (last) {   // the last leaf has a flower, so everyone talks about the same leaf
    ctx.translate(-L.r * 0.45, -L.r * 0.4);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = '#ffb3d1'; ctx.beginPath(); ctx.ellipse(Math.cos(k * 1.047) * 5, Math.sin(k * 1.047) * 5, 5, 3, k * 1.047, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function bubbles(x, y, color, age) {
  const a = Math.max(0.15, 1 - age / 90);
  ctx.strokeStyle = color; ctx.globalAlpha = a; ctx.lineWidth = 1.5;
  for (let k = 0; k < 4; k++) { const ph = (age / 12 + k * 0.7) % 3; ctx.beginPath(); ctx.arc(x + Math.sin(k * 2.1) * 9, y + Math.cos(k * 1.7) * 7 - ph * 3, 2 + ph, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
// Top-down pixel Pepe with a little frog riding on his back.
function frogSprite(x, y, h, ang, tint, alpha, name) {
  const lift = h * 34, sc = 1 + h * 0.35;
  ctx.save(); ctx.globalAlpha = alpha * (0.35 + 0.35 * (1 - h));
  ctx.fillStyle = '#062226'; ctx.beginPath(); ctx.ellipse(x + 2, y + 3, 13 * (1 - h * 0.3), 10 * (1 - h * 0.3), 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = alpha;
  const up = view.rot ? [lift, 0] : [0, -lift];
  ctx.translate(x + up[0], y + up[1]); ctx.rotate(ang); ctx.scale(sc, sc);
  const C = tint ? { body: tint, dark: '#4b7f8a', light: '#ffffff', eye: '#0b2a30', baby: '#ffffff', shirt: tint } : { body: '#5fa64f', dark: '#2e6b37', light: '#86c86a', eye: '#132a22', baby: '#9ad97a', shirt: '#4b73bc' };
  const R = (c, a, b, w, hh) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, hh); };
  R(C.dark, -14, -12, 6, 7); R(C.dark, -14, 5, 6, 7);               // back legs
  R(C.dark, 7, -13, 6, 5); R(C.dark, 7, 8, 6, 5);                    // front feet
  R(C.dark, -11, -10, 23, 20); R(C.body, -10, -9, 21, 18);           // body
  R(C.shirt, -10, -6, 9, 12);                                        // blue shirt on the back
  R(C.body, 4, -11, 9, 22); R(C.light, 8, -10, 5, 6); R(C.light, 8, 4, 5, 6);   // head + eyes
  R(C.eye, 10, -8, 2, 3); R(C.eye, 10, 6, 2, 3); R('#b9575a', 12, -3, 1, 6);    // pupils, mouth
  R(C.baby, -8, -4, 7, 8); R(C.dark, -2, -4, 2, 2); R(C.dark, -2, 2, 2, 2);    // the little one
  ctx.restore();
  if (name) tag(x + up[0], y + up[1], name, tint || '#fff');
}
function banner() {
  ctx.save(); ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const text = 'POND ECHO · ' + names(replaySrc || { n: nick });
  ctx.font = 'bold 15px Impact, "Arial Black", sans-serif'; const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = '#081c42dd'; ctx.fillRect(view.cw - w - 12, view.ch - 38, w, 26);
  ctx.fillStyle = '#ffdf72'; ctx.textAlign = 'center'; ctx.fillText(text, view.cw - w / 2 - 12, view.ch - 19);
  ctx.restore();
}

// ------------------------------------------------------------------ UI wiring
function setStatus(t) { $('status').textContent = t; }
function setMode(t) { $('mode').textContent = t; }
function syncEchoButtons() {
  $('echo-last').disabled = !lastRun; $('echo-best').disabled = !bestRun;
  $('echo-friend').hidden = !friendRun; if (friendRun) $('echo-friend').textContent = friendRun.n;
  for (const k of ['off', 'last', 'best', 'friend']) $('echo-' + k).setAttribute('aria-pressed', String(echoPick === k));
}
for (const k of ['off', 'last', 'best', 'friend']) $('echo-' + k).addEventListener('click', () => { echoPick = k; syncEchoButtons(); startRun(); });
$('restart').addEventListener('click', () => !recorder && startRun());
$('again').addEventListener('click', () => startRun());
$('share').addEventListener('click', () => lastRun && share(lastRun));
$('watch').addEventListener('click', () => lastRun && startReplay(lastRun));
$('clip').addEventListener('click', () => lastRun && recordClip(lastRun));
$('help-button').addEventListener('click', () => { $('help').hidden = false; $('help-close').focus(); });
$('help-close').addEventListener('click', () => { $('help').hidden = true; canvas.focus(); });

function showIntro(run) {
  const rp = replay(run), chain = chainOf(run);
  $('intro-title').textContent = rp.result?.res === 'fall' ? run.n + ' fell in. Their splash is still in the pond.' : run.n + ' made it across. Ride their waves.';
  $('intro-text').textContent = (chain.length > 1 ? 'With ' + chain.slice(1).map(r => r.n).join(', ') + '’s echo inside. ' : '') +
    'You will see ' + run.n + ' as a see-through frog next to you. Every wave they make moves your lilies for real.';
  $('intro').hidden = false;
}
$('intro-play').addEventListener('click', () => { echoPick = 'friend'; syncEchoButtons(); startRun(); });
$('intro-solo').addEventListener('click', () => { echoPick = 'off'; syncEchoButtons(); startRun(); });

syncEchoButtons();
tries = Math.max(0, tries - 1);
startRun();
if (friendRun) { $('intro').hidden = false; session = 'intro'; }
requestAnimationFrame(frame);
if (location.hostname === 'localhost') window.__pondEcho = () => world;   // read-only hook for local browser tests
