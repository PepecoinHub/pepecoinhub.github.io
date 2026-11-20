// Cosmetic reactions to confirmed Passport results. No storage, RPC or award authority.
export function createSiteEventObserver() {
  let scope = null;
  const seen = new Set();
  function reset() { scope = null; seen.clear(); }
  function accept(event, { owner, life, hasPet } = {}) {
    if (!owner || !life || !hasPet) return null;
    const next = JSON.stringify([owner, life]);
    if (next !== scope) { reset(); scope = next; }
    if (event?.owner !== owner || !['stamp', 'secret'].includes(event.kind) ||
        !Array.isArray(event.ids)) return null;
    const ids = [...new Set(event.ids.slice(0, 64).filter(id =>
      typeof id === 'string' && /^[a-z0-9_]{1,64}$/i.test(id)))];
    const fresh = ids.filter(id => !seen.has(event.kind + ':' + id));
    for (const id of fresh) seen.add(event.kind + ':' + id);
    if (!fresh.length) return null;
    return event.kind === 'secret' ? 'secret' : fresh.length > 1 ? 'stampBatch' : 'stamp';
  }
  return { accept, reset };
}
