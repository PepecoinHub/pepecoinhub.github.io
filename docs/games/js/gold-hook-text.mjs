// Every Pepe Gold Hook UI string in one place.
const n = (v) => Number(v).toLocaleString('en-US');

export const T = {
  windowTitle: 'Pepe Gold Hook',
  hintBar: 'Space / click the mine: drop the hook  ·  D: dynamite  ·  Esc: pause',
  canvasLabel: 'Pepe Gold Hook mine. Space, a click or a tap drops the hook. D uses dynamite. Escape pauses.',
  loading: 'Loading the mine…',
  errorTitle: 'The game could not start',
  errorManifestHint: 'The game files did not load. Check your connection and reload the page.',
  errorAssetsHint: 'Missing or broken picture files:',

  // main menu
  tagline: '20 levels, one hook. Dig up gold, spend it on upgrades, go deeper.',
  continueRun: (level, money) => `Continue · level ${level} · ${n(money)} PEP`,
  newGame: 'New game',
  howTo: 'How to play',
  howToText: [
    'The hook swings over the mine. Press Space, click or tap the mine to drop it, and it reels in the first thing it hits.',
    'Reach the level goal before the clock runs out. Heavy loot comes up slowly; rocks are worth almost nothing.',
    'Every level has less time, heavier loot and more rocks. Between levels, spend the PEP you dug up in the shop.',
    'Dynamite (D, or the dynamite button) blows up whatever is on the hook, so a bad catch costs you less time.',
    'Miss a goal and the run is over. Game PEP are points, not real coins.',
  ],
  highScores: 'High scores',
  myStats: 'My stats',
  statsLocal: (s) => s.runs ? `On this device: best ${n(s.best)} PEP, best level ${s.level}, ${s.runs} run${s.runs === 1 ? '' : 's'}.` : 'On this device: no runs yet.',
  statsAccount: (s) => `On your Discord account: best ${n(s.best_score)} PEP, best level ${s.best_level}, ${s.runs} run${s.runs === 1 ? '' : 's'}, ${s.finished} finished, ${n(s.total_pep)} PEP dug up in total.`,
  statsAccountEmpty: 'On your Discord account: no runs sent yet. Submit a score to save it.',
  statsGuest: 'Sign in with Discord in PEP Games and submit a score to keep your stats on your account.',
  statsLoading: 'Loading your account…',

  // before a level
  levelTitle: (L, max) => `Level ${L} of ${max}`,
  levelGoal: (target, secs) => `Goal: ${n(target)} PEP in ${secs} seconds`,
  levelNotes: (mods, heavier) => {
    const parts = [];
    if (heavier) parts.push('Loot is heavier down here.');
    if (mods.strength) parts.push(`Strong arms ${mods.strength}/3.`);
    if (mods.reel) parts.push(`Fast reel ${mods.reel}/2.`);
    if (mods.dynamite) parts.push(`Dynamite ×${mods.dynamite}.`);
    if (mods.extraSec) parts.push(`Pocket watch: +${mods.extraSec} s.`);
    return parts.join(' ');
  },
  go: 'Dig!',

  // playing
  fire: 'Drop hook',
  dynamite: (k) => `×${k}`,
  dynamiteLabel: (k) => `Dynamite, ${k} left`,
  pause: 'Pause',
  pausedTitle: 'Paused',
  pausedText: 'The clock is stopped. Going to the menu saves your run at the last shop; this level starts over.',
  resume: 'Resume',
  exit: 'Main menu',

  // level cleared and shop
  clearedTitle: (L) => `Level ${L} cleared!`,
  clearedLine: (score, target) => `${n(score)} PEP dug up (goal ${n(target)})`,
  clearedWallet: (money) => `Wallet: ${n(money)} PEP`,
  toShop: 'To the shop',
  shopTitle: (L) => `Shop · before level ${L}`,
  shopWallet: (money) => `Wallet: ${n(money)} PEP`,
  items: {
    strength: { name: 'Strong arms', icon: '💪', text: 'Loot comes up 20 % faster per level.' },
    reel: { name: 'Fast reel', icon: '🎣', text: 'The hook flies out and comes back empty 15 % faster per level.' },
    dynamite: { name: 'Dynamite', icon: null, text: 'Press D while reeling in to blow up a bad catch. Carry up to 3.' },
    clock: { name: 'Pocket watch', icon: '⏱️', text: '+10 seconds on the next level.' },
  },
  owned: (item, run) => ({ strength: `${run.strength}/3`, reel: `${run.reel}/2`, dynamite: `×${run.dynamite}`, clock: run.clock ? 'ready' : '' })[item],
  buy: (price) => `Buy · ${n(price)}`,
  maxed: 'Maxed',
  nextLevel: (L) => `Level ${L} →`,
  saveAndMenu: 'Save & menu',

  // end of the run
  overTitle: 'Game over',
  winAllTitle: 'All 20 levels cleared!',
  endLine: (total, level) => `${n(total)} PEP dug up · reached level ${level}`,
  overText: (score, target) => `You dug up ${n(score)} PEP; the goal was ${n(target)}.`,
  winAllText: 'Pepe is the richest frog in the pond.',
  newBest: (total) => `New best on this device: ${n(total)} PEP!`,
  best: (total) => `Best on this device: ${n(total)} PEP`,
  share: 'Share',
  shareText: (total, level, finished) => finished
    ? `I cleared all 20 levels of Pepe Gold Hook and dug up ${n(total)} PEP! ⛏️🐸`
    : `I reached level ${level} in Pepe Gold Hook and dug up ${n(total)} PEP! ⛏️🐸`,
  shared: 'Shared!',
  copied: 'Copied to the clipboard.',
  shareFailed: 'Sharing is not available here.',
  again: 'New game',
  menu: 'Main menu',

  // high scores
  submitAsDiscord: (score) => `Send ${n(score)} PEP to the High Scores as your Discord name ✓`,
  nickLabel: 'Nickname',
  nickPlaceholder: '2-20 letters',
  submit: 'Submit score',
  sending: 'Sending…',
  saved: (nick, verified, place) => `Saved as ${nick}${verified ? ' ✓' : ''}. Place #${place}.${verified ? ' Your stats are on your account.' : ''}`,
  discordNote: 'Sign in with Discord in PEP Games to get a ✓ and keep your stats on your account.',
  top10: 'Top 10',
  loadingTop: 'Loading…',
  emptyTop: 'No scores yet. Be the first frog.',
  soon: 'High scores are coming soon.',

  // screen reader
  srLevel: (L, target, secs) => `Level ${L}. Goal ${target} PEP in ${secs} seconds.`,
  srScore: (points, total) => `Plus ${points}. ${total} PEP.`,
  srEmpty: 'Empty hook.',
  srDynamite: (left) => `Boom. ${left} dynamite left.`,
  srTime: (s) => `${s} seconds left.`,
  srPaused: 'Paused.',
  srResumed: 'Resumed.',
  srCleared: (L) => `Level ${L} cleared.`,
  srOver: (total, level) => `Game over at level ${level}. ${total} PEP.`,
  srBought: (name, money) => `Bought ${name}. ${money} PEP left.`,
  srStats: (score, target, secs) => `${score} of ${target} PEP. Time ${secs} s.`,
};
