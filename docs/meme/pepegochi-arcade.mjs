const paths = { yeet: '/games/yeet.html', sweeper: '/games/pepe-sweeper.html', goldhook: '/games/gold-hook.html' };
const outcomes = { yeet: ['complete', 'moon'], sweeper: ['win', 'loss'], goldhook: ['win', 'loss'] };
export function createArcadeObserver() {
  let rounds = new WeakMap();
  return {
    reset() { rounds = new WeakMap(); },
    accept(event, { origin, frames, owner, life }) {
      const d = event.data;
      if (!owner || !life || event.origin !== origin || !d || d.type !== 'pondos:arcade-round' ||
          !Object.hasOwn(paths, d.game) || typeof d.run !== 'string' || d.run.length < 1 || d.run.length > 80) return null;
      const frame = frames.find(f => f.contentWindow === event.source);
      if (!frame) return null;
      let url; try { url = new URL(frame.src, origin); } catch { return null; }
      if (url.origin !== origin || url.pathname !== paths[d.game]) return null;
      if (d.phase === 'start') {
        if (rounds.get(event.source)?.run === d.run) return null;
        rounds.set(event.source, { run: d.run, game: d.game, owner, life, ended: false }); return null;
      }
      const round = rounds.get(event.source);
      if (d.phase !== 'finish' || !round || round.ended || round.run !== d.run || round.game !== d.game ||
          round.owner !== owner || round.life !== life || !outcomes[d.game].includes(d.outcome) || typeof d.record !== 'boolean') return null;
      round.ended = true;
      const action = d.outcome === 'moon' ? 'gameMoon' : d.record ? 'gameRecord' : d.outcome === 'win' ? 'gameWin' : d.outcome === 'loss' ? 'gameLoss' : 'gameDone';
      const memory = d.outcome === 'moon' ? 'moon' : d.record ? 'record' : d.outcome === 'win' ? 'win' : null;
      return { action, memory };
    },
  };
}
