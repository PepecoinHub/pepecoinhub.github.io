// Local preview of the A12 "life of its own" logic (docs/games/pepegochi-life.html). Fake clock, nothing saved.
import { createDiary, isSnoopHour, SNOOP_LINE } from '../../meme/pepegochi-diary.mjs?v=20261122life';
import { rareOfDay, localDay } from '../../meme/pepegochi-rare.mjs?v=20261121a12';
import { rollTrip, postcardText, tripForDiary, SOUVENIR, LENGTHS, formatLeft } from '../../meme/pepegochi-trips.mjs?v=20261122life';

const $ = id => document.getElementById(id);
const OWNER = 'preview-fren', LIFE = 'preview-life';
const mem = new Map();
const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
let now = Date.parse('2026-11-21T19:00:00');
const adoptedAt = now - 23 * 86400000;
const diary = createDiary({ storage, now: () => now });
let trip = null, pendingTrip = null, lastRare = null;
const ICON = { big_pond: '🌊', forgotten_coins_swamp: '🪙', scrypt_mine: '⛏️', lily_hills: '🪷', duck_city: '🦆', exchange: '📈',
  old_internet: '💾', krakow_dragon: '🐉', moon: '🌕', unknown: '📡' };

function dateParts() {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec($('pgl-date').value.trim());
  const d = new Date(now);
  return m ? { month: +m[1], day: +m[2], weekday: d.getDay() } : { month: d.getMonth() + 1, day: d.getDate(), weekday: d.getDay() };
}
function ctx() {
  const date = dateParts(), local = localDay(now);
  const rare = rareOfDay({ owner: OWNER, lifeId: LIFE, dayKey: local.dayKey, month: date.month, day: date.day, hour: local.hour, ath: $('pgl-ath').checked });
  lastRare = rare;
  return { adoptedAt, fren: 'fren', date, rare: rare === 'birthday' ? null : rare,
    market: { change24h: Number($('pgl-change').value), ath: $('pgl-ath').checked },
    chain: { height: 2_418_000 + Math.floor((now - adoptedAt) / 60000), hashChange: 0 },
    needs: { hunger: Number($('pgl-hunger').value), hygiene: 90, mood: 90, energy: 90 },
    trip: pendingTrip };
}
function renderDiary(fresh = []) {
  const box = $('pgl-diary'); box.replaceChildren();
  const pages = diary.pages().slice().reverse();
  if (isSnoopHour(new Date(now).getHours())) { const p = document.createElement('p'); p.className = 'pgl-page'; p.textContent = SNOOP_LINE; box.append(p); }
  if (!pages.length) { const p = document.createElement('p'); p.className = 'pgl-empty'; p.textContent = 'Empty. Come back later.'; box.append(p); }
  const freshIds = new Set(fresh.map(f => f.id + f.at));
  for (const pg of pages.slice(0, 12)) {
    const p = document.createElement('p'); p.className = 'pgl-page' + (freshIds.has(pg.id + pg.at) ? ' is-new' : '');
    const b = document.createElement('b'); b.textContent = 'Day ' + pg.day + '. '; p.append(b, pg.text);
    if (freshIds.has(pg.id + pg.at)) { const n = document.createElement('span'); n.className = 'pgl-new'; n.textContent = 'NEW'; p.append(n); }
    box.append(p);
  }
  $('pgl-now').textContent = 'Fake clock: ' + new Date(now).toLocaleString('en-GB') + (lastRare ? ' · rare event today: ' + lastRare : '');
}
function renderTrip() {
  const s = $('pgl-trip-status');
  if (!trip) { s.textContent = 'The frog is home.'; $('pgl-back').disabled = true; $('pgl-go').disabled = false; return; }
  const left = trip.returnAt - now;
  if (left > 0) { s.textContent = 'Away on a ' + LENGTHS[trip.length].label.toLowerCase() + '. Back in ' + formatLeft(left) + '. The room is empty: "gone exploring, feed the duck. jk don\'t".';
    $('pgl-back').disabled = false; $('pgl-go').disabled = true; return; }
  // back: open the postcard
  const card = postcardText(trip.place, trip.souvenir), out = $('pgl-postcard');
  out.replaceChildren();
  const el = document.createElement('div'); el.className = 'pgl-card';
  const pic = document.createElement('div'); pic.className = 'pgl-card-pic';
  const ic = document.createElement('span'); ic.textContent = ICON[trip.place] || '✉️';
  pic.append(ic, 'postcard_' + trip.place + '.png');
  const tx = document.createElement('div'); tx.className = 'pgl-card-text';
  const st = document.createElement('div'); st.className = 'pgl-stamp'; st.textContent = 'PEP';
  const h = document.createElement('h3'); h.textContent = card.title;
  tx.append(st, h, ...card.lines.map(l => { const p = document.createElement('p'); p.textContent = l; return p; }));
  if (trip.souvenir) { const s2 = SOUVENIR[trip.souvenir], d = document.createElement('div'); d.className = 'pgl-souv';
    const r = document.createElement('span'); r.className = 'pgl-rarity'; r.textContent = s2.rarity + ' · ';
    d.append(r, s2.name + ': "' + s2.text + '"'); tx.append(d); }
  el.append(pic, tx); out.append(el);
  pendingTrip = tripForDiary(trip.place, trip.souvenir);
  trip = null; s.textContent = 'Back home! The postcard is below; the diary will tell about it.';
  $('pgl-back').disabled = true; $('pgl-go').disabled = false;
  const fresh = diary.visit(OWNER, LIFE, ctx()); pendingTrip = null; renderDiary(fresh);
}
function renderRare() {
  const list = $('pgl-rare'); list.replaceChildren();
  for (let i = 0; i < 365; i++) {
    const d = localDay(now + i * 86400000);
    const id = rareOfDay({ owner: OWNER, lifeId: LIFE, dayKey: d.dayKey, month: d.month, day: d.day, hour: 23, ath: false });
    if (id) { const li = document.createElement('li'); li.textContent = d.dayKey + ' · ' + id; list.append(li); }
  }
}
$('pgl-away').addEventListener('click', e => {
  const b = e.target.closest('button[data-h]'); if (!b) return;
  now += Number(b.dataset.h) * 3600000;
  const fresh = diary.visit(OWNER, LIFE, ctx()); renderDiary(fresh); renderTrip();
});
$('pgl-go').addEventListener('click', () => {
  const length = $('pgl-length').value, pack = $('pgl-pack').value || null;
  const r = rollTrip(length, pack);
  trip = { length, pack, ...r, returnAt: now + r.hours * 3600000 }; $('pgl-postcard').replaceChildren(); renderTrip();
});
$('pgl-back').addEventListener('click', () => { if (trip) { now = trip.returnAt; renderTrip(); } });
diary.visit(OWNER, LIFE, ctx());
renderDiary(diary.pages()); renderTrip(); renderRare();
