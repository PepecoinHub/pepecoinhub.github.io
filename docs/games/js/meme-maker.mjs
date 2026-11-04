const $ = (s) => document.querySelector(s);
const canvas = $('#meme');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height, FOOTER = 70, CONTENT = H - FOOTER;
const CREDIT = 'PepecoinHub.com/meme';

const templates = [
  { id: 'chonky', title: 'DIAMOND HANDS', desc: 'bought the dip again', file: 'chonk.webp', top: 'ME: I WILL BUY THE DIP', bottom: 'THE DIP: AGAIN?' },
  { id: 'search', title: 'FROG DETECTIVE', desc: 'the wrong ticker', file: 'pepe-search.webp', top: 'ME CHECKING IF IT IS PEP', bottom: 'AND NOT THE OTHER FROG' },
  { id: 'tired', title: 'ONE MORE CANDLE', desc: 'surely the last one', file: 'tired.webp', top: 'JUST ONE MORE CANDLE', bottom: 'SUDDENLY IT IS 3 AM' },
  { id: 'happy', title: 'GOOD NEWS', desc: 'mildly optimistic', file: 'happy.webp', top: 'MY WALLET IS GREEN', bottom: 'FOR FOUR WHOLE MINUTES' },
  { id: 'wrong', title: 'WRONG PEPE', desc: 'check the chain', file: 'wrongpep.webp', top: 'I BOUGHT PEPECOIN', bottom: 'WHICH ONE?' },
  { id: 'whisper', title: 'POND RUMOURS', desc: 'trust me fren', file: 'whisper.webp', top: 'PSSST', bottom: 'THIS ONE HAS ITS OWN CHAIN' }
];
const jokes = [
  ['ME: I AM HERE FOR THE TECH', 'ALSO ME: FROG PICTURE GOES HARD'],
  ['THE MARKET: BE NORMAL', 'THE POND: ABSOLUTELY NOT'],
  ['CHECKING THE CHART AT WORK', 'THE CHART CHECKING ME BACK'],
  ['MY FINANCIAL ADVISOR', 'IS A DRAWING OF A FROG'],
  ['IT IS NOT A PHASE', 'IT IS A PROOF OF WORK CHAIN'],
  ['ME AFTER ONE GREEN CANDLE', 'I HAVE ALWAYS BELIEVED'],
  ['PEPE? PEP? PEPECOIN?', 'READ THE TICKER, FREN']
];
const images = new Map();
const state = { template: templates[0], image: null, style: 'classic', top: templates[0].top, bottom: templates[0].bottom, size: 72, stamp: 'none', topY: .12, bottomY: .82 };
let imageTicket = 0, jokeIndex = -1, drag = null;
const positions = { classic: [.12, .82], notice: [.35, .67], tabloid: [.32, .74] };
function resetPositions() { [state.topY, state.bottomY] = positions[state.style]; }

document.body.classList.toggle('embed', new URLSearchParams(location.search).has('embed'));

