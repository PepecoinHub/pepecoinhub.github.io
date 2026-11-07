// PepeGochi v2 departure visual prototype. No Supabase connection.
// Never use client-provided inventory or random selection for production.
export const TAKABLE = Object.freeze({
  crt_tv: { label: 'CRT television', line: 'I took the TV. I have shows to catch up on.', glyph: '📺' },
  lava_lamp: { label: 'lava lamp', line: 'I borrowed the lava lamp. Mood lighting matters.', glyph: '💡' },
  potted_plant: { label: 'potted plant', line: 'I took the plant. Someone has to water it.', glyph: '🪴' },
  p_poster: { label: 'P poster', line: 'I took the poster. The wall looked lonely anyway.', glyph: '🖼️' },
  rubber_duck: { label: 'rubber duck', line: 'I took the duck. We have a lot in common.', glyph: '🐤' },
  mug: { label: 'coffee mug', line: 'I took the mug. My tea deserves better.', glyph: '☕' }
});
export const HOURS_TO_LEAVE = 168;
export const DEFAULT_PROPS = Object.freeze(Object.keys(TAKABLE));
const HOUR_MS = 60 * 60 * 1000;

// For the local prototype only: deterministic, NOT secure, not anti-cheat.
export function demoIndex(key, modulo) {
  if (!Number.isInteger(modulo) || modulo <= 0) throw Error('empty candidates');
  let hash = 2166136261;
  for (const ch of String(key)) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}
export function candidates(visibleProps) {
  if (!Array.isArray(visibleProps)) throw TypeError('visibleProps must be an array');
  return [...new Set(visibleProps)].filter(id => Object.hasOwn(TAKABLE, id)).sort();
}
export function makeLife({id, name='Fren', adoptedAt, placedProps=DEFAULT_PROPS}) {
  if (!id || !Number.isFinite(Date.parse(adoptedAt))) throw Error('valid life id and adoptedAt required');
  return { id, name, status:'active', adoptedAt, lastCareAt:adoptedAt,
    placedProps: [...placedProps], departedAt:null, takenPropId:null, letterSeenAt:null };
}
export function dueAt(life) {
  return new Date(Date.parse(life.lastCareAt || life.adoptedAt) + HOURS_TO_LEAVE * HOUR_MS).toISOString();
}
export function computedStatus(life, now) {
  if (life.status === 'departed') return 'departed';
  const elapsed = Date.parse(now) - Date.parse(life.lastCareAt || life.adoptedAt);
  if (!Number.isFinite(elapsed)) throw Error('invalid dates');
  return elapsed >= 168*HOUR_MS ? 'departed' : elapsed >= 120*HOUR_MS ? 'packing' : elapsed >= 48*HOUR_MS ? 'neglected' : 'healthy';
}
// Pure simulated server settlement. A real implementation must lock the owner
// and active life row, use DB time, validate authoritative installed props,
// choose once server-side, and persist the chosen id with departed_at.
export function settleDeparture(life, now, demoSecret='demo-only') {
  if (life.status === 'departed') return life;
  if (computedStatus(life, now) !== 'departed') return life;
  const pool = candidates(life.placedProps);
  const prop = pool.length ? pool[demoIndex(demoSecret + ':' + life.id, pool.length)] : null;
  return { ...life, status:'departed', departedAt:dueAt(life), takenPropId:prop,
    letterSeenAt:null };
}
export function markLetterRead(life, now) {
  if (life.status !== 'departed') throw Error('fren is still here');
  return life.letterSeenAt ? life : { ...life, letterSeenAt:new Date(now).toISOString() };
}
export function canAdopt(life) { return life.status === 'departed' && Boolean(life.letterSeenAt); }
export function roomProps(life) {
  const props = candidates(life.placedProps);
  return life.status === 'departed' ? props.filter(p => p !== life.takenPropId) : props;
}
export function goodbyeText(life) {
  if (life.status !== 'departed') throw Error('not departed');
  const taken = life.takenPropId ? TAKABLE[life.takenPropId] : null;
  return ['Dear Fren,','', 'I waited.', 'I got bored.', 'Then I packed my tiny suitcase.', '',
    taken?.line || 'I took a little piece of the room with me. Not much, just a memory.',
    '', 'Don\'t worry. Your things are safe in your collection.',
    'Maybe your next roommate will appreciate the place.', '', '- Your former PepeGochi'].join('\n');
}