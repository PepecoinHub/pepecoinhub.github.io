// A13: local room interaction, with care delegated to the existing validated actions.
import { roomScene, SPRITES, ROOM_W, ROOM_H, FROG_PX } from './pepegochi-room.mjs?v=20261116room1';

const PROPS = {
  p_poster: ['Inspect painting', 'Fine art. Definitely not bought at the pond flea market.'],
  crt_tv: ['Watch Pond TV', 'The remote has mysteriously disappeared. Opening Pond TV…'],
  lava_lamp: ['Toggle lava lamp', 'The finest lava in the pond.'],
  potted_plant: ['Water plant', 'Hydrated. Unlike my portfolio.'],
  rubber_duck: ['Play with rubber duck', 'SQUEAK. A worthy opponent.'],
  mug: ['Inspect Comfy mug', 'The coffee is cold. The memes are not.'],
  moon_rock: ['Inspect moon rock', 'Actual moon dust, probably. Do not lick.'],
  paper_crown: ['Inspect crown', 'Long live the pond. Taxes are payable in flies.'],
  golden_fly: ['Inspect golden fly', 'Too shiny to eat. I have standards.'],
  floppy_disk: ['Inspect floppy disk', '1.44 MB of extremely important frog business.'],
};
// Opaque bounds of the approved 128px item sprites (exclusive right/bottom).
const BOUNDS = { p_poster:[18,14,112,114], crt_tv:[6,16,124,118], lava_lamp:[32,16,102,114],
  potted_plant:[12,16,118,114], rubber_duck:[16,24,110,110], mug:[26,32,122,110],
  moon_rock:[20,36,108,124], paper_crown:[16,26,112,124], golden_fly:[22,36,108,124], floppy_disk:[24,22,102,124] };

export function roomTargets(opts, owned = false) {
  if (opts.mode !== 'pet') return [];
  const sc = roomScene(opts), out = [];
  if (owned) for (const item of sc.items) {
    if (!Object.hasOwn(PROPS, item.itemId)) continue;
    const [l,t,r,b] = BOUNDS[item.itemId], iw = item.width, ih = iw * ROOM_W / ROOM_H;
    out.push({ id: item.itemId, label: PROPS[item.itemId][0], x: item.left - iw/2 + iw*l/128,
      y: item.top - (item.wall ? ih/2 : ih) + ih*t/128, w: iw*(r-l)/128, h: ih*(b-t)/128, z: item.z + 2 });
  }
  // Only the exposed left edge of the bed is clickable; the frog keeps its own hit area.
  out.push({ id: 'bed', label: 'Help your frog rest', x: 34.3, y: 63, w: 8.4, h: 20, z: 65 });
  if (sc.frog) {
    const [top, bottom] = SPRITES[sc.frog.sprite];
    const h = (bottom - top) / ROOM_H * 100;
    out.push({ id: 'frog', label: 'Pet your frog', x: sc.frog.left - FROG_PX / ROOM_W * 37,
      y: sc.frog.top - h, w: FROG_PX / ROOM_W * 74, h, z: 82 });
  }
  return out;
}

export function roomResponse(id, view, { lampOn = true, busy = false, embedded = false } = {}) {
  if (view?.mode !== 'pet' || busy) return null;
  const p = view.pet;
  if (id === 'frog') {
    if (p.stage === 'egg') return { text: 'Tap tap. Something is in there.' };
    if (p.status === 'packing') return { text: 'My suitcase is almost ready. I need real care, fren.' };
    if (p.status === 'neglected') return { text: 'A little care would go a long way right now.' };
    if (p.status === 'recovering') return { text: 'Thanks for staying with me, fren.' };
    const low = [...(p.needs || [])].sort((a,b) => a.value - b.value)[0];
    if (low && low.value < 75) return { text: `I could use some ${low.label.toLowerCase()} care first.` };
    return { text: p.stage === 'tadpole' ? 'Blub. That tickles!' : p.stage === 'froglet' ? 'Heh. Do it again!' : 'Pat accepted. Dignity temporarily compromised.', effect: 'pet' };
  }
  if (id === 'bed' || id === 'rubber_duck') {
    const kind = id === 'bed' ? 'rest' : 'play';
    const action = p.actions?.find(a => a.kind === kind);
    if (action?.enabled) return { text: id === 'bed' ? 'Time for a nap, fren.' : PROPS.rubber_duck[1], care: kind };
    return { text: (id === 'bed' ? 'No nap right now.' : PROPS.rubber_duck[1]) + (action?.reason ? ` (${action.reason})` : '') };
  }
  if (!Object.hasOwn(PROPS, id)) return null;
  if (id === 'crt_tv') return embedded ? { text: PROPS[id][1], tv: true } : { text: 'You can watch Pond TV on the PondOS desktop.' };
  if (id === 'lava_lamp') return { text: lampOn ? 'Lights out. Maximum comfy.' : 'The lava flows again.', lamp: !lampOn };
  return { text: PROPS[id][1], effect: id === 'potted_plant' ? 'water' : undefined };
}