function status(message, error = false) { const el = $('#status'); el.textContent = message; el.classList.toggle('error', error); }
function loadImage(file) {
  if (!images.has(file)) images.set(file, new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Could not load this frog. Try another one.'));
    img.src = '../meme/img/' + file;
  }));
  return images.get(file);
}
function choose(template, resetWords = true) {
  state.template = template;
  if (resetWords) { state.top = template.top; state.bottom = template.bottom; resetPositions(); $('#top-text').value = state.top; $('#bottom-text').value = state.bottom; }
  document.querySelectorAll('.template').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === template.id)));
  state.image = null; $('#download').disabled = true; status('Developing your frog…'); draw();
  const ticket = ++imageTicket;
  loadImage(template.file).then(img => {
    if (ticket !== imageTicket) return;
    state.image = img; $('#download').disabled = false; status('Ready. The internet is not.'); draw();
  }).catch(err => { if (ticket === imageTicket) status(err.message, true); });
}
function paintTemplates() {
  const list = $('#templates');
  for (const t of templates) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'template'; b.dataset.id = t.id;
    b.setAttribute('aria-pressed', String(t === state.template));
    const img = document.createElement('img'); img.src = '../meme/img/' + t.file; img.alt = ''; img.loading = 'lazy';
    const desc = document.createElement('span'), name = document.createElement('strong'), sub = document.createElement('small');
    name.textContent = t.title; sub.textContent = t.desc; desc.append(name, sub); b.append(img, desc);
    b.addEventListener('click', () => choose(t)); list.append(b);
  }
}
function cover(img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight), sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}
function backdrop() {
  if (state.style === 'classic') {
    ctx.fillStyle = '#e4dfcd'; ctx.fillRect(0, 0, W, CONTENT);
    if (state.image) cover(state.image, 0, 0, W, CONTENT);
    const shade = ctx.createLinearGradient(0, 0, 0, CONTENT);
    shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(.23, 'rgba(0,0,0,0)'); shade.addColorStop(.73, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, CONTENT);
  } else if (state.style === 'notice') {
    ctx.fillStyle = '#147777'; ctx.fillRect(0, 0, W, CONTENT);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let y = 0; y < CONTENT; y += 48) for (let x = (y / 48) % 2 ? 22 : 0; x < W; x += 48) ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = '#070d0b'; ctx.fillRect(75, 91, 752, 652);
    ctx.fillStyle = '#fff'; ctx.fillRect(64, 80, 752, 652);
    ctx.fillStyle = '#c5c7c1'; ctx.fillRect(72, 88, 736, 636);
    const bar = ctx.createLinearGradient(78, 0, 790, 0); bar.addColorStop(0, '#0a416b'); bar.addColorStop(1, '#26834c');
    ctx.fillStyle = bar; ctx.fillRect(79, 95, 722, 54);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Tahoma, Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('PONDOS 98  //  SYSTEM MESSAGE', 96, 132);
    ctx.fillStyle = '#fff'; ctx.fillRect(101, 175, 680, 479);
    if (state.image) cover(state.image, 104, 178, 674, 473);
    ctx.strokeStyle = '#545d55'; ctx.lineWidth = 3; ctx.strokeRect(102, 176, 678, 477);
    ctx.fillStyle = '#c4c6bf'; ctx.fillRect(593, 672, 180, 34); ctx.strokeStyle = '#fff'; ctx.strokeRect(594, 673, 178, 32);
    ctx.fillStyle = '#1c2a20'; ctx.textAlign = 'center'; ctx.font = 'bold 19px Tahoma, sans-serif'; ctx.fillText('OK, FREN', 682, 696);
  } else {
    ctx.fillStyle = '#e9dec0'; ctx.fillRect(0, 0, W, CONTENT);
    ctx.fillStyle = '#294634'; ctx.fillRect(31, 28, 838, 110);
    ctx.fillStyle = '#fff0bf'; ctx.textAlign = 'center'; ctx.font = '900 69px Georgia, serif'; ctx.fillText('THE POND TIMES', W / 2, 104);
    ctx.fillStyle = '#c3ab72'; ctx.fillRect(45, 153, 810, 3);
    ctx.fillStyle = '#f9f5e7'; ctx.fillRect(45, 176, 810, 502);
    if (state.image) cover(state.image, 48, 179, 804, 496);
    ctx.strokeStyle = '#81775c'; ctx.lineWidth = 3; ctx.strokeRect(46, 177, 808, 500);
    ctx.fillStyle = '#294634'; ctx.fillRect(45, 696, 810, 89);
    ctx.fillStyle = '#f9eed0'; ctx.font = 'bold 22px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('BREAKING FROM THE POND', 63, 750);
  }
}
function lineBreaks(text, maxWidth) {
  const words = text.replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean), lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (ctx.measureText(candidate).width <= maxWidth) { current = candidate; continue; }
    if (current) { lines.push(current); current = ''; }
    if (ctx.measureText(word).width <= maxWidth) { current = word; continue; }
    let part = '';
    for (const ch of word) { if (ctx.measureText(part + ch).width > maxWidth && part) { lines.push(part); part = ''; } part += ch; }
    current = part;
  }
  if (current) lines.push(current);
  return lines;
}
function caption(text, centerY) {
  if (!text.trim()) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const maxWidth = state.style === 'notice' ? 650 : 800;
  let size = state.size, lines;
  do { ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`; lines = lineBreaks(text, maxWidth); if (lines.length <= 3) break; size -= 2; } while (size >= 34);
  if (lines.length > 3) { lines = lines.slice(0, 3); lines[2] = lines[2].replace(/.{3}$/, '...'); }
  const step = size * 1.05, start = centerY - ((lines.length - 1) * step) / 2;
  lines.forEach((line, i) => {
    const y = start + i * step;
    if (state.style === 'classic') { ctx.strokeStyle = '#151e14'; ctx.lineWidth = Math.max(7, size * .15); ctx.strokeText(line, W / 2, y, maxWidth); ctx.fillStyle = '#fff'; }
    else { ctx.strokeStyle = '#fcf4d7'; ctx.lineWidth = Math.max(5, size * .12); ctx.strokeText(line, W / 2, y, maxWidth); ctx.fillStyle = '#193e29'; }
    ctx.fillText(line, W / 2, y, maxWidth);
  });
  ctx.restore();
}
function sticker() {
  const labels = { dyor: 'DYOR APPROVED', premine: '0% PREMINE', receipts: 'RECEIPTS INSIDE', copium: 'COPIUM FREE' };
  if (!labels[state.stamp]) return;
  ctx.save(); ctx.translate(747, 364); ctx.rotate(.14);
  ctx.fillStyle = '#171e13'; ctx.fillRect(-148, -35, 296, 70);
  ctx.fillStyle = '#f6d35e'; ctx.fillRect(-143, -30, 286, 60);
  ctx.setLineDash([8, 5]); ctx.lineWidth = 3; ctx.strokeStyle = '#4d5632'; ctx.strokeRect(-132, -21, 264, 42);
  ctx.fillStyle = '#263a24'; ctx.font = '900 24px Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(labels[state.stamp], 0, 1, 260);
  ctx.restore();
}
function watermark() {
  ctx.fillStyle = '#123b25'; ctx.fillRect(0, CONTENT, W, FOOTER);
  ctx.fillStyle = '#70c775'; ctx.fillRect(0, CONTENT, W, 5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 31px Tahoma, Arial, sans-serif'; ctx.fillText(CREDIT, W / 2, CONTENT + 37);
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  backdrop();
  caption(state.top, state.topY * CONTENT);
  caption(state.bottom, state.bottomY * CONTENT);
  sticker();
  watermark();
}
function position(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
}
canvas.addEventListener('pointerdown', ev => {
  if (ev.button !== 0) return;
  const p = position(ev); if (p.y >= CONTENT) return;
  const dt = Math.abs(p.y - state.topY * CONTENT), db = Math.abs(p.y - state.bottomY * CONTENT);
  if (Math.min(dt, db) > 135) return;
  drag = dt <= db ? 'topY' : 'bottomY'; canvas.setPointerCapture(ev.pointerId); canvas.classList.add('dragging');
  ev.preventDefault();
});
canvas.addEventListener('pointermove', ev => {
  if (!drag) return;
  state[drag] = Math.max(.09, Math.min(.89, position(ev).y / CONTENT));
  draw();
});
function stopDrag() { drag = null; canvas.classList.remove('dragging'); }
canvas.addEventListener('pointerup', stopDrag); canvas.addEventListener('pointercancel', stopDrag); canvas.addEventListener('lostpointercapture', stopDrag);

for (const [id, key] of [['top-text', 'top'], ['bottom-text', 'bottom']]) $( '#' + id).addEventListener('input', ev => { state[key] = ev.target.value; draw(); });
document.querySelectorAll('[name=style]').forEach(radio => radio.addEventListener('change', () => { if (!radio.checked) return; state.style = radio.value; resetPositions(); draw(); }));
$('#stamp').addEventListener('change', ev => { state.stamp = ev.target.value; draw(); });
$('#font-size').addEventListener('input', ev => { state.size = +ev.target.value; $('#size-value').value = state.size; draw(); });
$('#idea').addEventListener('click', () => {
  jokeIndex = (jokeIndex + 1 + Math.floor(Math.random() * (jokes.length - 1))) % jokes.length;
  [state.top, state.bottom] = jokes[jokeIndex]; $('#top-text').value = state.top; $('#bottom-text').value = state.bottom; draw(); status('Fresh nonsense, freshly printed.');
});
$('#reset').addEventListener('click', () => { state.size = 72; state.stamp = 'none'; state.style = 'classic'; $('#font-size').value = 72; $('#size-value').value = 72; $('#stamp').value = 'none'; document.querySelector('[name=style][value=classic]').checked = true; choose(state.template); });
$('#download').addEventListener('click', () => {
  if (!state.image) return;
  draw(); $('#download').disabled = true; status('Saving the evidence…');
  canvas.toBlob(blob => {
    $('#download').disabled = false;
    if (!blob) { status('PNG export failed. Try again.', true); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `pepecoinhub-meme-${state.template.id}.png`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status('Saved as PNG. Show the pond what you made.');
  }, 'image/png');
});

paintTemplates(); choose(templates[0]);
