// A10: five new hand-off sequences, played once and returned to authoritative state.
// Repeated indices are intentional holds/easing, not extra PNGs.
export const EXPRESSIONS = {
  nuzzle: { base: 'tb_adult_sit', order: [1, 2, 3, 3, 2, 4], ms: 150 },
  welcome: { base: 'tb_adult_sit', order: [1, 2, 3, 4, 3, 4, 2], ms: 130 },
  curious: { base: 'tb_adult_sit', order: [1, 2, 2, 3, 4, 4, 3], ms: 160 },
  sulk: { base: 'tb_adult_sit', order: [1, 2, 3, 4, 4, 3, 2], ms: 160 },
  yawn: { base: 'tb_adult_sleepy', order: [1, 2, 3, 3, 2, 4, 4], ms: 180 },
};
export const expressionFrames = name => EXPRESSIONS[name].order.map(i => `taskbar/anim/tb_${name}_0${i}.png`);
export function expressionFor(view, action) {
  if (!view?.hasPet || !view.adult || view.warning) return null;
  const sprite = String(view.sprite || '').split('/').pop();
  if (sprite === 'tb_adult_sleepy.png') return action === 'hello' || action === 'how' ? 'yawn' : null;
  if (sprite !== 'tb_adult_sit.png') return null;
  if (['pet', 'familiar', 'fed', 'clean', 'rested', 'toyFavourite'].includes(action)) return 'nuzzle';
  if (['return', 'returnLong', 'grown', 'quizWin', 'played', 'play', 'gameWin', 'gameRecord', 'gameMoon', 'toyOkay', 'stamp', 'stampBatch'].includes(action)) return 'welcome';
  if (['annoyed', 'space', 'toyAgain', 'gameLoss'].includes(action)) return 'sulk';
  if (['hello', 'how', 'news', 'memories', 'hover', 'invite', 'favourite', 'gameDone', 'desktopFirefly', 'desktopTV', 'desktopBin', 'desktopGames', 'desktopFind', 'desktopGuesser', 'desktopNotes', 'desktopNerds', 'secret'].includes(action)) return 'curious';
  return null;
}
