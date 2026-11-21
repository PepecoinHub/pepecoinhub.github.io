// PepeGochi's diary (A12, owner request 2026-11-21): "what did my frog do while I was away?"
// Nothing runs in the background. When the owner comes back, the time away + a seed decide 0-3 new entries, written
// by the frog in its own voice. Some entries follow real PEP data from the hub (price change, ATH, blocks, hashrate).
// Cosmetic only: no reward, no RPC, no care state. The diary lives in this browser (per account and per frog life),
// like the frog's notes (pepegochi-notes.mjs). Text owner-approved in the A12 spec; the owner may edit the lines.

export const DAY = 86400000;
const HOUR = 3600000;

// [id, category, text]. Variables: {days} {change} {block} {fren} {place} {item}
export const ENTRIES = [
  // first page of a new frog
  ['first_1', 'first', 'a human adopted me. it has a mouse. i am suspicious of the mouse.'],
  // missing the owner
  ['miss_1', 'miss', 'my fren came back. i pretended i was busy. i was not busy.'],
  ['miss_2', 'miss', '{days} days alone. i talked to the lemon tree. the lemon tree did not talk back. rude.'],
  ['miss_3', 'miss', 'counted the pixels on the ceiling. 4,212. you were gone for all of them.'],
  ['miss_4', 'miss', 'i saved you a fly. then i ate the fly. sorry. it was day 3.'],
  ['miss_5', 'miss', 'practiced my "oh hi didn\'t see you there" face. nailed it.'],
  ['miss_6', 'miss', 'the duck said you left forever. the duck lies. you are here. checkmate duck.'],
  ['miss_7', 'miss', 'left the light on for you. electricity bill: 0.3 PEP. worth it.'],
  // PEP market (real data)
  ['up_1', 'marketUp', 'price went up {change}. i did a little dance. the duck pretended not to see.'],
  ['up_2', 'marketUp', '{change} today. i am not selling. i am a frog. frogs don\'t sell. frogs ribbit.'],
  ['up_3', 'marketUp', 'whale bought a lot. i waved at the whale. the whale did not wave back.'],
  ['down_1', 'marketDown', 'bought the dip. it dipped again. bought that dip too. i am now 90% dip.'],
  ['down_2', 'marketDown', '{change} today. i am not selling. i am a frog. frogs don\'t sell. frogs ribbit.'],
  ['down_3', 'marketDown', 'red candles everywhere. i put on sunglasses so i can\'t see them. strategy.'],
  ['down_4', 'marketDown', 'someone on the internet said pep is dead. i checked. it is not dead. it is just napping. like me.'],
  ['flat_1', 'marketFlat', 'checked the chart 47 times. it did not move. maybe if i blink it will move.'],
  ['ath_1', 'ath', 'new ATH!!! i screamed into a pillow. neighbors complained. worth it.'],
  // the chain (real data)
  ['chain_1', 'block', 'block {block}. i was there. i will tell my tadpoles about it.'],
  ['chain_2', 'hash', 'hashrate went up. somewhere a miner is very warm. i am jealous. it is cold in the pond.'],
  ['chain_3', 'daily', 'tried to mine a block with my tongue. 0 hashes. 1 headache.'],
  ['chain_4', 'daily', 'read the whitepaper. understood the word "pepe". progress.'],
  // the duck
  ['duck_1', 'duck', 'the duck knows something. i don\'t trust him.'],
  ['duck_2', 'duck', 'asked the duck what he wants. he said "quack". suspicious. very suspicious.'],
  ['duck_fed', 'duck', 'i think the duck is a fed.'],
  ['duck_4', 'duck', 'had a staring contest with the duck. 6 hours. it was a draw. he doesn\'t blink. HE DOESN\'T BLINK.'],
  ['duck_5', 'duck', 'the duck sold the bottom. i didn\'t see it but i know.'],
  ['duck_6', 'duck', 'truce with the duck. lasted 4 minutes. he started it.'],
  // gentle neglect (no guilt-tripping)
  ['need_hunger', 'needHunger', 'tummy made a sound like a dial-up modem. pls food.'],
  ['need_hygiene', 'needHygiene', 'i am 40% frog and 60% dust right now. a bath would be nice. no pressure.'],
  ['need_mood', 'needMood', 'so bored i alphabetized my flies. a, b, also b.'],
  ['need_energy', 'needEnergy', 'tried to cook. set the TV on fire. TV is fine. i am not allowed to cook.'],
  // everyday filler
  ['daily_1', 'daily', 'watched PEP TV for 6 hours. learned nothing. 10/10.'],
  ['daily_2', 'daily', 'drew a masterpiece in PEPaint. it is a circle. it is a very good circle.'],
  ['daily_3', 'daily', 'tried to catch the mouse cursor. it is fast. too fast. i will train.'],
  ['daily_4', 'daily', 'fell asleep on the desktop. woke up with a recycle bin icon on my face.'],
  ['daily_5', 'daily', 'touched grass. it was ok. 6/10. would not touch again.'],
  ['daily_6', 'daily', 'had a thought. lost it. it was a good one i think.'],
  ['daily_7', 'daily', 'wrote a poem. "ribbit. ribbit. ribbit." it\'s about the human condition.'],
  ['daily_8', 'daily', 'the lemon tree grew 1 leaf. we are very proud of the lemon tree.'],
  ['daily_9', 'daily', 'found a coin under the couch. it was not PEP. disappointed but not surprised.'],
  ['daily_10', 'daily', 'practiced being a houseplant. nobody noticed. too good.'],
  ['daily_11', 'daily', 'someone in the LAN chat said gm. i said gm back. i have friends now.'],
  ['daily_monday', 'monday', 'monday. i will not be doing anything today. this is my protest.'],
  // seasons
  ['season_pep', 'pepBirthday', 'it\'s my coin\'s birthday! i made a cake. ate the cake. no cake left. happy birthday pep.'],
  ['season_xmas', 'christmas', 'christmas. i asked santa for 1 million PEP. he said "we\'ll see". that\'s a yes.'],
  ['season_halloween', 'halloween', 'halloween. i dressed up as the duck. the duck was not amused. it was the best day ever.'],
  // after a trip (pepegochi-trips.mjs)
  ['trip_1', 'trip', 'back from {place}. brought you {item}. you\'re welcome.'],
  ['trip_2', 'trip', 'went to {place}. my legs are tired. my heart is full. my backpack is sandy.'],
  ['trip_3', 'trip', 'home again. {place} was nice but the pond has my bed. and you. mostly the bed.'],
  // after rare events (pepegochi-rare.mjs); the rare id is the category
  ['rare_ufo', 'rare:ufo', 'saw an UFO behind the window. it had a pepe sticker. i think they are frens.'],
  ['rare_tv', 'rare:tv_signal', 'the TV showed something weird at night. just numbers. i wrote them down.'],
  ['rare_tinfoil', 'rare:tinfoil', 'made a tinfoil hat. now the duck can\'t read my thoughts. he looks worried.'],
  ['rare_lemon', 'rare:golden_lemon', 'THE LEMON TREE GREW A GOLDEN LEMON. i am not touching it. it is too powerful.'],
  ['rare_duck', 'rare:duck_moved', 'the duck moved 2 cm to the left while i slept. i have proof. i drew a line.'],
  ['rare_spy', 'rare:spy_duck', 'another duck looked through the window. sunglasses. notepad. they are organised now.'],
  ['rare_sleepwalk', 'rare:sleepwalk', 'woke up on the desktop. the icons were in a heart shape. i did not do that. i did that.'],
  ['rare_phone', 'rare:phone', 'the old phone rang. "wrong number" they said. or is it.'],
  ['rare_flies', 'rare:fly_rain', 'it rained flies today. best day of my life. do not tell the other days.'],
  ['rare_truce', 'rare:truce', 'the duck and i watched TV together. it was nice. tomorrow we are enemies again.'],
];
export const ENTRY = Object.fromEntries(ENTRIES.map(([id, cat, text]) => [id, { id, cat, text }]));

