// A13: local room interaction, with care delegated to the existing validated actions.
import { roomScene, PROP_BOUNDS, SPRITE_BOUNDS, ROOM_W, ROOM_H, FROG_PX } from './pepegochi-room.mjs?v=20261120notes3';
import { mountRoomEffects } from './pepegochi-room-fx.mjs?v=20261118room3';

const PROPS = {
  p_poster: ['Inspect painting', 'Fine art. Definitely not bought at the pond flea market.'],
  crt_tv: ['Watch Pond TV', 'The remote has mysteriously disappeared. Opening Pond TV…'],
  lava_lamp: ['Toggle lava lamp', 'The finest lava in the pond.'],
  potted_plant: ['Water plant', 'Hydrated. Unlike my portfolio.'],
  rubber_duck: ['Play with rubber duck', 'SQUEAK. A worthy opponent.'],
  mug: ['Inspect Comfy mug', 'Emergency copium brew. No refunds.'],
  moon_rock: ['Inspect moon rock', 'Actual moon dust, probably. Do not lick.'],
  paper_crown: ['Inspect crown', 'Long live the pond. Taxes are payable in flies.'],
  golden_fly: ['Inspect golden fly', 'Too shiny to eat. I have standards.'],
  floppy_disk: ['Inspect floppy disk', '1.44 MB of extremely important frog business.'],
};
// Ten distinct comments per object. The first is the established line; later clicks rotate
// independently for each prop, without changing its action or any authoritative pet state.
export const PROP_LINES = {
  p_poster: ['My finest piece of pond art.', 'Please admire the toes responsibly.', 'The artist used only the finest foot-based inspiration.', 'This is a museum now. Admission: one fly.', 'The frame cost more than my entire wardrobe.', 'I call this masterpiece Golden Foot.', 'No touching the art. I have a very serious face.', 'Art criticism: gold, foot, excellent.', 'It belongs in a gallery. Or above my bed.'],
  crt_tv: ['The CRT is warming up. Classic.', 'Channel surfing is my favourite sport.', 'Do not adjust your set. I am naturally green.', 'The rabbit ears receive excellent pond gossip.', 'The picture looks better through a curved screen.', 'No widescreen nonsense in this room.', 'I claim the remote under frog law.', 'Prime time. Bring the snacks.', 'Pond TV: now with 100% more frog opinion.'],
  potted_plant: ['Watered. We can both survive another day.', 'My silent roommate approves.', 'The leaves look more productive than me.', 'That is proper leaf maintenance.', 'Careful, it is not an aquarium.', 'Photosynthesis is a powerful business model.', 'The plant has no complaints. Suspicious.', 'I named it Leaf.exe.', 'A little water, a lot of vibes.'],
  rubber_duck: ['SQUEAK. The duck has spoken.', 'The duck challenges me to a duel.', 'Our rubber friend takes recreation seriously.', 'That squeak was in stereo.', 'An elite opponent. Very yellow.', 'The duck refuses to elaborate.', 'I appoint the duck recreation manager.', 'SQUEAK.EXE is responding.', 'A true fren never abandons the duck.'],
  mug: ['Vintage mug. Modern amounts of copium.', 'The microwave is not included.', 'This mug has seen many red candles.', 'The secret ingredient is being comfy.', 'Steam detected. Frog supervision active.', 'Official office fuel. Not for tadpoles.', 'No flies were roasted in this brew.', 'It says Comfy, so it must work.', 'The mug is warmer than my old monitor.'],
  moon_rock: ['A rock with impressive travel history.', 'It is not a cheese sample. Probably.', 'One small hop for a frog.', 'I have no idea how to dust lunar dust.', 'A souvenir from somewhere above the pond.', 'The moon rocks. Literally.', 'Do not drop that on my toes.', 'A very prestigious pebble.', 'Gravity and I have an understanding.'],
  paper_crown: ['The crown is extremely official cardboard.', 'Your royal frog accepts compliments.', 'A kingdom of one frog and a duck.', 'My coronation was catered with flies.', 'The royal crown is not waterproof.', 'Please address me as Your Comfiness.', 'The throne is just my cushion.', 'Keep the crown away from the lava lamp.', 'Long live the royal nap.'],
  golden_fly: ['A fly I cannot eat. Cruel design.', 'The trophy is on a strict no-snacking policy.', 'A masterpiece of fly-based engineering.', 'Shiny wings. Questionable nutritional value.', 'The awards committee has excellent taste.', 'I polished this with my finest frog dignity.', 'This fly is not part of dinner.', 'The gold is purely decorative, fren.', 'My trophy has better posture than I do.'],
  floppy_disk: ['Please do not bend the save icon.', 'The disk is older than my entire life.', 'One disk. Approximately half a frog selfie.', 'Remember to eject before moving out.', 'FLOPPY.EXE is ready for tiny business.', 'No cloud here. Only plastic and magnetic magic.', 'This is not a coaster. I checked.', '1.44 MB of premium nostalgia.', 'I backed up my flies. They are still missing.'],
};
const LAMP_OFF=['Lights out. Maximum comfy.','Night mode: hardware edition.','Time to enjoy the moonlight.','The lava has left the chat.','Darkness officially installed.'];
const LAMP_ON=['The lava flows again.','Maximum lime glow restored.','The room has entered 1999 mode.','The blobs are back on duty.','No RGB software required.'];
const BED=['Time for a nap, fren.','The cushion calls my name.','Reboot in sleep mode.','Dreaming of flies and soft blankets.','Nap.exe is ready.','Let me recharge my tiny batteries.','The bed wins this round.','This counts as professional resting.','I demand one comfy minute.','Goodnight, extremely briefly.'];
const pick=(arr,n)=>arr[Math.abs(Math.trunc(n||0))%arr.length];
function propLine(id,index) { return pick([PROPS[id][1],...PROP_LINES[id]],index); }

