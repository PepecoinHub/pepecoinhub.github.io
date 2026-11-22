// PepeGochi trips (A12, owner spec 2026-11-21). The owner packs one thing and picks a length; the frog leaves,
// the room stays empty, and it comes back with a postcard, sometimes a souvenir, and always a diary page.
// The SERVER rolls the trip when it starts (games/supabase/update_pepegochi_life.sql) and keeps the result until
// the return time, so nobody can change the loot in the console. This file holds the shared catalog (the SQL test
// checks both match), the texts and a pure roll used by the preview and the tests.

export const HOUR = 3600000;

export const LENGTHS = {
  short: { label: 'Short trip', hours: 4, souvenirChance: .4 },
  long: { label: 'Long trip', hours: 12, souvenirChance: .7 },
  grand: { label: 'Grand expedition', hours: 48, souvenirChance: 1, weekly: true },
};
export const PACKS = {
  snack: { label: 'A snack', note: 'for lazy trips by the water' },
  map: { label: 'A map', note: 'for far places and old websites' },
  lantern: { label: 'A lantern', note: 'for dark mines and swamps' },
};

// id, name, postcard text (the frog writes), weights [short, long, grand], pack that makes it likelier (x2)
export const PLACES = [
  { id: 'big_pond', name: 'the Big Pond', text: "the big pond. it's like my pond but bigger. i feel small. i like it.", w: [30, 20, 10], pack: 'snack' },
  { id: 'forgotten_coins_swamp', name: 'the Swamp of Forgotten Coins', text: 'found many old coins here. nobody remembers their names. sad. pep will never end up here.', w: [25, 20, 12], pack: 'lantern' },
  { id: 'scrypt_mine', name: 'the Scrypt Mine', text: 'visited the miners. very loud. very warm. they gave me a hard hat.', w: [25, 20, 14], pack: 'lantern' },
  { id: 'lily_hills', name: 'the Lily Hills', text: 'took a nap on a lily pad. drifted 3 km. no regrets.', w: [30, 20, 10], pack: 'snack' },
  { id: 'duck_city', name: 'Duck City', text: 'went undercover. they know. they ALL know.', w: [10, 14, 14], pack: null },
  { id: 'exchange', name: 'the Exchange', text: 'saw the order book. it looked back at me.', w: [10, 14, 12], pack: 'map' },
  { id: 'old_internet', name: 'the Old Internet', text: 'found a 1998 website with a hit counter. i was visitor 000042. honored.', w: [10, 14, 12], pack: 'map' },
  { id: 'krakow_dragon', name: 'Kraków', text: 'saw a dragon. he wanted to trade. i said no. diamond flippers.', w: [0, 4, 8], pack: 'map' },
  { id: 'moon', name: 'the Moon', text: 'made it to the moon. it was quiet. pep was already here.', w: [0, 3, 4], pack: null },
  { id: 'unknown', name: '???', text: '', w: [0, 1, 1], pack: null, secret: true },
];
export const PLACE = Object.fromEntries(PLACES.map(p => [p.id, p]));

// souvenir id, name, rarity, frog's comment, places it can come from (null = anywhere)
export const RARITY = [['common', 70], ['rare', 22], ['epic', 7], ['legendary', 1]];
export const SOUVENIRS = [
  { id: 'souv_pebble', name: 'a pond pebble', rarity: 'common', text: "it's a rock. it's MY rock.", from: null },
  { id: 'souv_shell', name: 'a little shell', rarity: 'common', text: 'you can hear the pond in it. or my tummy.', from: null },
  { id: 'souv_photo', name: 'a trip photo', rarity: 'rare', text: 'me. on holiday. thumbs up. framed by me.', from: null },
  { id: 'souv_hard_hat', name: 'a miner hard hat', rarity: 'rare', text: 'safety first. fashion second. also first.', from: ['scrypt_mine'] },
  { id: 'souv_old_cd', name: 'an old CD-ROM', rarity: 'rare', text: '650 MB of pure 1998. probably a screensaver.', from: ['old_internet'] },
  { id: 'souv_duck_feather', name: 'a duck feather', rarity: 'epic', text: 'evidence.', from: ['duck_city'] },
  { id: 'souv_mini_miner', name: 'a tiny mining rig', rarity: 'epic', text: 'it blinks. it hums. it found 0 blocks. we love it anyway.', from: ['scrypt_mine', 'exchange'] },
  { id: 'souv_dragon_scale', name: 'a dragon scale', rarity: 'legendary', text: 'the dragon dropped it. i did not trade. it was a gift. we are frens now.', from: ['krakow_dragon'] },
  { id: 'souv_moon_dust', name: 'a jar of moon dust', rarity: 'legendary', text: 'tastes like nothing. very expensive nothing.', from: ['moon'] },
];
export const SOUVENIR = Object.fromEntries(SOUVENIRS.map(s => [s.id, s]));

