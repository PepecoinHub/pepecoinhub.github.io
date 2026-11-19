// The push encryption in games/supabase/functions/push-send/webpush.mjs.
//   node --test tests/push-webpush.test.mjs
// Always: a round trip through our own decryption (RFC 8291 receiver side), the VAPID token's shape and
// signature, and that index.ts is built from the current sources.
// With PUSH_REF_DIR=<a folder with node_modules/http_ece> it also decrypts with the reference library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { encrypt, vapidHeader, b64u, unb64u, allowedEndpoint } from '../games/supabase/functions/push-send/webpush.mjs';

const subtle = crypto.subtle;

async function device() {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { kp, pub, auth: crypto.getRandomValues(new Uint8Array(16)) };
}

// the phone's side, written straight from RFC 8291 (independent of webpush.mjs)
async function decrypt(buf, dev) {
  const salt = buf.slice(0, 16), rs = new DataView(buf.buffer, buf.byteOffset + 16, 4).getUint32(0), idlen = buf[20];
  const asPub = buf.slice(21, 21 + idlen), ct = buf.slice(21 + idlen);
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, dev.kp.privateKey, 256));
  const hk = async (s, ikm, info, len) => {
    const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, k, len * 8));
  };
  const te = new TextEncoder();
  const ikm = await hk(dev.auth, ecdh, new Uint8Array([...te.encode('WebPush: info\0'), ...dev.pub, ...asPub]), 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  assert.equal(plain[plain.length - 1], 2, 'last-record delimiter');
  return new TextDecoder().decode(plain.slice(0, -1));
}

test('a note encrypted for a device opens only with that device keys', async () => {
  const dev = await device(), other = await device();
  const note = JSON.stringify({ title: 'Byl mentioned you', body: 'gm fren 🐸 ąę', url: '/meme/#lan' });
  const box = await encrypt(note, dev.pub, dev.auth);
  assert.equal(await decrypt(box, dev), note);
  await assert.rejects(decrypt(box, { ...other, auth: dev.auth }));
  await assert.rejects(decrypt(box, { ...dev, auth: crypto.getRandomValues(new Uint8Array(16)) }));
});

test('the reference library (http_ece) opens our notes', { skip: !process.env.PUSH_REF_DIR && 'set PUSH_REF_DIR' }, async () => {
  const req = createRequire(process.env.PUSH_REF_DIR + '/');
  const ece = req('http_ece'), nc = req('node:crypto');
  const ecdh = nc.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = nc.randomBytes(16);
  const box = await encrypt('hello pond', new Uint8Array(ecdh.getPublicKey()), new Uint8Array(auth));
  const out = ece.decrypt(Buffer.from(box), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth });
  assert.equal(out.toString(), 'hello pond');
});

test('VAPID header: ES256 token for the push service origin, signed by our key', async () => {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await subtle.exportKey('raw', kp.publicKey));
  const d = (await subtle.exportKey('jwk', kp.privateKey)).d;
  const h = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', 'https://pepecoinhub.com/meme/', pub, d, 1_700_000_000_000);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m);
  assert.equal(m[4], pub);
  const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2])));
  assert.deepEqual(claims, { aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 43200, sub: 'https://pepecoinhub.com/meme/' });
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, unb64u(m[3]), new TextEncoder().encode(m[1] + '.' + m[2]));
  assert.ok(ok);
  await assert.rejects(vapidHeader('https://fcm.googleapis.com/x', 's', 'AAAA', d), /not a P-256/);
});

test('only real push services', () => {
  for (const u of ['https://fcm.googleapis.com/fcm/send/x', 'https://web.push.apple.com/QH', 'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x']) assert.ok(allowedEndpoint(u), u);
  for (const u of ['http://fcm.googleapis.com/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com.evil.com/x',
    'https://169.254.169.254/latest', 'not a url']) assert.ok(!allowedEndpoint(u), u);
});

test('index.ts (the file to paste in Supabase) is built from the current sources', () => {
  execFileSync('python3', [new URL('../scripts/build_push_function.py', import.meta.url).pathname, '--check']);
});
