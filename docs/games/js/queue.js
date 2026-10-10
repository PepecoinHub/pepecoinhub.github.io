import { fitImage } from './imgchunks.js';
// Picture queue for Guess the Picture: the host prepares pictures + answers ahead of time and shows them in any order.
// Stored only on the host's own device (IndexedDB), never uploaded anywhere until a picture is shown to the room.
const DB = 'pepgames-queue', ST = 'items';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(ST, mode), out = fn(t.objectStore(ST));
    t.oncomplete = () => { db.close(); res(out && 'result' in out ? out.result : undefined); };
    t.onerror = () => rej(t.error);
  });
}
export async function loadQueue() {
  try { return (await tx('readonly', (s) => s.getAll())).sort((a, b) => a.order - b.order); } catch { return []; }
}
export async function saveQueue(items) {
  try { await tx('readwrite', (s) => { s.clear(); items.forEach((it, i) => s.put({ id: it.id, kind: it.kind, blob: it.blob || null, src: it.src || null, answer: it.answer, secs: it.secs, order: i })); }); } catch {}
}
// Pictures up to 1 MB are kept exactly as they are; bigger ones are resized (≤ 1600 px) and compressed to ≤ 1 MB
// (see imgchunks.js), so a long queue stays small on the device and every picture can be sent at full quality.
export async function shrink(file) {
  try { return await fitImage(file); } catch { return file; }
}
