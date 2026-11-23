// PepeGochi A12 cards: the postcard a frog sends from a trip and a diary page, drawn on a canvas from the A12c art
// (img/pepegochi/a12/postcard_<place>.png, diary_card.png; 1200 x 675) so the owner can keep or share them as a
// picture. The art leaves the writing areas blank; the text is written here. No network, nothing saved.
import { PLACE, SOUVENIR, postcardText } from '../../meme/pepegochi-trips.mjs?v=20261122life';

export const CARD_W = 1200, CARD_H = 675;
export const A12_IMG = 'img/pepegochi/a12/';
export const CARD_VERSION = '20261122life';   // the art files' cache tag (unchanged)
export const postcardSrc = place => A12_IMG + 'postcard_' + (PLACE[place] ? place : 'unknown') + '.png?v=' + CARD_VERSION;
export const souvenirSrc = id => A12_IMG + (id === 'souv_mini_miner' ? 'souv_mini_miner_01' : id) + '.png?v=' + CARD_VERSION;
export const DIARY_CARD = A12_IMG + 'diary_card.png?v=' + CARD_VERSION;

// Where the art leaves room for writing, in card pixels (measured on the A12c files).
export const POSTCARD = { textX: 770, textW: 380, titleY: 270, lineY: [308, 389, 470, 551], stamp: { x: 1056, y: 51, w: 96, h: 123 } };
// The "???" postcard has an empty dark band across its static: the numbers come through there, like on the TV at 3 AM.
export const SIGNAL = { text: '0098', x: 3, y: 300, w: 714, h: 68 };
// writing starts right of the red margin (x 141-143) and stays left of the second one (x 834)
export const DIARY = { x: 160, y: 120, w: 650, lineH: 46, maxLines: 10 };
// the frog doodle in the corner of diary_card.png: drawn in clear greens so it shows (owner, 2026-11-23)
export const DIARY_FROG = { x: 940, y: 340, w: 160, h: 220, dark: [34, 62, 30], light: [92, 150, 64] };

// Recolours the faint olive doodle pixels (not the paper, not the grid) from dark to light green. Pure on RGBA data.
export function inkFrog(data) {
  const { dark, light } = DIARY_FROG;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r + g + b >= 540 || r - b < 18) continue;
    const k = Math.min(1, Math.max(0, ((r + g + b) / 3 - 90) / 100));
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(dark[c] * (1 - k) + light[c] * k);
  }
  return data;
}

// Splits text into lines that fit a width (measure(text) -> px). Long words are cut. Pure, for tests.
export function wrap(text, width, measure, maxLines = 99) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (measure(w) > width && w.length > 1) {      // a word longer than the line: cut it
        let n = w.length - 1; while (n > 1 && measure(w.slice(0, n)) > width) n--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, n)); w = w.slice(n);
      }
      const next = line ? line + ' ' + w : w;
      if (measure(next) <= width) line = next; else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/.{0,3}$/, '...'); }
  return out;
}

// What a postcard says, line by line, for the 4 writing lines (pure).
export function postcardLines(place, souvenir, measure, name = '') {
  const pc = postcardText(place, souvenir);
  if (!pc) return null;
  // the p.s. goes when the place's text needs every line (the souvenir is in the stamp box anyway)
  let body = wrap(pc.lines.join(' '), POSTCARD.textW, measure);
  if (body.length > POSTCARD.lineY.length) body = wrap(pc.lines[0], POSTCARD.textW, measure, POSTCARD.lineY.length);
  if (name && body.length < POSTCARD.lineY.length) body.push('- ' + name);
  return { title: pc.title, lines: body };
}

const loadImage = (doc, src) => new Promise((resolve, reject) => {
  const im = new (doc.defaultView || globalThis).Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('Image ' + src)); im.src = src;
});
const pen = (ctx, size, color = '#2b2118') => { ctx.font = `${size}px "Courier New", monospace`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; };

// The postcard as a canvas (resolves when the art is loaded).
export async function drawPostcard(doc, { place, souvenir = null, name = '' }) {
  const canvas = doc.createElement('canvas'); canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(await loadImage(doc, postcardSrc(place)), 0, 0, CARD_W, CARD_H);
  // the souvenir sits in the stamp box like a stamp
  if (souvenir && SOUVENIR[souvenir]) {
    try {
      const s = POSTCARD.stamp, im = await loadImage(doc, souvenirSrc(souvenir)), side = Math.min(s.w, s.h) - 16;
      ctx.drawImage(im, s.x + (s.w - side) / 2, s.y + (s.h - side) / 2, side, side);
    } catch {}
  }
  if (PLACE[place]?.secret) {
    ctx.font = `bold ${SIGNAL.h - 18}px "Courier New", monospace`; ctx.fillStyle = '#7ee07e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SIGNAL.text, SIGNAL.x + SIGNAL.w / 2, SIGNAL.y + SIGNAL.h / 2 + 2);
    ctx.textAlign = 'start';
  }
  pen(ctx, 24);
  const card = postcardLines(place, souvenir, t => ctx.measureText(t).width, name);
  if (card) {
    pen(ctx, 28, '#0c5a2c');
    const title = wrap(card.title, POSTCARD.textW, t => ctx.measureText(t).width, 3);
    title.forEach((line, i) => ctx.fillText(line, POSTCARD.textX, POSTCARD.titleY - (title.length - 1 - i) * 34));
    pen(ctx, 24);
    card.lines.forEach((line, i) => ctx.fillText(line, POSTCARD.textX, POSTCARD.lineY[i] - 10));
  }
  return canvas;
}

// One diary page as a canvas.
export async function drawDiaryPage(doc, { text, day }) {
  const canvas = doc.createElement('canvas'); canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(await loadImage(doc, DIARY_CARD), 0, 0, CARD_W, CARD_H);
  try {
    const f = DIARY_FROG, px = ctx.getImageData(f.x, f.y, f.w, f.h);
    inkFrog(px.data); ctx.putImageData(px, f.x, f.y);
  } catch {}
  pen(ctx, 30, '#0c5a2c'); ctx.fillText('Day ' + day, DIARY.x, DIARY.y - 40);
  pen(ctx, 34);
  wrap(text, DIARY.w, t => ctx.measureText(t).width, DIARY.maxLines).forEach((line, i) => ctx.fillText(line, DIARY.x, DIARY.y + 20 + i * DIARY.lineH));
  return canvas;
}

// Saves a canvas as a PNG file (data URL: the page's CSP allows img data: and no blob:).
export function saveCanvas(doc, canvas, filename) {
  const a = doc.createElement('a'); a.download = filename; a.href = canvas.toDataURL('image/png');
  doc.body.append(a); a.click(); a.remove();
}
