import { launch, step, flap, score, obstacles, STEP } from './yeet-engine.mjs';
import { getBackend } from './backend.js';

const $ = s => document.querySelector(s), canvas = $('#game'), ctx = canvas.getContext('2d', { alpha: false });
const W = 960, H = 540, GROUND = 438, SCALE = 6;
ctx.imageSmoothingEnabled = false;
const background = new Image(), frog = new Image(), frogFlap = new Image();
background.src = 'img/yeet/landscape.webp'; frog.src = 'img/yeet/pilot.webp'; frogFlap.src = 'img/yeet/pilot-flap.webp';
let state = null, phase = 'intro', charging = false, chargeStarted = 0, power = 0, camera = 0, paused = false;
let previous = 0, accumulator = 0, soundOn = false, audio = null, trail = [], finishNumber = 0;
let zoom = 1, visualDt = 1 / 60, particles = [], aiming = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let backend = null, account = null, cloudBest = 0, identityEpoch = 0, boardBusy = false, lastBoard = 0;
const storage = { get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} } };
const bestKey = () => account ? `yeet-best-v1:${account.user_id}` : 'yeet-guest-v1';
const pendingKey = () => account ? `yeet-pending-v1:${account.user_id}` : '';
const metres = n => (n / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const jokes = ['Your shift at the burger place starts at 9.', 'NASA has several questions.', 'Gravity remains undefeated.', 'Wen moon? Not today.', 'Your helmet has filed a complaint.', 'Flight control was on a lunch break.'];
function status(s) { $('#status').textContent = s; }
function tone(hz, length = .09, type = 'square', volume = .025) {
  if (!soundOn) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(hz, audio.currentTime);
    gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + length);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + length);
  } catch {}
}
function showBest() { $('#best').replaceChildren(document.createTextNode(metres(Math.max(storage.get(bestKey()), cloudBest))), Object.assign(document.createElement('span'), { textContent: ' m' })); }
function hud() {
  $('#distance').replaceChildren(document.createTextNode(metres(score(state))), Object.assign(document.createElement('span'), { textContent: ' m' }));
  $('#flaps').textContent = Array.from({ length: 3 }, (_, i) => i < (state?.flaps ?? 3) ? '◆' : '◇').join(' ');
  $('#flight-status').textContent = paused ? 'PAUSED' : phase === 'flying' ? `ALT ${Math.round(state.y)} m · ${Math.round(state.vx)} m/s` : phase === 'ended' ? 'BACK ON EARTH' : 'READY FOR TAKEOFF';
}
function reset() {
  finishNumber++; state = null; phase = 'ready'; charging = false; paused = false; accumulator = 0; camera = 0; zoom = 1; trail = []; particles = [];
  $('#announcement').hidden = true; $('#result').hidden = true; $('#paused').hidden = true; $('#speech').textContent = '';
  $('#action').textContent = 'HOLD TO CHARGE'; $('#action').classList.remove('flying'); $('#action').disabled = false; $('#angle').disabled = false;
  $('#power').style.width = '0%'; $('#power-label').textContent = 'READY'; $('#pause').disabled = false;
  $('#pause').textContent = 'Ⅱ'; $('#angle-down').disabled = false; $('#angle-up').disabled = false;
  status('Hold to charge. Release to introduce Pepe to physics.'); hud();
  canvas.focus({ preventScroll: true });
}
function beginCharge() {
  if (paused || !$('#help').hidden) return;
  if (phase === 'intro' || phase === 'ended') reset();
  if (phase === 'flying') { if (flap(state)) { tone(580, .13, 'triangle', .06); hud(); } return; }
  if (charging) return;
  charging = true; chargeStarted = performance.now(); power = 0;
  $('#action').textContent = 'RELEASE TO YEET';
}
function release() {
  if (!charging || paused) return;
  charging = false; state = launch(power, Number($('#angle').value)); phase = 'flying'; trail = []; accumulator = 0;
  $('#action').textContent = 'PANIC FLAP [3]'; $('#action').classList.add('flying'); $('#angle').disabled = true;
  $('#power-label').textContent = `${Math.round(power * 100)}%`; tone(180, .22, 'sawtooth', .04);
  $('#angle-down').disabled = true; $('#angle-up').disabled = true;
  status('Catch a trampoline. Save a flap. Pretend this was planned.');
  burst(0, 0, '#dfc27e', 28);
}
function pause(force) {
  if (phase !== 'flying' || state?.ended) return;
  paused = typeof force === 'boolean' ? force : !paused; accumulator = 0; previous = performance.now();
  $('#paused').hidden = !paused; $('#pause').textContent = paused ? '▶' : 'Ⅱ'; hud();
}
function finish() {
  phase = 'ended'; const n = ++finishNumber, value = score(state), uid = account?.user_id;
  const old = Math.max(storage.get(bestKey()), cloudBest), record = value > old;
  if (record) storage.set(bestKey(), value);
  $('#result').hidden = false; $('#result-title').textContent = record ? 'NEW PERSONAL BEST!' : 'Earth: 1. Pepe: 0.';
  $('#result-score').textContent = `${metres(value)} m`; $('#result-joke').textContent = jokes[Math.floor(value / 17) % jokes.length];
  $('#save-status').textContent = account ? 'Checking your flight report…' : 'Browser record saved. Log in with Discord for cloud records and top 10.';
  $('#action').textContent = 'HOLD TO TRY AGAIN'; $('#action').classList.remove('flying'); $('#angle').disabled = false;
  $('#action').disabled = false;
  $('#angle-down').disabled = false; $('#angle-up').disabled = false;
  $('#speech').textContent = ''; showBest(); hud(); tone(record ? 740 : 130, .25, 'triangle', .05);
  if (uid && record && value > cloudBest) {
    const pending = Math.max(value, storage.get(pendingKey())); storage.set(pendingKey(), pending);
    try { localStorage.setItem(`${pendingKey()}:ms`, String(Math.ceil(state.time * 1000))); } catch {}
    saveRecord(pending, Math.ceil(state.time * 1000), uid, n);
  } else if (account) $('#save-status').textContent = 'Your best distance is already on your Discord account.';
}
function missingMigration(e) { return /PGRST202|could not find the function|does not exist/i.test(`${e?.code || ''} ${e?.message || ''}`); }
async function saveRecord(value, ms, uid, round) {
  try {
    const result = await backend.rpc('gry_yeet_submit', { p_score: value, p_ms: ms, p_version: 1 });
    if (account?.user_id !== uid) return;
    cloudBest = Math.max(cloudBest, result.best || 0); showBest();
    if (result.rate_limited) { if (round === finishNumber) $('#save-status').textContent = 'Record kept on this device. Use Refresh scores in a few seconds to sync.'; return; }
    if (storage.get(pendingKey()) <= cloudBest) storage.set(pendingKey(), 0);
    if (round === finishNumber) $('#save-status').textContent = `Discord record saved: ${metres(cloudBest)} m.`;
    if (result.top) renderBoard(result.top);
  } catch (e) {
    if (account?.user_id === uid && round === finishNumber) $('#save-status').textContent = missingMigration(e)
      ? 'Online records are being prepared. Your record is safe on this device.' : 'Could not sync. Your record stays on this device; Refresh scores retries it.';
  }
}
function renderBoard(rows) {
  const list = $('#leaderboard'); list.replaceChildren();
  if (!rows?.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No flights recorded yet. Be the first fren.'; list.append(li); return; }
  rows.slice(0, 10).forEach((r, i) => {
    const li = document.createElement('li');
    for (const [tag, text] of [['span', String(i + 1).padStart(2, '0')], ['span', r.nick], ['b', `${metres(r.score)} m`]]) {
      const node = document.createElement(tag); node.textContent = text; if (tag === 'span') node.title = text; li.append(node);
    } list.append(li);
  });
}
async function loadBoard(force = false) {
  if (!backend || boardBusy || (!force && Date.now() - lastBoard < 60000)) return;
  boardBusy = true; $('#refresh').disabled = true; const epoch = identityEpoch;
  try {
    const r = await backend.rpc('gry_yeet_state');
    if (epoch !== identityEpoch) return;
    lastBoard = Date.now(); cloudBest = account ? r.best || 0 : 0; renderBoard(r.top); showBest();
    $('#ranking-status').textContent = 'Discord pilots · best distance per player';
    const pending = account && storage.get(pendingKey());
    if (pending > cloudBest) await saveRecord(pending, storage.get(`${pendingKey()}:ms`), account.user_id, finishNumber);
  } catch (e) {
    if (epoch !== identityEpoch) return;
    renderBoard([]); $('#ranking-status').textContent = missingMigration(e) ? 'Online records are being prepared. You can already play.' : 'Record book offline. The game and browser records still work.';
  } finally { boardBusy = false; $('#refresh').disabled = false; }
}
async function identity() {
  const epoch = ++identityEpoch; let me = null;
  try { if (backend.session()) me = await backend.rpc('gry_me'); } catch {}
  if (epoch !== identityEpoch) return;
  account = me?.verified ? me : null; cloudBest = 0;
  $('#account-label').textContent = account ? me.discord_name || me.nick || 'Discord pilot' : 'Guest pilot';
  $('#login').hidden = !!account; $('#logout').hidden = !account; $('#best-label').textContent = account ? 'YOUR DISCORD BEST' : 'BROWSER BEST';
  showBest(); await loadBoard(true);
}
async function initOnline() {
  try { backend = await getBackend();
    if (backend.kind !== 'supabase') { $('#ranking-status').textContent = 'Online scores are available on the live site.'; renderBoard([]); return; }
    await identity();
    backend.sb.auth.onAuthStateChange(event => { if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setTimeout(identity, 0); });
  } catch { renderBoard([]); $('#ranking-status').textContent = 'Online services unavailable. Enjoy a guest flight.'; }
}
// All interactive artwork below is rendered locally; no animation or telemetry goes to the server.
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function text(s, x, y, size = 12, color = '#fff5d2', align = 'center') { ctx.fillStyle = color; ctx.font = `bold ${size}px "Courier New", monospace`; ctx.textAlign = align; ctx.fillText(s, Math.round(x), Math.round(y)); }
function sign(x, y, label, width = 92) {
  rect(x - 3, y, 6, GROUND - y, '#73502e'); rect(x - width / 2 - 3, y - 3, width + 6, 27, '#3b3027'); rect(x - width / 2, y, width, 21, '#f4deb2'); text(label, x, y + 15, 10, '#3c3328');
}
function prop(o, t) {
  const x = o.x * SCALE - camera + 160, y = GROUND;
  ctx.save(); ctx.translate(Math.round(x), y);
  if (o.type === 'trampoline') {
    rect(-30, -17, 5, 21, '#293647'); rect(25, -17, 5, 21, '#293647'); rect(-36, -21, 72, 8, '#572a34'); rect(-33, -24, 66, 6, '#fb6574'); rect(-25, -20, 50, 4, '#26374c');
    for (let i = -22; i < 24; i += 9) rect(i, -14, 3, 6, '#b8c1d1');
    text('BOING', 0, 18, 10, '#f3f2c1');
  } else if (o.type === 'fan') {
    rect(-24, -12, 48, 14, '#4d5d6c'); rect(-6, -48, 12, 37, '#c0ccd1');
    ctx.save(); ctx.translate(0, -63); ctx.rotate(-.3); rect(-30, -30, 60, 60, '#24354a'); rect(-25, -25, 50, 50, '#b7ccd2');
    ctx.rotate(t * 9); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); rect(-5, -22, 13, 21, '#456275'); } rect(-6, -6, 12, 12, '#e8eecb'); ctx.restore();
    for (let i = 0; i < 3; i++) rect(-20 + i * 18, -105 - (t * 40 + i * 11) % 50, 3, 15, '#e6f9e680'); text('HOPIUM', 0, 18, 10, '#f3f2c1');
  } else if (o.type === 'mud') {
    rect(-43, -2, 86, 7, '#56402b'); rect(-35, -1, 70, 4, '#876440'); rect(-18, 0, 10, 2, '#baa174'); text('BAD DECISIONS', 0, 20, 9, '#eddfb6');
  } else {
    rect(-25, -7, 50, 7, '#db6156'); for (const a of [-16, 16]) { rect(a - 5, 0, 10, 9, '#283341'); rect(a - 2, 2, 4, 4, '#e4dcc4'); }
    rect(-19, -28, 37, 20, '#dbaf65'); rect(5, -45, 24, 26, '#e9bf7e'); rect(5, -52, 8, 13, '#a86d3d'); rect(23, -51, 8, 13, '#a86d3d'); rect(24, -36, 12, 10, '#f3dfae'); rect(29, -37, 7, 5, '#212c2b'); rect(19, -40, 3, 4, '#212c2b'); text('MUCH BOOST', 0, 21, 9, '#eddfb6');
  } ctx.restore();
}
function catapult() {
  const x = 155 - camera;
  ctx.save(); ctx.translate(x, GROUND);
  rect(-52, -8, 105, 10, '#67442f'); rect(-46, -15, 94, 8, '#a67642');
  ctx.strokeStyle = '#392c28'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(5, -90); ctx.lineTo(38, -8); ctx.stroke();
  ctx.strokeStyle = '#c39551'; ctx.lineWidth = 8; ctx.stroke();
  const a = Number($('#angle').value) * Math.PI / 180;
  const recoil = state && state.time < .6 ? Math.sin(state.time * 23) * Math.exp(-state.time * 8) * 17 : 0;
  const armX = 5 + Math.cos(a) * (charging ? -35 : 60) + recoil, armY = -47 - Math.sin(a) * (charging ? -30 : 70);
  ctx.strokeStyle = '#62432e'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(5, -47); ctx.lineTo(armX, armY); ctx.stroke();
  rect(armX - 16, armY - 10, 35, 13, '#b7894a'); rect(-30, -47, 56, 4, '#cd5852');
  sign(-45, -37, 'PROBABLY SAFE', 105); ctx.restore();
}
function scenery(t) {
  rect(0, 0, W, H, '#2487cb');
  if (background.complete && background.naturalWidth) {
    const shift = (camera * zoom * .18) % W;
    ctx.drawImage(background, -shift, -25, W, 565); ctx.drawImage(background, W - shift, -25, W, 565);
  }
  // The world zooms around the ground; HUD and scenery remain crisp and stable.
  ctx.save(); ctx.translate(0, GROUND); ctx.scale(zoom, zoom); ctx.translate(0, -GROUND);
  const visibleW = W / zoom;
  rect(0, GROUND, visibleW, 14, '#568b2b'); rect(0, GROUND + 2, visibleW, 3, '#c1d742'); rect(0, GROUND + 14, visibleW, (H - GROUND) / zoom, '#65492e');
  const offset = Math.floor(camera % 48);
  for (let i = -1; i < visibleW / 48 + 2; i++) { const x = i * 48 - offset; rect(x, GROUND - 5, 3, 7, '#95bf38'); rect(x + 17, GROUND - 3, 2, 4, '#d2df51'); rect(x + 8, GROUND + 23, 17, 8, '#93683d'); rect(x + 30, GROUND + 52, 10, 7, '#b89860'); }
  for (const o of obstacles(Math.max(0, (camera - 260) / SCALE), (camera + visibleW) / SCALE)) prop(o, t);
  catapult();
  const marker = Math.floor(Math.max(0, camera) / (100 * SCALE)) * 100;
  for (let m = marker; m < marker + visibleW / SCALE + 200; m += 100) { const x = 160 + m * SCALE - camera; rect(x, GROUND + 26, 2, 17, '#ccb88e'); text(`${m} m`, x, GROUND + 60, 10, '#ead9ae'); }
  ctx.restore();
}
function burst(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .6) * 24, vy: 4 + Math.random() * 19, life: .35 + Math.random() * .35, color });
}
function aimingGuide(t) {
  if (phase !== 'ready') return;
  const angle = Number($('#angle').value), preview = launch(charging ? power : .65, angle);
  ctx.save();
  ctx.strokeStyle = '#fff4b5'; ctx.lineWidth = 3;
  const a = angle * Math.PI / 180;
  ctx.beginPath(); ctx.arc(160, GROUND - 97, 51, -a, 0); ctx.stroke();
  text(`${angle}°`, 205, GROUND - 105, 16, '#fff9ce');
  for (let i = 1; i <= 22; i++) {
    const dt = i * .065, x = 160 + preview.vx * dt * SCALE, y = GROUND - (12 + preview.vy * dt - 4.9 * dt * dt) * SCALE - 25;
    ctx.globalAlpha = (1 - i / 26) * (.7 + .3 * Math.sin(t * 5 - i * .4));
    rect(x, y, i < 8 ? 5 : 3, i < 8 ? 5 : 3, '#fff9bd');
  } ctx.restore();
}
function draw(t) {
  const desiredZoom = state ? Math.min(1, Math.max(.32, 42 / Math.max(42, state.y + 12))) : 1;
  zoom += (desiredZoom - zoom) * (1 - Math.exp(-visualDt * 4));
  const target = state ? Math.max(0, state.x * SCALE + 160 - W * .33 / zoom) : 0;
  camera += (target - camera) * (1 - Math.exp(-visualDt * 11));
  scenery(t);
  aimingGuide(t);
  if (state && trail.length) { ctx.save(); trail.forEach((p, i) => { ctx.globalAlpha = i / trail.length * .7; rect((160 + p.x * SCALE - camera) * zoom, GROUND - p.y * SCALE * zoom - 25, 3, 3, '#fff5cd'); }); ctx.restore(); }
  const x = state ? (160 + state.x * SCALE - camera) * zoom : 162, y = state ? GROUND - state.y * SCALE * zoom - 25 : GROUND - 97;
  const eventAge = state ? state.time - state.eventAt : 10;
  const pulse = state && !state.ended ? Math.max(0, 1 - eventAge / .24) : 0;
  const angle = state ? -Math.atan2(state.vy, Math.max(1, state.vx)) * .85 + (reducedMotion ? 0 : Math.sin(t * 23) * .035) : -Number($('#angle').value) * Math.PI / 180 * .5;
  if (state && !state.ended && !reducedMotion) {
    // Short local velocity streaks read as speed, while the camera follows the frog.
    for (let i = 0; i < 6; i++) { const len = 12 + state.vx * .35; rect(x - 85 - (t * 310 + i * 41) % 135, y - 35 + i * 14, len, 2, '#eff8d473'); }
  }
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.life -= visualDt; p.x += p.vx * visualDt; p.y += p.vy * visualDt; p.vy -= 30 * visualDt; rect((160 + p.x * SCALE - camera) * zoom, GROUND - p.y * SCALE * zoom, 4 * zoom, 4 * zoom, p.color); }
  if (frog.complete && frog.naturalWidth) {
    const spriteScale = Math.max(.78, zoom);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle);
    ctx.scale(spriteScale * (1 + pulse * .3), spriteScale * (state?.ended ? .65 : 1 - pulse * .22));
    const flapping = state && !state.ended && state.time - state.lastFlap < .55 && Math.floor((state.time - state.lastFlap) * 13) % 2 === 0;
    ctx.drawImage(flapping && frogFlap.complete && frogFlap.naturalWidth ? frogFlap : frog, -57, -29, 114, 57); ctx.restore();
  }
  if (phase === 'ready' && !charging) { text('1. AIM YOUR FROG', 635, 225, 21, '#133f4d'); text('Drag here or use the angle controls below.', 635, 250, 11, '#133f4d'); text('2. HOLD TO CHARGE · RELEASE TO YEET', 635, 286, 15, '#133f4d'); }
  if (charging) { text('RELEASE TO YEET!', 635, 240, 24, '#123744'); text(`${Number($('#angle').value)}°  /  ${Math.round(power * 100)}% POWER`, 635, 270, 15, '#133f4d'); }
}
let seenEvent = '';
function updateFlight() {
  step(state);
  if (Math.floor(state.time * 120) % 10 === 0) { trail.push({ x: state.x, y: state.y }); if (trail.length > 45) trail.shift(); }
  const id = `${state.event}:${state.eventAt}`;
  if (id !== seenEvent) {
    seenEvent = id;
    if (['trampoline', 'bounce', 'mud', 'cart'].includes(state.event)) burst(state.x, state.y, state.event === 'mud' ? '#805b34' : '#f8e395');
    if (state.event === 'flap') burst(state.x, state.y, '#efffc7', 13);
    const messages = { trampoline: 'BOING. ALL ACCORDING TO PLAN.', fan: 'HOPIUM LEVELS: CRITICAL.', cart: 'MUCH BOOST. VERY AVIATION.', mud: 'THIS WAS NOT IN THE BROCHURE.', bounce: 'CONTROLLED LANDING. SORT OF.', flap: 'PANIC IS A VALID STRATEGY.' };
    $('#speech').textContent = messages[state.event] || '';
    if (messages[state.event]) tone(state.event === 'mud' ? 95 : 330, .12, 'triangle', .05);
  }
  if (state.time - state.eventAt > 1.7) $('#speech').textContent = '';
  if (state.ended) finish();
}
function frame(now) {
  const elapsed = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now;
  visualDt = elapsed || 1 / 60;
  if (charging && !paused) { power = .08 + .92 * (1 - Math.cos((now - chargeStarted) / 850 * Math.PI)) / 2; $('#power').style.width = `${power * 100}%`; $('#power-label').textContent = `${Math.round(power * 100)}%`; }
  if (phase === 'flying' && !paused) { accumulator += elapsed; while (accumulator >= STEP && phase === 'flying') { updateFlight(); accumulator -= STEP; } hud(); if (phase === 'flying') { $('#action').textContent = `PANIC FLAP [${state.flaps}]`; $('#action').disabled = state.flaps === 0; } }
  if (!paused) draw(now / 1000);
  requestAnimationFrame(frame);
}
$('#start').onclick = () => { reset(); canvas.focus({ preventScroll: true }); };
$('#retry').onclick = reset; $('#new-game').onclick = reset;
$('#action').addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); $('#action').setPointerCapture(e.pointerId); beginCharge(); });
$('#action').addEventListener('pointerup', release); $('#action').addEventListener('pointercancel', () => { charging = false; $('#action').textContent = 'HOLD TO CHARGE'; });
$('#action').addEventListener('keydown', e => { if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) beginCharge(); } });
$('#action').addEventListener('keyup', e => { if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); release(); } });
function setAngle(value) { if (phase === 'flying') return; $('#angle').value = Math.max(20, Math.min(65, Math.round(value))); $('#angle-value').textContent = `${$('#angle').value}°`; }
function aimAt(e) { const r = canvas.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height; setAngle(Math.atan2(Math.max(1, GROUND - 97 - py), Math.max(1, px - 160)) * 180 / Math.PI); }
canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); if (phase === 'flying') { beginCharge(); return; } if (phase === 'intro' || phase === 'ended') reset(); aiming = true; aimAt(e); });
canvas.addEventListener('pointermove', e => { if (aiming) aimAt(e); });
canvas.addEventListener('pointerup', () => { aiming = false; }); canvas.addEventListener('pointercancel', () => { aiming = false; });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || (e.target.closest('button,a') && e.code === 'Space')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) beginCharge(); }
  if (e.code === 'KeyP') { e.preventDefault(); pause(); }
  if (e.code === 'KeyR' && !e.repeat) reset();
  if (['ArrowUp', 'ArrowDown'].includes(e.code) && phase !== 'flying') { e.preventDefault(); setAngle(Number($('#angle').value) + (e.code === 'ArrowUp' ? 1 : -1)); }
  if (e.code === 'Escape') { $('#help').hidden = true; }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { if (charging) e.preventDefault(); release(); } });
