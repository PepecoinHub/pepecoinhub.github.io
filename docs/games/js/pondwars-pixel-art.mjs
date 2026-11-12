import { STATES, validateManifest } from './pondwars-animation.mjs?v=20261112pixel';

// QA metadata is separate from the supplied, unchanged artist manifest.
export function compilePixelManifest(source, anchors) {
  if (!validateManifest(source) || source.frameSize[0] !== 128 || source.frameSize[1] !== 128 ||
      STATES.some(state => !source.clips[state]) || anchors?.version !== 1 || !Array.isArray(anchors.frames)) throw new Error('Invalid pixel QA manifest');
  const measured = new Map(anchors.frames.map(f => [f.rect.join(','), f]));
  let count = 0;
  const pair = a => Array.isArray(a) && a.length === 2 && a.every(n => Number.isFinite(n) && n >= 0 && n <= 128);
  const clips = Object.fromEntries(Object.entries(source.clips).map(([state, clip]) => [state, { ...clip,
    frames: clip.frames.map((frame, index) => {
      count++;
      const q = measured.get(frame.rect.join(',')), [x,y,w,h] = frame.rect;
      if (frame.foot[0] !== 64 || frame.foot[1] !== 122 || !q || q.state !== state || q.index !== index || !pair(q.head) || !pair(q.hand) ||
          !Array.isArray(q.helmetRect) || q.helmetRect.length !== 4 || !q.helmetRect.every(Number.isFinite) ||
          q.helmetRect[0] < x || q.helmetRect[1] < y || q.helmetRect[2] <= 0 || q.helmetRect[3] <= 0 ||
          q.helmetRect[0]+q.helmetRect[2] > x+w || q.helmetRect[1]+q.helmetRect[3] > y+h ||
          q.head[0] !== q.helmetRect[0]-x+q.helmetRect[2]/2 || q.head[1] !== q.helmetRect[1]-y+q.helmetRect[3]/2) throw new Error('Invalid pixel frame anchors');
      return { ...frame, hand: q.hand, head: q.head, helmetRect: q.helmetRect };
    }) }]));
  if (count !== 49 || measured.size !== count || anchors.frames.length !== count) throw new Error('Pixel frame count mismatch');
  return { ...source, clips };
}

// Authored limbs/face already contain motion. Keep only the existing KO fade.
export const authoredPose = p => ({ ...p, dx: 0, dy: 0, rotation: 0, sx: 1, sy: 1 });
export const clipDuration = (manifest, state) => manifest.clips[state].frames.length / manifest.clips[state].fps;
export function pixelHelmet(frame) {
  const scale = 64 / frame.rect[3], [,,w,h] = frame.helmetRect;
  const center = { x: (frame.head[0]-frame.foot[0])*scale, y: (frame.head[1]-frame.foot[1])*scale };
  return { imageKey: 'pixel-v04', rect: frame.helmetRect, width: w*scale, height: h*scale, center,
    x: center.x-w*scale/2, y: center.y-h*scale/2 };
}
