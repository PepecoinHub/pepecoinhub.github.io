// Loads manifest.json and the pictures before the game starts. Returns a readable list of
// problems instead of a blank screen. Paths in the manifest are relative to the manifest file.

export const REQUIRED_ASSETS = [
  'pm-miner-atlas',
  'pm-hook-basic',
  'pm-nugget-small', 'pm-nugget-medium', 'pm-nugget-large',
  'pm-coin-pep', 'pm-rock', 'pm-crate',
  'pm-hud',
];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

export async function loadAssets(manifestUrl = 'img/gold-hook/manifest.json') {
  const base = new URL(manifestUrl, location.href);
  let manifest;
  try {
    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
  } catch (e) {
    return { ok: false, errors: [`${manifestUrl}: ${e.message}`], fatalManifest: true };
  }

  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  const errors = [];
  const images = new Map();

  await Promise.all(REQUIRED_ASSETS.map(async (id) => {
    const meta = byId.get(id);
    if (!meta) { errors.push(`${id}: missing from manifest.json`); return; }
    try {
      const img = await loadImage(new URL(meta.path, base).href);
      if (img.naturalWidth !== meta.width || img.naturalHeight !== meta.height) {
        errors.push(`${meta.path}: is ${img.naturalWidth}×${img.naturalHeight}, expected ${meta.width}×${meta.height}`);
        return;
      }
      images.set(id, { img, meta });
    } catch {
      errors.push(`${meta.path}: could not be loaded`);
    }
  }));

  if (!manifest.atlas || manifest.atlas.frameSize?.[0] !== 80 || manifest.atlas.frameSize?.[1] !== 96) {
    errors.push('manifest.json: the character atlas must use 80×96 frames');
  }

  errors.sort();
  return errors.length ? { ok: false, errors } : { ok: true, manifest, images };
}

// Total length of the one-shot animations = how long the frog's reaction lasts in the game logic.
export function reactionDurations(manifest) {
  const out = {};
  for (const name of ['success', 'fail', 'hurt']) {
    const a = manifest.animations?.[name];
    if (a) out[name] = a.durationsMs.reduce((s, d) => s + d, 0);
  }
  return out;
}
