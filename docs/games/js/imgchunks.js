// Guess the Picture: the full-quality picture travels over Realtime in pieces.
// • fitImage(): pictures up to 1 MB are sent exactly as they are; bigger ones are resized (long edge ≤ 1600 px)
//   and re-encoded (WebP, or JPEG where WebP is not supported) with a quality step-down until they fit in 1 MB.
// • pack(): the bytes are encrypted (AES-GCM, fresh key per picture) and cut into ~150 KB pieces, so every Realtime
//   message stays well under the 256 KB broadcast limit. Pieces are sent slowly DURING the turn; the key is sent only
//   when the answer is revealed, so nobody can peek early and the reveal is instant.
// • Receiver: puts the pieces back together (picture id, piece count, SHA-256 of the original bytes) and asks the host
//   again for missing pieces (timeout + a few retries).
export const MAX_BYTES = 1024 * 1024;
export const CHUNK = 150000;          // characters of base64 per message (+ ~200 B of JSON) → < 200 KB
const MAX_EDGE = 1600, QUALITIES = [0.92, 0.86, 0.8, 0.72, 0.64, 0.56, 0.48];

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const canChunk = () => !!(globalThis.crypto && crypto.subtle);

function loadBitmap(blob) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Could not load the picture')); }; i.src = u; });
}
const toBlob = (c, type, q) => new Promise((res) => c.toBlob((b) => res(b), type, q));
let webpOk = null;
async function bestType() {
  if (webpOk === null) { const c = document.createElement('canvas'); c.width = c.height = 2; const b = await toBlob(c, 'image/webp', 0.8); webpOk = !!b && b.type === 'image/webp'; }
  return webpOk ? 'image/webp' : 'image/jpeg';
}
// Returns the original if it is a picture of ≤ 1 MB, otherwise a compressed copy of ≤ 1 MB (or the original if it cannot be decoded).
export async function fitImage(blob, max = MAX_BYTES) {
  if (blob.size <= max && /^image\//.test(blob.type || 'image/')) return blob;
  let im; try { im = await loadBitmap(blob); } catch { return blob; }
  const type = await bestType();
  let edge = Math.min(MAX_EDGE, Math.max(im.naturalWidth, im.naturalHeight)), best = null;
  while (edge >= 320) {
    const k = edge / Math.max(im.naturalWidth, im.naturalHeight);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    for (const q of QUALITIES) { const b = await toBlob(c, type, q); if (b) { best = b; if (b.size <= max) return b; } }
    edge = Math.round(edge * 0.8);
  }
  return best || blob;
}

// Host: encrypt + split. Returns { meta, parts, key } — meta goes with every piece, key only at the reveal.
export async function pack(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const sha = hex(await crypto.subtle.digest('SHA-256', bytes));
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes)));
  const n = Math.max(1, Math.ceil(enc.length / CHUNK)), parts = [];
  for (let i = 0; i < n; i++) parts.push(enc.slice(i * CHUNK, (i + 1) * CHUNK));
  const tid = 'p' + hex(crypto.getRandomValues(new Uint8Array(8)));
  return { meta: { tid, cn: n, sha, mime: blob.type || 'image/jpeg', size: bytes.length }, parts,
           key: { tid, key: b64(new Uint8Array(await crypto.subtle.exportKey('raw', k))), iv: b64(iv) } };
}

// Host: paced sender. Sends one piece every `gap()` ms (keeps the project under the Realtime messages/second limit:
// every broadcast counts once per receiver). want() queues piece numbers (deduplicated).
export function makeSender(send, gap) {
  let pk = null, q = [], timer = null;
  const pump = () => {
    timer = null; if (!pk || !q.length) return;
    const i = q.shift(); send('imgc', { ...pk.meta, i, d: pk.parts[i] });
    if (q.length) timer = setTimeout(pump, gap());
  };
  return {
    set(p) { pk = p; q = []; clearTimeout(timer); timer = null; },
    get tid() { return pk?.meta.tid || null; },
    want(list) { if (!pk) return; for (const i of list) if (i >= 0 && i < pk.parts.length && !q.includes(i)) q.push(i); if (!timer) timer = setTimeout(pump, 0); },
    all() { if (pk) this.want(pk.parts.map((_, i) => i)); },
    stop() { clearTimeout(timer); timer = null; q = []; },
  };
}

// Player: collects pieces; when the key arrives and everything is there → decrypt, check SHA-256, give back a blob URL.
// need(tid, missing) is called after a timeout for pieces that did not arrive (up to `tries` times).
export function makeReceiver(need, { wait = 1500, retry = 3000, tries = 5 } = {}) {
  let cur = null; // { tid, cn, sha, mime, parts: [], key, iv, tries, timer, done, onDone }
  const fresh = (tid) => { if (!cur || cur.tid !== tid) { if (cur) clearTimeout(cur.timer); cur = { tid, parts: [], tries: 0, timer: null, done: false }; } return cur; };
  const missing = (c) => { const m = []; for (let i = 0; i < (c.cn || 0); i++) if (c.parts[i] == null) m.push(i); return m; };
  async function finish(c) {
    if (c.done || !c.key || !c.cn || missing(c).length) return;
    c.done = true; clearTimeout(c.timer);
    try {
      const k = await crypto.subtle.importKey('raw', unb64(c.key), 'AES-GCM', false, ['decrypt']);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(c.iv) }, k, unb64(c.parts.join(''))));
      if (hex(await crypto.subtle.digest('SHA-256', plain)) !== c.sha) throw new Error('hash mismatch');
      c.onDone?.(URL.createObjectURL(new Blob([plain], { type: c.mime })));
    } catch (e) {
      console.warn('[img] picture check failed, asking again', e); c.done = false; c.parts = []; schedule(c, 0);
    }
  }
  function schedule(c, ms) {
    clearTimeout(c.timer);
    c.timer = setTimeout(() => {
      if (c !== cur || c.done) return;
      const m = missing(c); if (!m.length) return finish(c);
      if (c.tries++ >= tries) return console.warn('[img] gave up waiting for', m.length, 'pieces');
      Promise.resolve(need(c.tid, m.slice(0, 64))).catch(() => {});
      schedule(c, retry);
    }, ms);
  }
  return {
    piece(p) {
      if (!p || typeof p.tid !== 'string' || typeof p.d !== 'string' || !(p.i >= 0 && p.i < p.cn && p.cn <= 64)) return;
      const c = fresh(p.tid); Object.assign(c, { cn: p.cn, sha: p.sha, mime: /^image\/[a-z+.-]+$/.test(p.mime) ? p.mime : 'image/jpeg' });
      c.parts[p.i] = p.d; finish(c);
    },
    // key message: { tid, key, iv, cn, sha, mime }; onDone(url) is called once the picture is complete and verified
    key(p, onDone) {
      if (!p || typeof p.tid !== 'string') return;
      const c = fresh(p.tid); Object.assign(c, { key: p.key, iv: p.iv, cn: c.cn || p.cn, sha: c.sha || p.sha, mime: c.mime || p.mime, onDone });
      if (c.done) return; if (missing(c).length) schedule(c, wait); else finish(c);
    },
    reset() { if (cur) clearTimeout(cur.timer); cur = null; },
    get state() { return cur && { tid: cur.tid, have: cur.parts.filter((x) => x != null).length, cn: cur.cn, done: cur.done }; },
  };
}