export function roomTargets(opts, owned = false) {
  if (opts.mode !== 'pet') return [];
  const sc = roomScene(opts), out = [];
  if (owned) for (const item of sc.items) {
    if (!Object.hasOwn(PROPS, item.itemId)) continue;
    const [l,t,r,b] = PROP_BOUNDS[item.itemId], iw = item.width, ih = iw * ROOM_W / ROOM_H;
    out.push({ id: item.itemId, label: PROPS[item.itemId][0], x: item.left - iw/2 + iw*l/128,
      y: item.top - (item.wall ? ih/2 : ih) + ih*t/128, w: iw*(r-l)/128, h: ih*(b-t)/128, z: item.z + 2 });
  }
  // Only the exposed left edge of the bed is clickable; the frog keeps its own hit area.
  out.push({ id: 'bed', label: 'Help your frog rest', x: 34.3, y: 63, w: 8.4, h: 20, z: 65 });
  if (sc.frog) {
    const [left,top,right,bottom] = SPRITE_BOUNDS[sc.frog.sprite];
    const h = (bottom - top) / ROOM_H * 100;
    out.push({ id: 'frog', label: 'Pet your frog', x: sc.frog.left + (left-FROG_PX/2)/ROOM_W*100,
      y: sc.frog.top - h, w: (right-left)/ROOM_W*100, h, z: 82 });
  }
  return out;
}

const PAT_LINES = {
  tadpole: ['Blub. That tickles!', 'Blub blub. Important frog business.', 'Tiny fren, massive opinions.', 'My tail likes you!', 'Blub? Blub!', 'Small splash of happiness.'],
  froglet: ['Heh. Do it again!', 'I am a very professional frog.', 'That was a good pat, fren.', 'My hoodie has a no-dirt policy.', 'I am practising being tall.', 'Tiny hops, big feelings.'],
  adult: ['Pat accepted. Dignity temporarily compromised.', 'You may pet the frog. The frog allows it.', 'Certified comfy. No further questions.', 'Official mouse inspection complete.', 'My hoodie approves of this interaction.', 'Fren, this is peak frog service.', 'My face has passed quality control.', 'A respectable pat. Five stars.'],
};

