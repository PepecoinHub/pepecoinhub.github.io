export function loadBest(key){try{const n=Number(localStorage.getItem(key));return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}catch{return 0;}}
export function saveBest(key,value){try{localStorage.setItem(key,String(value));return true;}catch{return false;}}
export function createSound(button){
  let enabled=false,ctx;
  const unlock=()=>{if(!enabled)return;try{ctx??=new(window.AudioContext||window.webkitAudioContext)();if(ctx.state!=='running')ctx.resume().catch(()=>{});}catch{}};
  button.addEventListener('click',()=>{enabled=!enabled;button.textContent=`Sound: ${enabled?'on':'off'}`;button.setAttribute('aria-pressed',String(enabled));unlock();});
  button.ownerDocument?.addEventListener('pointerup',unlock);
  button.ownerDocument?.addEventListener('keydown',unlock);
  return function(freq=440,length=.08,type='square'){if(!enabled||!ctx)return;try{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,ctx.currentTime+length);g.gain.setValueAtTime(.035,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+length);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+length);}catch{}};
}
// Each pointer/key owns its press. Cancellation must never launch a frog.
export function bindHold(button,down,up,cancel=up){
  const held=new Set();
  const press=token=>{if(held.has(token))return;const first=!held.size;held.add(token);if(first)down();};
  const release=(token,aborted=false)=>{if(!held.delete(token)||held.size)return;(aborted?cancel:up)();};
  const clear=()=>{if(!held.size)return;held.clear();cancel();};
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();try{button.setPointerCapture(e.pointerId);}catch{}press(`p${e.pointerId}`);});
  button.addEventListener('pointerup',e=>release(`p${e.pointerId}`));
  for(const name of ['pointercancel','lostpointercapture'])button.addEventListener(name,e=>release(`p${e.pointerId}`,true));
  button.addEventListener('keydown',e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();if(!e.repeat)press(`k${e.code}`);});
  button.addEventListener('keyup',e=>{if(!['Space','Enter'].includes(e.code))return;e.preventDefault();release(`k${e.code}`);});
  const doc=button.ownerDocument;
  doc?.addEventListener('pointerup',e=>release(`p${e.pointerId}`));
  doc?.addEventListener('pointercancel',e=>release(`p${e.pointerId}`,true));
  doc?.addEventListener('keyup',e=>release(`k${e.code}`));
  doc?.addEventListener('visibilitychange',()=>{if(doc.hidden)clear();});
  button.ownerDocument?.defaultView?.addEventListener('blur',clear);
  return clear;
}
export function frog(c,x,y,scale=1,direction=1,pose=0){c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale*direction,scale);const rect=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};rect('#182d31',-15,-33,29,31);rect('#31734a',-13,-29,25,23);rect('#64a857',-12,-32,11,9);rect('#64a857',3,-32,10,9);rect('#e9f1d5',-10,-30,8,8);rect('#e9f1d5',4,-30,8,8);rect('#182d31',-5,-28,3,5);rect('#182d31',9,-28,3,5);rect('#62994d',-10,-20,22,10);rect('#302733',-10,-14,24,5);rect('#c66c64',-8,-13,18,2);rect('#4b73bc',-12,-8,23,10);rect('#315081',-13,-4,25,6);rect('#182d31',-14+pose,-1,11,5);rect('#182d31',4-pose,-1,12,5);rect('#70b756',-17,-8,5,8);rect('#70b756',12,-10,6,7);c.restore();}
