// Web Push with nothing but WebCrypto (works in Supabase Edge Functions / Deno and in Node 20+).
//   * the note is encrypted for one device: RFC 8291 (aes128gcm), so only that phone/browser can read it;
//   * the request is signed with our VAPID key: RFC 8292, so the push service knows it comes from us.
// No npm packages: less to trust, nothing to update. tests/push-webpush.test.mjs checks it against the
// reference library (web-push / http_ece) when those are installed.

const enc = new TextEncoder();

export function b64u(bytes) {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function cat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
// HKDF with one output block (all lengths here are <= 32 bytes)
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, cat(info, new Uint8Array([1])))).slice(0, len);
}

// Encrypt one note for one device. uaPublic = p256dh (65 bytes), authSecret = auth (16 bytes).
// opts.salt / opts.serverKeys only for tests.
export async function encrypt(plaintext, uaPublic, authSecret, opts = {}) {
  const server = opts.serverKeys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, server.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, cat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const data = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext;
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(data, new Uint8Array([2]))));
  const rs = 4096;
  const header = cat(salt, new Uint8Array([rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255, asPublic.length]), asPublic);
  return cat(header, sealed);
}

// The VAPID signature: a short ES256 token for the push service's origin.
// publicKey = 65-byte uncompressed key (base64url), privateKey = 32-byte d (base64url).
export async function vapidHeader(endpoint, subject, publicKey, privateKey, now = Date.now()) {
  const pub = unb64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY is not a P-256 public key');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKey, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + publicKey;
}

// Send one note to one device. Returns the push service's HTTP status (201 = taken; 404/410 = device gone).
export async function sendPush(sub, payload, vapid, fetchFn = fetch) {
  const body = await encrypt(JSON.stringify(payload), unb64u(sub.p256dh), unb64u(sub.auth));
  const res = await fetchFn(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: String(vapid.ttl ?? 86400),
      Urgency: vapid.urgency ?? 'normal',
      Authorization: await vapidHeader(sub.endpoint, vapid.subject, vapid.publicKey, vapid.privateKey),
    },
    body,
  });
  try { await res.arrayBuffer(); } catch { /* the answer's body is not needed */ }
  return res.status;
}

// the only hosts we ever send to (the database refuses other addresses too)
export function allowedEndpoint(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.push\.apple\.com)$/.test(x.hostname);
  } catch { return false; }
}