export function roomResponse(id, view, { lampOn = true, busy = false, embedded = false, patIndex = 0, patBurst = 0, propIndex = 0 } = {}) {
  if (view?.mode !== 'pet' || busy) return null;
  const p = view.pet;
  if (id === 'frog') {
    if (p.stage === 'egg') return { text: pick(['Tap tap. Something is in there.','A tiny movement inside the shell.','The egg wobbles gently.','Someone is getting ready to meet you.'],propIndex), effect:'egg' };
    if (p.status === 'packing') return { text: 'My suitcase is almost ready. I need real care, fren.' };
    if (p.status === 'neglected') return { text: 'A little care would go a long way right now.' };
    if (p.status === 'recovering') return { text: 'Thanks for staying with me, fren.' };
    const low = [...(p.needs || [])].sort((a,b) => a.value - b.value)[0];
    if (low && low.value < 75) return { text: `I could use some ${low.label.toLowerCase()} care first.` };
    if (patBurst >= 3) return { text: 'Okay fren, personal pond space, please.' };
    const lines = PAT_LINES[p.stage] || PAT_LINES.adult;
    return { text: lines[patIndex % lines.length], effect: 'pet' };
  }
  if (id === 'bed' || id === 'rubber_duck') {
    const kind = id === 'bed' ? 'rest' : 'play';
    const action = p.actions?.find(a => a.kind === kind);
    const effect = id === 'rubber_duck' ? 'duck' : undefined;
    if (action?.enabled) return { text: id === 'bed' ? pick(BED,propIndex) : propLine('rubber_duck',propIndex), care: kind, effect };
    return { text: (id === 'bed' ? 'No nap right now.' : propLine('rubber_duck',propIndex)) + (action?.reason ? ` (${action.reason})` : ''), effect };
  }
  if (!Object.hasOwn(PROPS, id)) return null;
  if (id === 'crt_tv') return embedded ? { text: propLine(id,propIndex), tv: true } : { text: 'You can watch Pond TV on the PondOS desktop.' };
  if (id === 'lava_lamp') return { text: pick(lampOn?LAMP_OFF:LAMP_ON,Math.floor(propIndex/2)), lamp: !lampOn };
  return { text: propLine(id,propIndex), effect: id === 'potted_plant' ? 'water' : id === 'mug' ? 'mug' : 'spark' };
}

export function createRoomInteractions({ getView, isBusy, care, openTV, reduced = () => false, now = Date.now } = {}) {
  let life = null, lampOn = true, dispose = () => {}, lastClick = -Infinity, pats = [], patIndex = 0, propIndices = {};
  return {
    attach(frame, opts, { owned, lifeId, embedded } = {}) {
      dispose();
      if (life !== lifeId) { life = lifeId; lampOn = true; lastClick = -Infinity; pats=[]; patIndex=0; propIndices={}; }
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
      const buttons = [], effects=mountRoomEffects(stage,{reduced});
      const shortcuts = doc.createElement('details'); shortcuts.className = 'pgr-shortcuts';
      const summary = doc.createElement('summary'); summary.textContent = 'Room controls'; shortcuts.append(summary);
      const list = doc.createElement('div'); shortcuts.append(list); frame.append(shortcuts);
      for (const t of targets) {
        const btn = doc.createElement('button'); btn.type = 'button'; btn.className = 'pgr-hotspot';
        btn.dataset.roomAction = t.id; btn.title = t.label; btn.setAttribute('aria-label', t.label);
        Object.assign(btn.style, {left: t.x+'%', top: t.y+'%', width: t.w+'%', height: t.h+'%', zIndex: String(t.z)});
        const activate = () => {
          if (!frame.isConnected || now() - lastClick < 300 || isBusy()) return;
          const at=now(); pats=pats.filter(p=>at-p<3500);
          const result = roomResponse(t.id, getView(), { lampOn, busy: isBusy(), embedded, patIndex, patBurst:pats.length, propIndex:propIndices[t.id]||0 });
          if (!result) return;
          lastClick = at; feedback.textContent = result.text; propIndices[t.id]=(propIndices[t.id]||0)+1;
          if (t.id==='frog') { pats.push(at); if (result.effect==='pet') patIndex++; }
          if (result.lamp !== undefined) { lampOn = result.lamp; paintLamp(); }
          effects.clear();
          if (result.effect) effects.play(result.effect,t,t.id==='frog'?frame.querySelector('.pgr-pet'):getItem(t.id));
          if (result.care) care(result.care);
          if (result.tv) openTV();
        };
        btn.addEventListener('click', activate);
        stage.append(btn); buttons.push(btn);
        const shortcut = doc.createElement('button'); shortcut.type = 'button'; shortcut.className = 'pgr-shortcut';
        shortcut.textContent = t.label; shortcut.addEventListener('click', activate); list.append(shortcut);
      }
      dispose = () => { effects.dispose(); buttons.forEach(b => b.remove()); feedback.remove(); shortcuts.remove(); };
    },
    dispose() { dispose(); life = null; lampOn = true; lastClick = -Infinity; pats=[]; patIndex=0; propIndices={}; },
  };
}
