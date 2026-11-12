// Presentation only. HUD images never act as flight/effect frames.
export function validateClip(c) {
  return !!c && typeof c.src==='string' && c.src.endsWith('.png') && !/hud|icons/.test(c.src)
    && Array.isArray(c.frame) && c.frame.length===2 && c.frame.every(n=>Number.isInteger(n)&&n>0)
    && Number.isInteger(c.frames) && c.frames>0 && Number.isInteger(c.columns) && c.columns>0
    && Number.isFinite(c.fps) && c.fps>0 && Array.isArray(c.anchor) && c.anchor.length===2 && c.anchor.every(Number.isFinite)
    && (c.rotationOffset===undefined || Number.isFinite(c.rotationOffset))
    && (c.reducedFrame===undefined || Number.isInteger(c.reducedFrame)&&c.reducedFrame>=0&&c.reducedFrame<c.frames)
    && Array.isArray(c.size) && c.size.length===2 && c.size.every(n=>Number.isFinite(n)&&n>0);
}
export function clipFrame(c,time,reduced=false) {
  if(!validateClip(c))return null;
  const n=reduced?(c.reducedFrame??0):c.loop?Math.floor(Math.max(0,time)*c.fps)%c.frames:Math.min(c.frames-1,Math.floor(Math.max(0,time)*c.fps));
  return {n,sx:n%c.columns*c.frame[0],sy:Math.floor(n/c.columns)*c.frame[1],sw:c.frame[0],sh:c.frame[1],x:-c.anchor[0]*c.size[0]/c.frame[0],y:-c.anchor[1]*c.size[1]/c.frame[1],width:c.size[0],height:c.size[1]};
}
export const WEAPON_FALLBACK = {goldv2:'gold',megatoe:'gold',bell:'bell',frogmine:'frogmine',moon:'moon',ban:'ban',rain:'rain',pep:'rain',doge:'doge',donkey:'donkey'};
export const MAP_DECORATIONS = {
  moon:[{id:'habitat',x:220,y:180},{id:'antenna',x:930,y:130}],
  doom:[{id:'ruined-gate',x:330,y:170},{id:'dead-tree',x:790,y:160}],
  farm:[{id:'barn',x:210,y:190},{id:'windmill',x:980,y:160}],
  quarry:[{id:'crane',x:190,y:100},{id:'ore-conveyor',x:930,y:140}],
  tower:[{id:'distant-belfry',x:600,y:90},{id:'ruins',x:220,y:170}],
};
export const MAP_TINT = {moon:'#bec9e8',doom:'#7f9386',farm:'#c9b989',quarry:'#abb7c5',tower:'#b4a09b'};