const pickWeighted = (items, random) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (const [v, w] of items) { r -= w; if (r < 0) return v; }
  return items[items.length - 1][0];
};

export function placeWeights(length, pack) {
  const i = { short: 0, long: 1, grand: 2 }[length];
  if (i === undefined) return [];
  return PLACES.map(p => [p.id, p.w[i] * (pack && p.pack === pack ? 2 : 1)]).filter(([, w]) => w > 0);
}

// The souvenirs a place can give at a rarity, downgrading when the place has none (legendary -> epic -> ...).
export function souvenirFor(place, rarity, random) {
  const order = RARITY.map(r => r[0]);
  for (let i = order.indexOf(rarity); i >= 0; i--) {
    const options = SOUVENIRS.filter(s => s.rarity === order[i] && (!s.from || s.from.includes(place)));
    if (options.length) return options[Math.floor(random() * options.length)].id;
  }
  return null;
}

// Pure roll, the same rules as the SQL. random() in [0, 1).
export function rollTrip(length, pack, random = Math.random) {
  const len = LENGTHS[length];
  if (!len || (pack !== null && pack !== undefined && !Object.hasOwn(PACKS, pack))) return null;
  const place = pickWeighted(placeWeights(length, pack), random);
  let souvenir = null;
  if (place !== 'unknown' && random() < len.souvenirChance) {
    const rarities = length === 'short' ? RARITY.filter(([r]) => r !== 'legendary') : RARITY;
    souvenir = souvenirFor(place, pickWeighted(rarities, random), random);
  }
  return { place, souvenir, hours: len.hours };
}

// The postcard as the frog writes it on the card (the picture is postcard_<place>.png from the A12c pack).
export function postcardText(placeId, souvenirId) {
  const p = PLACE[placeId];
  if (!p) return null;
  if (p.secret) return { title: '???', lines: ['i don\'t remember where i was.', 'there were numbers. 0098. the TV knows.'] };
  const s = SOUVENIR[souvenirId];
  return { title: 'Greetings from ' + p.name, lines: [p.text, s ? 'p.s. i brought ' + s.name + '.' : 'p.s. no souvenir. i ate it.'] };
}

// What the diary should say about this return (pepegochi-diary.mjs, category "trip").
export const tripForDiary = (placeId, souvenirId) => PLACE[placeId]
  ? { place: PLACE[placeId].secret ? 'somewhere' : PLACE[placeId].name, item: SOUVENIR[souvenirId]?.name ?? null } : null;

// A trip as the server returns it: { trip_id, length, pack, started_at, return_at, place?, souvenir?, claimed_at }
// place/souvenir are only sent once the frog is back, so the browser cannot peek.
export function tripState(trip, now = Date.now()) {
  if (!trip || typeof trip.return_at !== 'string') return { status: 'home' };
  const back = Date.parse(trip.return_at);
  if (!Number.isFinite(back)) return { status: 'home' };
  if (trip.claimed_at) return { status: 'home' };
  if (now < back) return { status: 'away', leftMs: back - now, length: trip.length };
  return { status: 'back', place: trip.place ?? null, souvenir: trip.souvenir ?? null };
}
export const formatLeft = ms => { const total = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? h + ' h ' + m + ' min' : m + ' min'; };