// Opened at 3:00-3:59 local time: the frog notices (also the hidden "Snoop" stamp in the spec).
export const SNOOP_LINE = 'why are you reading my diary at 3am. go to sleep.';
export const isSnoopHour = hour => hour === 3;

// ---------- seeded randomness (same input -> same diary page) ----------
export function hash32(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// How many new entries a return earns (owner spec): under 2 h none, then 1, 2 or 3.
export function entryCount(awayMs) {
  if (!Number.isFinite(awayMs) || awayMs < 2 * HOUR) return 0;
  if (awayMs < 12 * HOUR) return 1;
  if (awayMs < 48 * HOUR) return 2;
  return 3;
}
// "Day 24": days since the frog was adopted, counted from 1.
export const frogDay = (adoptedAt, now) => Number.isFinite(adoptedAt) && now >= adoptedAt ? Math.floor((now - adoptedAt) / DAY) + 1 : 1;

const pct = n => (n > 0 ? '+' : '') + (Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + '%';
export function fill(text, vars = {}) {
  return text.replace(/\{(days|change|block|fren|place|item)\}/g, (m, k) => vars[k] === undefined || vars[k] === null ? m : String(vars[k]));
}

// Seasons by the owner's local calendar date (month 1-12).
export function seasonOf({ month, day } = {}) {
  if (month === 1 && day === 30) return 'pepBirthday';
  if (month === 12 && (day === 24 || day === 25 || day === 26)) return 'christmas';
  if (month === 10 && day === 31) return 'halloween';
  return null;
}

// Categories the situation allows, with weights. Forced ones are written first, in this order.
export function situation(ctx) {
  const forced = [], pool = [];
  const { market = {}, chain = {}, needs = {}, rare = null, trip = null, date = {}, away = 0, first = false } = ctx;
  if (first) forced.push('first');
  if (rare) forced.push('rare:' + rare);
  if (trip) forced.push('trip');
  const season = seasonOf(date);
  if (season) forced.push(season);
  if (away >= 48 * HOUR) forced.push('miss');
  const change = Number(market.change24h);
  if (market.ath === true) pool.push(['ath', 6]);
  if (Number.isFinite(change)) {
    if (change >= 10) pool.push(['marketUp', 5]);
    else if (change <= -10) pool.push(['marketDown', 5]);
    else if (Math.abs(change) < 1.5) pool.push(['marketFlat', 1]);
  }
  if (Number.isFinite(chain.height) && chain.height > 0) pool.push(['block', 1]);
  if (Number(chain.hashChange) >= 20) pool.push(['hash', 3]);
  for (const n of ['hunger', 'hygiene', 'mood', 'energy']) if (Number(needs[n]) < 35) pool.push(['need' + n[0].toUpperCase() + n.slice(1), 5]);
  if (away >= 12 * HOUR && !forced.includes('miss')) pool.push(['miss', 2]);
  if (date.weekday === 1) pool.push(['monday', 1]);
  pool.push(['duck', 3], ['daily', 4]);
  return { forced, pool };
}

// The new page(s): pure. ctx = { seed, adoptedAt, lastSeen, now, recent: [{id, at}], fren, market:{change24h, ath},
// chain:{height, hashChange}, needs:{hunger..}, rare, trip:{place, item}, date:{month, day, weekday}, first }
export function writeEntries(ctx) {
  const away = Number.isFinite(ctx.lastSeen) ? ctx.now - ctx.lastSeen : 0;
  let count = ctx.first ? 1 : entryCount(away);
  if (!ctx.first && (ctx.rare || ctx.trip) && count === 0) count = 1;   // a rare event or a trip is always told
  if (!count) return [];
  const random = rng(ctx.seed >>> 0);
  const blocked = new Set((ctx.recent || []).filter(r => ctx.now - r.at < 30 * DAY).map(r => r.id));
  const { forced, pool } = situation({ ...ctx, away });
  const used = new Set();
  const change = Number(ctx.market?.change24h);
  const days = Math.floor(away / DAY);
  const vars = { days: days >= 2 ? days : null, change: Number.isFinite(change) ? pct(change) : null,
    block: Number.isFinite(ctx.chain?.height) ? Number(ctx.chain.height).toLocaleString('en-US') : null,
    fren: ctx.fren || 'fren', place: ctx.trip?.place ?? null, item: ctx.trip?.item ?? null };
  // an entry only fits when every variable it uses is known ("1 days alone" or "brought you null" never happen)
  const fits = text => [...text.matchAll(/\{([a-z]+)\}/g)].every(m => vars[m[1]] !== null && vars[m[1]] !== undefined);
  const pick = cat => {
    const options = ENTRIES.filter(([id, c, text]) => c === cat && !blocked.has(id) && !used.has(id) && fits(text));
    if (!options.length) return null;
    return options[Math.floor(random() * options.length)];
  };
  const out = [];
  for (const cat of forced) { if (out.length >= count) break; const e = pick(cat); if (e) { used.add(e[0]); out.push(e); } }
  let guard = 0;
  while (out.length < count && guard++ < 40) {
    const live = pool.filter(([cat]) => ENTRIES.some(([id, c, text]) => c === cat && !blocked.has(id) && !used.has(id) && fits(text)));
    if (!live.length) break;
    let r = random() * live.reduce((s, [, w]) => s + w, 0), cat = live[0][0];
    for (const [c, w] of live) { r -= w; if (r < 0) { cat = c; break; } }
    const e = pick(cat); if (e) { used.add(e[0]); out.push(e); }
  }
  const day = frogDay(ctx.adoptedAt, ctx.now);
  return out.map(([id, , text]) => ({ id, day, at: ctx.now, text: fill(text, vars) }));
}

export const diaryKey = (owner, lifeId) => owner && lifeId ? 'pepegochi:diary:v1:' + owner + ':' + lifeId : null;
const KEEP = 365;

// Browser-local diary for one owner and one frog life.
export function createDiary({ storage, now = () => Date.now() } = {}) {
  let key = null, book = { seen: 0, pages: [], read: 0 };
  const save = () => { if (key && storage) try { storage.setItem(key, JSON.stringify(book)); } catch {} };
  function load(owner, lifeId) {
    const next = diaryKey(owner, lifeId);
    if (next === key) return !!key;
    key = next; book = { seen: 0, pages: [], read: 0 };
    if (!key) return false;
    try {
      const raw = JSON.parse(storage?.getItem(key) || 'null');
      if (raw && typeof raw === 'object') book = {
        seen: Number.isFinite(raw.seen) ? raw.seen : 0,
        read: Number.isFinite(raw.read) ? raw.read : 0,
        pages: Array.isArray(raw.pages) ? raw.pages.filter(p => p && typeof p.id === 'string' && Object.hasOwn(ENTRY, p.id) &&
          Number.isFinite(p.day) && Number.isFinite(p.at) && typeof p.text === 'string').slice(-KEEP) : [],
      };
    } catch {}
    return true;
  }
  // Called when the owner opens PondOS with a living frog. Returns the fresh pages (maybe none).
  function visit(owner, lifeId, ctx = {}) {
    if (!load(owner, lifeId)) return [];
    const t = now();
    const first = book.pages.length === 0 && book.seen === 0;
    const fresh = writeEntries({ ...ctx, now: t, first, lastSeen: book.seen || null,
      seed: hash32([owner, lifeId, book.seen, Math.floor(t / HOUR)].join('|')),
      recent: book.pages.map(p => ({ id: p.id, at: p.at })) });
    book.pages.push(...fresh); book.pages = book.pages.slice(-KEEP); book.seen = t; save();
    return fresh;
  }
  // Still here: refresh "last seen" without writing, so a long session does not count as time away.
  function touch() { if (key) { book.seen = now(); save(); } }
  return {
    visit, touch,
    pages: () => book.pages.slice(),
    unread: () => Math.max(0, book.pages.length - book.read),
    markRead() { book.read = book.pages.length; save(); },
    totalRead: () => book.read,
    reset() { key = null; book = { seen: 0, pages: [], read: 0 }; },
  };
}
