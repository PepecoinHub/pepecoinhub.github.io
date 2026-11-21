// A14: short, purely local pixel effects. No pet state, rewards, inventory or audio.
const FX = {
  pet: { art:'heart', pose:'pgr-petted', ms:950, points:[[.3,.12,0],[.65,.04,120],[.5,.24,240]] },
  egg: { art:'spark', pose:'pgr-egg-wobble', ms:650, points:[[.2,.2,40],[.8,.35,100]] },
  water: { art:'drop', pose:'pgr-watered', ms:950, points:[[.24,.06,0],[.52,.02,120],[.78,.12,220],[.42,.06,320]] },
  lemon: { art:'drop', pose:'pgr-watered', ms:2900, points:[[.24,.06,0],[.52,.02,120],[.78,.12,220],[.42,.06,320]], fruits:[[.25,.32,350],[.54,.15,550],[.77,.37,750]] },
  duck: { art:'squeak', pose:'pgr-duck-bounce', ms:750, points:[[.78,.24,0],[.84,.12,100]] },
  horse: { art:'chrome', pose:'pgr-horse-rock', ms:900, points:[[.25,.86,140],[.72,.9,380]] },
  spark: { art:'spark', ms:750, points:[[.2,.18,0],[.78,.3,160],[.48,.06,260]] },
  mug: { art:'steam', ms:950, points:[[.4,.12,0],[.62,.08,180]] },
};
const clamp = n => Math.max(2, Math.min(98, n));

// The effect geometry follows the sprite's opaque hit box, in room percentages.
export function roomEffectPlan(kind, target) {
  const conf = Object.hasOwn(FX,kind) ? FX[kind] : null;
  if (!conf || !target || ![target.x,target.y,target.w,target.h].every(Number.isFinite) || target.w<=0 || target.h<=0) return null;
  const project=([x,y,delay])=>({
    x:clamp(target.x+target.w*x), y:clamp(target.y+target.h*y), delay,
  });
  return { art:conf.art, pose:conf.pose, ms:conf.ms, points:conf.points.map(project), fruits:conf.fruits?.map(project) };
}

export function mountRoomEffects(stage, { reduced = () => false, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const doc = stage.ownerDocument;
  let layer = null, affected = null, pose = null, timer = null, disposed = false;
  function clear() {
    if (timer !== null) clearTimer(timer); timer = null;
    layer?.remove(); layer = null;
    if (affected && pose) affected.classList.remove(pose);
    affected = pose = null;
  }
  const onVisibility = () => { if (doc.visibilityState === 'hidden') clear(); };
  doc.addEventListener?.('visibilitychange', onVisibility);
  return {
    clear,
    play(kind, target, sprite) {
      clear();
      const plan = roomEffectPlan(kind,target);
      if (disposed || !plan || reduced() || doc.visibilityState === 'hidden' || !stage.isConnected) return false;
      layer = doc.createElement('div'); layer.className='pgr-fx-layer'; layer.setAttribute('aria-hidden','true');
      for (const point of plan.points) {
        const pixel = doc.createElement('span'); pixel.className='pgr-fx pgr-fx-'+plan.art;
        Object.assign(pixel.style,{left:point.x+'%',top:point.y+'%',animationDelay:point.delay+'ms'});
        layer.append(pixel);
      }
      for (const point of plan.fruits || []) {
        const fruit=doc.createElement('span'); fruit.className='pgr-fx pgr-fx-lemon';
        Object.assign(fruit.style,{left:point.x+'%',top:point.y+'%',animationDelay:point.delay+'ms'});
        layer.append(fruit);
      }
      stage.append(layer);
      if (sprite && plan.pose) { affected=sprite; pose=plan.pose; sprite.classList.add(pose); }
      timer=setTimer(clear,plan.ms);
      return true;
    },
    dispose() { disposed=true; clear(); doc.removeEventListener?.('visibilitychange',onVisibility); },
  };
}
