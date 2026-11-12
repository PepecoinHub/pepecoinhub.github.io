// Presentation/availability registry. Gameplay definitions stay in the engine.
export const ARSENAL_STAGE = 'B';
export const ARSENAL_MODE = 'exp-v1';
const entries = [
  ['gold','golden_foot_v2','Mega Golden Foot','B',1,'Special'],
  ['bell_bomb','bell_bomb','Bell Bomb','B',2,'Special'],
  ['frog_mine','frog_mine','Frog Mine','B',2,'Traps'],
  ['moon_rocket','moon_rocket','Moon Rocket','C',2,'PEP'],
  ['ban_hammer','ban_hammer','Ban Hammer','C',2,'PEP'],
  ['pep_rain','pep_rain','PEP Rain','C',1,'PEP'],
  ['doge_flyer','doge_flyer','Doge Flyer','D',1,'Legendary'],
  ['silver_donkey','silver_donkey','Silver Donkey','D',1,'Legendary'],
];
export const ARSENAL_ART = Object.freeze(Object.fromEntries(entries.map(([id,art,name,stage,ammo,category])=>[id,Object.freeze({id,art,name,stage,ammo,category})])));
export const arsenalFromSearch = search => new URLSearchParams(search).get('arsenal') === ARSENAL_MODE ? ARSENAL_MODE : null;
export const experimentalWeaponEnabled = (mode,id) => mode===ARSENAL_MODE && ['gold','bell_bomb','frog_mine'].includes(id);
export const SIMPLE_GAMEPLAY = Object.freeze({
  gold: Object.freeze({name:'Mega Golden Foot',short:'Mega Foot',damage:58,radius:66,knockback:1.2}),
  toe: Object.freeze({damage:12,radius:16}),
  bell_bomb: Object.freeze({name:'Bell Bomb',short:'Bell',damage:44,radius:32,fuse:3,ammo:2,power:520,wind:false,knockback:1.15}),
  frog_mine: Object.freeze({name:'Frog Mine',short:'Frog Mine',damage:34,radius:30,ammo:2,power:1,arming:1,detect:48,jumpTime:.35}),
});
export function arsenalArtPath(id,size=64) {
  const art=ARSENAL_ART[id];
  return art ? 'art/arsenal-v10/'+(size===128?'icons_128/':'hud_64/')+art.art+'.png' : null;
}
export function arsenalItems(definitions,qa=false) {
  const ids=Object.keys(definitions).filter(id=>'ammo' in definitions[id]);
  if(qa)for(const id of Object.keys(ARSENAL_ART))if(!ids.includes(id))ids.push(id);
  return ids.map(id=>{
    const def=definitions[id], art=qa&&ARSENAL_ART[id];
    return {id,name:def?.name??art.name,category:art?.category??'Classic',
      locked:!def,stage:art?.stage,plannedAmmo:art?.ammo,
      icon:art?arsenalArtPath(id):'img/pondwars/'+id+'.svg',
      fallback:'img/pondwars/'+(Object.hasOwn(ARSENAL_ART,id)&&id!=='gold'?'grenade':id)+'.svg'};
  });
}
