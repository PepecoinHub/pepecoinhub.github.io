// The clues PepeGochi gives for the already-live Passport secrets (pepegochi-notes.mjs decides when).
// Owner rule (byl, 2026-11-20): gentle, not obvious, but something a curious player can work out.
// [id, title as in passport-catalog.json, the clue]
export const TRAILS = [
  ['wrong_frog', 'The Wrong Frog', 'People throw away the strangest things. Among the paper-hands leftovers lies a shortcut to a frog who is not me. Have a look before somebody empties it.'],
  ['why_tho', 'Why Do You Need This?', 'The one who built this pond has a little corner where they talk about themselves. There is a long string there that starts with a P. Taking it home with you, even without sending anything, makes the pond curious.'],
  ['magic_word', 'The Magic Word', 'A forgetful frog wrote a few words on a crumpled note and threw it away. Written down, words like that do nothing. Say one of them to the desktop instead.'],
  ['bsod_fren', 'Blue Screen of Fren', 'Old computers had one command every uncle warned you about: the one that wipes the first drive. PondOS is old-fashioned enough to answer if you ask it. Nothing is really erased, promise.'],
  ['midnight_fren', 'Midnight Fren', 'When the clock is close to midnight and you leave the desktop alone for a while, the pond starts to dream. Some frogs only come out in that dream.'],
  ['nerd_alert', 'Nerds Only', 'There is a folder for the very serious frogs. Everybody opens the folder. Almost nobody opens the file inside that asks to be read.'],
  ['bali_dreamer', 'Bali Dreamer', 'In your Fren Passport there is a ticket to a faraway island that is still locked. Tickets are meant to be touched, even before the trip.'],
  ['happy_fren', 'Happy Fren', 'In the LAN Party chat, a smile does not need a face. Two keys are enough.'],
  ['born_to_fren', 'Born to Fren', 'Everybody in this pond calls each other by the same little word. Say it in the LAN Party chat at least once, fren.'],
  ['find_fren', 'Looking Glass', 'There is a magnifying glass in the Start menu. Ask it for anything, and then actually go where it points.'],
  ['address_check', 'Trust, But Verify', 'Before coins go anywhere, a careful frog checks where they are going. There is a tool here just for that. Give it a real PEP address, the rich list has plenty.'],
  ['share_fren', 'Share Fren', 'After a round of Pepe Guesser the score is only half of the fun. Telling somebody how it went is the other half.'],
];

// What the Secret Journal shows: the live secrets this account has found. No awards, read only.
export function rumorProgress(state) {
  if (state?.signed_in !== true || state.preview || !Array.isArray(state.secrets)) return null;
  const earned = new Set(state.secrets.filter(s => typeof s?.discovered_at === 'string' && Number.isFinite(Date.parse(s.discovered_at))).map(s => s.id));
  const hit = TRAILS.filter(([id]) => earned.has(id));
  return { found: hit.map(([, title]) => title), foundIds: hit.map(([id]) => id), total: TRAILS.length };
}

export function createRumorReader({ session, rpc, now = () => Date.now() }) {
  let cache = null, pending = null, version = 0;
  const owner = () => { const s = session(); return s?.discord && s.userId ? s.userId : null; };
  function invalidate() { version++; cache = null; pending = null; }
  async function read() {
    const id = owner();
    if (!id) return { status: 'signed-out' };
    if (cache?.id === id && now() - cache.at >= 0 && now() - cache.at < 15000) return { status: 'ok', progress: rumorProgress(cache.state) };
    if (pending?.id === id) return pending.promise;
    const ticket = ++version;
    const promise = (async () => {
      try {
        const state = await Promise.resolve().then(() => rpc('gry_passport_state', {}));
        if (version !== ticket || owner() !== id) return { status: 'stale' };
        const progress = rumorProgress(state);
        if (!progress) return { status: 'unavailable' };
        cache = { id, at: now(), state: { signed_in: true, secrets: state.secrets } };
        return { status: 'ok', progress };
      } catch {
        return { status: version === ticket && owner() === id ? 'unavailable' : 'stale' };
      } finally {
        if (version === ticket) pending = null;
      }
    })();
    pending = { id, promise };
    return promise;
  }
  return { read, invalidate };
}
