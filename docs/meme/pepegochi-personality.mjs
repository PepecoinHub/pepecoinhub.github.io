export const TOYS = {
  ball: { name: 'ball', label: 'Roll the ball' },
  duck: { name: 'rubber duck', label: 'Squeak the duck' },
  cap: { name: 'bottle cap', label: 'Toss the bottle cap' },
};
export const MEMORIES = {
  toy: 'You found my favourite toy. Keep that information out of the group chat.',
  win: 'Our first arcade win together. Your inputs. My executive supervision.',
  record: 'I watched you beat a personal best. Briefly considered clapping. Did clap.',
  moon: 'We saw the Moon landing together. Finally, a rock with a decent backstory.',
};
export function favouriteToy(identity) {
  let hash = 0; for (const c of String(identity)) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) | 0;
  return Object.keys(TOYS)[(hash >>> 0) % 3];
}
export const healthyCompanion = view => !!view?.hasPet && view.adult && !view.warning && view.sprite === 'taskbar/tb_adult_sit.png';
// Froglets have their own sprite and may play without ever pretending to be adults.
export const playableCompanion = view => (healthyCompanion(view) || (!!view?.hasPet && !view.warning && view.motion === 'froglet' && view.playReady === true));
