#!/usr/bin/env node
// PepeGochi art QA: checks a PNG from ChatGPT against the format rules in games/pepegochi/CHATGPT_ART_BACKLOG.md
// before it goes into the game. Plain Node (zlib only), so it also runs in CI.
//
//   node scripts/pepegochi_art_qa.mjs path/to/file.png [more.png ...]        format from the name (tb_* = B, else A)
//   node scripts/pepegochi_art_qa.mjs --format=B --foot=47 tb_new.png        override the format or the foot line
//   node scripts/pepegochi_art_qa.mjs --prop goodbye_letter.png              a prop: no foot-line check
//   node scripts/pepegochi_art_qa.mjs --like=old.png new.png                 a replacement: also compare its place with the old file
//
// Format A (game sprites and room props): 128 x 128, 2 x 2 pixel grid, at most 64 colours, feet on the line y = 124.
// Format B (taskbar companion):           48 x 48, 1 x 1 pixel grid, at most 32 colours, feet on the line y = 47.
// "Feet on the line y = N" means the art stands on that line: its lowest visible row of pixels is y = N - 1.
// Both: RGBA with real transparency (every pixel fully opaque or fully transparent), not empty, no edge touching
// unless the art leaves the frame on purpose (allowEdge).
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORMATS = {
  A: { size: 128, grid: 2, maxColours: 64, foot: 124 },
  B: { size: 48, grid: 1, maxColours: 32, foot: 47 },
};

// ---------- a small PNG decoder: 8-bit greyscale, RGB, palette, grey+alpha or RGBA, not interlaced ----------
export function decodePng(buf) {
  if (buf.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG file');
  let p = 8, ihdr = null, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  const { w, h, depth, ct, interlace } = ihdr;
  if (depth !== 8) throw new Error(`bit depth ${depth}: export as 8-bit RGBA`);
  if (interlace) throw new Error('interlaced PNG: export without interlacing');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!ch) throw new Error('unknown colour type ' + ct);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (ct === 6) out.set(cur.subarray(s, s + 4), o);
      else if (ct === 2) { out.set(cur.subarray(s, s + 3), o); out[o + 3] = 255; }
      else if (ct === 0) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
      else if (ct === 4) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
      else { const k = cur[s]; out[o] = plte[k * 3]; out[o + 1] = plte[k * 3 + 1]; out[o + 2] = plte[k * 3 + 2]; out[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    }
    prev = cur;
  }
  return { width: w, height: h, colourType: ct, rgba: out };
}

// the box of the visible (alpha > 0) pixels, as [left, top, right, bottom] with right/bottom exclusive (like PIL getbbox)
export function bbox({ width, height, rgba }) {
  let l = width, t = height, r = -1, b = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]) {
    if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y;
  }
  return r < 0 ? null : [l, t, r + 1, b + 1];
}

// ---------- the checks ----------
export function formatFor(file) { return /^tb_/.test(basename(file)) ? 'B' : 'A'; }