window.addEventListener('blur', () => { if (charging) { charging = false; $('#action').textContent = 'HOLD TO CHARGE'; } pause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { charging = false; pause(true); } });
$('#angle').oninput = () => { $('#angle-value').textContent = `${$('#angle').value}°`; };
$('#angle-down').onclick = () => setAngle(Number($('#angle').value) - 5);
$('#angle-up').onclick = () => setAngle(Number($('#angle').value) + 5);
$('#pause').onclick = () => pause(); $('#resume').onclick = () => pause(false);
$('#sound').onclick = () => { soundOn = !soundOn; $('#sound').textContent = `Sound: ${soundOn ? 'on' : 'off'}`; $('#sound').setAttribute('aria-pressed', String(soundOn)); if (soundOn) tone(520); };
$('#help-button').onclick = () => { $('#help').hidden = !$('#help').hidden; if (!$('#help').hidden) { pause(true); $('#help-close').focus(); } };
$('#help-close').onclick = () => { $('#help').hidden = true; $('#help-button').focus(); };
$('#fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.window').requestFullscreen(); } catch { status('Fullscreen unavailable here. Try opening the game in a new tab.'); } };
$('#scores-button').onclick = () => { loadBoard(); $('.records').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
$('#refresh').onclick = () => { if (Date.now() - lastBoard < 10000) { $('#ranking-status').textContent = 'Scores were just refreshed. Try again in a few seconds.'; return; } loadBoard(true); };
$('#login').onclick = async () => { if (!backend || backend.kind !== 'supabase') { status('Discord sign-in is unavailable here. You can still play as a guest.'); return; } pause(true); try { await backend.discord(); } catch { status('Discord sign-in could not open. Please try again.'); } };
$('#logout').onclick = async () => { try { await backend.logout(); await identity(); } catch { status('Could not log out. Please try again.'); } };
$('#share').onclick = async () => { try { await navigator.clipboard.writeText(`YEET THE PEP: ${metres(score(state))} m. ${$('#result-joke').textContent}\nhttps://pepecoinhub.com/games/yeet.html`); status('Flight report copied. Your group chat has been warned.'); } catch { status('Could not copy. Your distance is shown in the flight report.'); } };
showBest(); hud(); initOnline(); requestAnimationFrame(frame);