export function createRoomInteractions({ getView, isBusy, care, openTV, reduced = () => false, now = Date.now } = {}) {
  let life = null, lampOn = true, dispose = () => {}, lastClick = -Infinity;
  return {
    attach(frame, opts, { owned, lifeId, embedded } = {}) {
      dispose();
      if (life !== lifeId) { life = lifeId; lampOn = true; lastClick = -Infinity; }
      const doc = frame.ownerDocument, stage = frame.querySelector('.pgr');
      const targets = roomTargets(opts, owned);
      if (!targets.length) return;
      const feedback = doc.createElement('p');
      feedback.className = 'pgr-response'; feedback.setAttribute('role', 'status');
      feedback.textContent = 'Click your Fren or something in the room.';
      frame.append(feedback);
      const getItem = id => frame.querySelector(`[data-item="${id}"]`);
      function paintLamp() {
        const lamp = getItem('lava_lamp');
        lamp?.classList.toggle('pgr-lamp-off', !lampOn);
        stage.classList.toggle('pgr-room-lights-off', !!lamp && !lampOn);
      }
      paintLamp();
      const buttons = []; let timer = null, affected = null;
      const shortcuts = doc.createElement('details'); shortcuts.className = 'pgr-shortcuts';
      const summary = doc.createElement('summary'); summary.textContent = 'Room controls'; shortcuts.append(summary);
      const list = doc.createElement('div'); shortcuts.append(list); frame.append(shortcuts);
      function clearEffect() { clearTimeout(timer); affected?.classList.remove('pgr-petted', 'pgr-watered'); affected = null; }
      for (const t of targets) {
        const btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'pgr-hotspot';
        btn.dataset.roomAction = t.id; btn.title = t.label; btn.setAttribute('aria-label', t.label);
        Object.assign(btn.style, {left: t.x+'%', top: t.y+'%', width: t.w+'%', height: t.h+'%', zIndex: String(t.z)});
        const activate = () => {
          if (!frame.isConnected || now() - lastClick < 300 || isBusy()) return;
          const result = roomResponse(t.id, getView(), { lampOn, busy: isBusy(), embedded });
          if (!result) return;
          lastClick = now(); feedback.textContent = result.text;
          if (result.lamp !== undefined) { lampOn = result.lamp; paintLamp(); }
          if (result.effect && !reduced()) {
            clearEffect(); affected = result.effect === 'pet' ? frame.querySelector('.pgr-pet') : getItem('potted_plant');
            affected?.classList.add(result.effect === 'pet' ? 'pgr-petted' : 'pgr-watered'); timer = setTimeout(clearEffect, 650);
          }
          if (result.care) care(result.care);
          if (result.tv) openTV();
        };
        btn.addEventListener('click', activate);
        stage.append(btn); buttons.push(btn);
        const shortcut = doc.createElement('button'); shortcut.type = 'button'; shortcut.className = 'pgr-shortcut';
        shortcut.textContent = t.label; shortcut.addEventListener('click', activate); list.append(shortcut);
      }
      dispose = () => { clearEffect(); buttons.forEach(b => b.remove()); feedback.remove(); shortcuts.remove(); };
    },
    dispose() { dispose(); life = null; lampOn = true; lastClick = -Infinity; },
  };
}