export function checkImage(img, { format = 'A', foot, prop = false, allowEdge = false } = {}) {
  const F = FORMATS[format], footY = foot ?? F.foot, problems = [], { width: w, height: h, rgba } = img;
  if (w !== F.size || h !== F.size) problems.push(`size ${w} x ${h}, must be ${F.size} x ${F.size}`);
  if (img.colourType !== 6 && img.colourType !== 3 && img.colourType !== 4) problems.push('no alpha channel: export as RGBA with a transparent background');
  let semi = 0, broken = 0, cells = 0;
  const colours = new Set();
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a > 0 && a < 255) semi++;
    if (a === 255) colours.add((rgba[i * 4] << 16) | (rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2]);
  }
  if (semi) problems.push(`${semi} half-transparent pixels: edges must be fully opaque or fully transparent (no anti-aliasing)`);
  if (colours.size > F.maxColours) problems.push(`${colours.size} colours, at most ${F.maxColours}`);
  const g = F.grid;
  if (g > 1) {
    const px = (x, y) => { const o = (y * w + x) * 4; return rgba[o + 3] ? (rgba[o] << 24 | rgba[o + 1] << 16 | rgba[o + 2] << 8 | rgba[o + 3]) >>> 0 : 0; };
    for (let y = 0; y + g <= h; y += g) for (let x = 0; x + g <= w; x += g) {
      cells++;
      const c = px(x, y);
      outer: for (let dy = 0; dy < g; dy++) for (let dx = 0; dx < g; dx++) if (px(x + dx, y + dy) !== c) { broken++; break outer; }
    }
    if (broken) problems.push(`${broken} of ${cells} ${g} x ${g} blocks are not one colour (${(100 * broken / cells).toFixed(1)}%): not on the ${g} x ${g} pixel grid`);
  }
  const box = bbox(img);
  if (!box) problems.push('the image is empty');
  else {
    // the foot line is the bottom edge of the art (as in the game's CSS): the lowest visible row is footY - 1
    if (!prop && box[3] !== footY) problems.push(`the art ends at y = ${box[3]} (lowest row ${box[3] - 1}), the feet must end on the line y = ${footY} (lowest row ${footY - 1})`);
    if (!allowEdge && (box[0] === 0 || box[1] === 0 || box[2] === w)) problems.push('the art touches the left, top or right edge (cut off?)');
  }
  return { ok: problems.length === 0, problems, bbox: box, colours: colours.size, brokenBlocks: broken, semiTransparent: semi };
}

export function checkFile(file, opts = {}) {
  const img = decodePng(readFileSync(file));
  const r = checkImage(img, { format: opts.format || formatFor(file), ...opts });
  if (opts.like && r.bbox) Object.assign(r, compareWith(r.bbox, bbox(decodePng(readFileSync(opts.like))), r.problems));
  return r;
}

// A drop-in replacement must stand where the old picture stood: same foot line, about the same centre and height.
export function compareWith(box, old, problems = []) {
  const centre = b => (b[0] + b[2]) / 2, dx = centre(box) - centre(old), dh = (box[3] - box[1]) - (old[3] - old[1]);
  if (box[3] !== old[3]) problems.push(`stands on y = ${box[3]}, the old picture on y = ${old[3]}`);
  if (Math.abs(dx) > 6) problems.push(`its centre moved ${dx > 0 ? 'right' : 'left'} by ${Math.abs(dx)} px (more than 6)`);
  if (Math.abs(dh) > 8) problems.push(`it is ${Math.abs(dh)} px ${dh > 0 ? 'taller' : 'shorter'} than the old picture (more than 8)`);
  return { ok: problems.length === 0, problems, old, dx, dh };
}

// ---------- command line ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2), files = args.filter(a => !a.startsWith('--'));
  const opt = k => { const a = args.find(x => x.startsWith('--' + k)); return a == null ? undefined : (a.split('=')[1] ?? true); };
  if (!files.length) { console.error('usage: node scripts/pepegochi_art_qa.mjs [--format=A|B] [--foot=N] [--prop] [--allow-edge] file.png ...'); process.exit(2); }
  let bad = 0;
  for (const f of files) {
    let r;
    try {
      r = checkFile(f, { format: opt('format'), foot: opt('foot') != null ? Number(opt('foot')) : undefined, prop: !!opt('prop'), allowEdge: !!opt('allow-edge'), like: opt('like') });
    } catch (e) { r = { ok: false, problems: [e.message] }; }
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${f}${r.bbox ? `  bbox ${r.bbox.join(',')}  colours ${r.colours}` : ''}${r.old ? `  (old bbox ${r.old.join(',')}, centre ${r.dx >= 0 ? '+' : ''}${r.dx}, height ${r.dh >= 0 ? '+' : ''}${r.dh})` : ''}`);
    for (const p of r.problems) console.log('       - ' + p);
  }
  process.exit(bad ? 1 : 0);
}
