// Public, deliberately imprecise clues for already-live Passport secrets.
// No answers, trigger commands, claim calls, or unpublished quest content belong here.
export const TRAILS = [
  ['wrong_frog', 'The Wrong Frog', 'Not every frog in the pond belongs here.', 'An ordinary-looking part of the desktop may be less ordinary than it seems.'],
  ['why_tho', 'Why Do You Need This?', 'Some addresses make the pond surprisingly curious. No payment is needed.', 'Even the frog who built this place has a little corner of the pond.'],
  ['magic_word', 'The Magic Word', 'Someone around here has a terrible memory.', 'Old scraps and forgotten writing may be more helpful than a conversation.'],
  ['bsod_fren', 'Blue Screen of Fren', 'Even computers have bad pond days.', 'The older habits of this operating system might be worth investigating.'],
  ['midnight_fren', 'Midnight Fren', 'The pond is not quite the same after dark.', 'Some things only reveal themselves when the desktop is left to its own devices.'],
  ['nerd_alert', 'Nerds Only', 'The serious frogs leave strange little notes.', 'Read what others might skip, especially in the more technical corners.'],
  ['bali_dreamer', 'Bali Dreamer', 'A distant shore is closer than you think.', 'Look at the things a collector is still waiting for.'],
  ['happy_fren', 'Happy Fren', 'Small gestures can change the mood of the pond.', 'Think of how people express happiness when they have only words and punctuation.'],
  ['born_to_fren', 'Born to Fren', 'Our pond has a language of its own.', 'Listen to how the frens greet and address each other.'],
  ['find_fren', 'Looking Glass', 'A curious frog does not only look at the surface.', 'PondOS has its own way of helping you look for things.'],
  ['address_check', 'Trust, But Verify', 'A careful frog always checks twice. No payment is needed.', 'There is a way to inspect a destination without sending any coins.'],
  ['share_fren', 'Share Fren', 'A good little adventure is worth telling someone about.', 'When a game gives you a result, look beyond the score itself.'],
];

export function rumorProgress(state, time = Date.now()) {
  if (state?.signed_in !== true || state.preview || !Array.isArray(state.secrets)) return null;
  const earned = new Set(state.secrets.filter(s => typeof s?.discovered_at === 'string' && Number.isFinite(Date.parse(s.discovered_at))).map(s => s.id));
  const found = TRAILS.filter(([id]) => earned.has(id)).map(([, title]) => title);
  const remaining = TRAILS.filter(([id]) => !earned.has(id));
  // One suggested trail per UTC day, changing immediately after the player finds it.
  // This is a UX choice, not a secret unlock rule or authorization boundary.
  const day = Math.floor(time / 86400000);
  const trail = remaining.length ? remaining[((day % remaining.length) + remaining.length) % remaining.length] : null;
  return { found, total: TRAILS.length, hint: trail?.[2] || null, detail: trail?.[3] || null };
}

// Only an explicit conversation request reads the current account's existing Passport RPC.
// A short in-memory cache prevents rapid repeated clicks. Neither it nor the UI awards anything.
export function createRumorReader({ session, rpc, now = () => Date.now() }) {
  let cache = null, pending = null, version = 0;
  const owner = () => { const s = session(); return s?.discord && s.userId ? s.userId : null; };
  function invalidate() { version++; cache = null; pending = null; }
  async function read() {
    const id = owner();
    if (!id) return { status: 'signed-out' };
    if (cache?.id === id && now() - cache.at >= 0 && now() - cache.at < 15000) return { status: 'ok', progress: rumorProgress(cache.state, now()) };
    if (pending?.id === id) return pending.promise;
    const ticket = ++version;
    const promise = (async () => {
      try {
        const state = await Promise.resolve().then(() => rpc('gry_passport_state', {}));
        if (version !== ticket || owner() !== id) return { status: 'stale' };
        const progress = rumorProgress(state, now());
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
