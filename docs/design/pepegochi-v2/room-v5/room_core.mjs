// PepeGochi room V5: pure, non-production, memory-only model.
// Awarding, ownership and departure settlement must be server-validated in production.
export const SLOTS = Object.freeze([
 {id:'wall_left',label:'Lewa ściana',x:169,y:96,allowed:['wall'],layer:30},
 {id:'wall_right',label:'Prawa ściana',x:414,y:112,allowed:['wall'],layer:30},
 {id:'shelf_a',label:'Półka A',x:252,y:140,allowed:['small','trophy'],layer:40},
 {id:'shelf_b',label:'Półka B',x:318,y:140,allowed:['small','trophy'],layer:40},
 {id:'dresser_top',label:'Komoda',x:90,y:215,allowed:['lamp','small'],layer:50},
 {id:'tv_stand',label:'Stolik RTV',x:546,y:240,allowed:['electronics','large'],layer:50},
 {id:'table_top',label:'Stolik',x:453,y:258,allowed:['small','toy'],layer:50},
 {id:'floor_left',label:'Podłoga lewa',x:170,y:345,allowed:['plant','large'],layer:50},
 {id:'floor_right',label:'Podłoga prawa',x:559,y:331,allowed:['plant','large'],layer:50},
 {id:'rug_left',label:'Dywan lewy',x:246,y:341,allowed:['toy','small'],layer:70},
 {id:'rug_right',label:'Dywan prawy',x:398,y:341,allowed:['toy','small'],layer:70}
]);
export const ITEMS=Object.freeze([
 {id:'p_poster',label:'Plakat P',category:'wall',borrowable:true,defaultSlot:'wall_left',defaultOwned:true},
 {id:'crt_tv',label:'Telewizor CRT',category:'electronics',borrowable:true,defaultSlot:'tv_stand',defaultOwned:true},
 {id:'lava_lamp',label:'Lampa lawowa',category:'lamp',borrowable:true,defaultSlot:'dresser_top',defaultOwned:true},
 {id:'potted_plant',label:'Roślina',category:'plant',borrowable:true,defaultSlot:'floor_left',defaultOwned:true},
 {id:'rubber_duck',label:'Kaczuszka',category:'toy',borrowable:true,defaultSlot:'rug_left',defaultOwned:true},
 {id:'mug',label:'Kubek',category:'small',borrowable:true,defaultSlot:'table_top',defaultOwned:true},
 {id:'floppy_disk',label:'Dyskietka (test)',category:'small',borrowable:false,defaultSlot:null,defaultOwned:false},
 {id:'paper_crown',label:'Korona (test)',category:'trophy',borrowable:false,defaultSlot:null,defaultOwned:false},
 {id:'moon_rock',label:'Księżycowa skała (plan)',category:'trophy',borrowable:false,defaultSlot:null,defaultOwned:false},
 {id:'lost_pond_artifact',label:'Artefakt (plan)',category:'trophy',borrowable:false,defaultSlot:null,defaultOwned:false}
]);
export const slotById=id=>SLOTS.find(s=>s.id===id);
export const itemById=id=>ITEMS.find(i=>i.id===id);
const clone=s=>({...s,owned:[...s.owned],placements:{...s.placements},history:s.history.map(x=>({...x})),demoAwards:[...s.demoAwards]});
export function initialRoom(){
  return {revision:0,lifeNumber:1,departed:false,takenItemId:null,letterSeen:false,owned:ITEMS.filter(i=>i.defaultOwned).map(i=>i.id),placements:Object.fromEntries(ITEMS.filter(i=>i.defaultSlot).map(i=>[i.defaultSlot,i.id])),history:[],demoAwards:[]};
}
export function validateRoom(s){
  if(!Number.isInteger(s.revision)||s.revision<0)throw new Error('revision invalid');
  if(new Set(s.owned).size!==s.owned.length)throw new Error('duplicate owned');
  if(s.owned.some(x=>!itemById(x)))throw new Error('unknown owned');
  const seen=new Set();
  for(const [slotId,itemId] of Object.entries(s.placements)){
    const slot=slotById(slotId),item=itemById(itemId);
    if(!slot||!item||!s.owned.includes(itemId)||!slot.allowed.includes(item.category))throw new Error('invalid placement');
    if(seen.has(itemId))throw new Error('one item in two slots');seen.add(itemId);
  }
  if(s.departed&&s.history.length===0)throw new Error('no history');
  if(s.departed&&s.history.at(-1).takenItemId!==s.takenItemId)throw new Error('history mismatch');
  return true;
}
function requireEditing(s,revision){
  validateRoom(s);
  if(s.departed)throw new Error('departure_scene_locked');
  if(revision!==s.revision)throw new Error('stale_revision');
}
export function placeItem(s,itemId,slotId,revision=s.revision){
  requireEditing(s,revision);
  const item=itemById(itemId),slot=slotById(slotId);
  if(!item||!s.owned.includes(itemId))throw new Error('not_owned');
  if(!slot||!slot.allowed.includes(item.category))throw new Error('incompatible_slot');
  if(s.placements[slotId]&&s.placements[slotId]!==itemId)throw new Error('occupied_slot');
  const next=clone(s);
  for(const key of Object.keys(next.placements))if(next.placements[key]===itemId)delete next.placements[key];
  next.placements[slotId]=itemId;next.revision++;
  validateRoom(next);return next;
}
export function unplaceItem(s,slotId,revision=s.revision){
  requireEditing(s,revision);
  if(!slotById(slotId))throw new Error('unknown_slot');
  const next=clone(s);
  if(!next.placements[slotId])return next;
  delete next.placements[slotId];next.revision++;validateRoom(next);return next;
}
// DEMO ONLY. Never accept a client-supplied award source in production.
export function simulateTrustedGift(s,itemId,eventKey,revision=s.revision){
  requireEditing(s,revision);
  if(!['floppy_disk','paper_crown'].includes(itemId)||!eventKey.startsWith('demo:'))throw new Error('demo_only');
  if(s.demoAwards.includes(eventKey))return clone(s);
  const next=clone(s);
  if(!next.owned.includes(itemId))next.owned.push(itemId);
  next.demoAwards.push(eventKey);next.revision++;validateRoom(next);return next;
}
export function settleDemoDeparture(s,pickIndex=0){
  validateRoom(s);
  if(s.departed)return clone(s);
  const eligible=Object.values(s.placements).filter(id=>itemById(id)?.borrowable).sort();
  const idx=eligible.length ? Math.max(0,Math.min(eligible.length-1,Math.trunc(pickIndex))) : 0;
  const takenItemId=eligible[idx]??null;
  const next=clone(s);next.departed=true;next.takenItemId=takenItemId;next.letterSeen=false;
  next.history.push({lifeNumber:s.lifeNumber,takenItemId,placedSnapshot:{...s.placements}});
  next.revision++;
  validateRoom(next);return next;
}
export function openGoodbye(s){
  validateRoom(s);
  if(!s.departed)throw new Error('not_departed');
  const next=clone(s);next.letterSeen=true;return next;
}
export function adoptNewFren(s){
  validateRoom(s);
  if(!s.departed||!s.letterSeen)throw new Error('read_letter_first');
  const next=clone(s);next.lifeNumber++;next.departed=false;next.letterSeen=false;next.takenItemId=null;next.revision++;validateRoom(next);return next;
}
export function displayedItemForSlot(s,slotId){
  const it=s.placements[slotId]??null;
  return s.departed&&it===s.takenItemId?null:it;
}
export function goodbyeCopy(s){
  if(!s.departed)return '';
  const id=s.takenItemId;
  const lines={crt_tv:'P.S. I took the TV. Got shows to watch.',lava_lamp:'P.S. The lava lamp is coming with me.',potted_plant:'P.S. I took the plant. Someone has to water it.',p_poster:'P.S. The P poster looked better in my suitcase.',rubber_duck:'P.S. The duck and I are starting a new life.',mug:'P.S. I took the mug. My tea deserves it.'};
  return 'Dear Fren,\n\nI waited for you, but I needed a little more care.\nSo I packed my things and found a new pond.\n\n'+(lines[id]??'P.S. Your room was too empty to borrow anything.')+'\n\nThanks for the memories.\nYour PepeGochi';
}