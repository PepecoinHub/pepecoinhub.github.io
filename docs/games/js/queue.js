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
// Shrinks big photos (max 1600 px, JPEG) so a long queue stays small on the device.
export async function shrink(file, max = 1600) {
  try {
    const url = URL.createObjectURL(file);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.9));
  } catch { return file; }
}
