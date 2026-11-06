// Build the special (whole-character) Fren avatars from Lily's original drawings.
//   games/fren-avatar/source/special/<name>-original.png  (transparent PNG, square)
//   -> docs/meme/avatar-assets/layers/special_<name>.webp   512x512, transparent, painted over the background
//   -> docs/meme/avatar-assets/thumbs/special_<name>.webp   96x72, the head, for the maker row
// A special avatar replaces every part layer except the background (see avatar-options.json).
// Uses a Chromium canvas for the WebP encoding (no image library needed):
//   FREN_TOOLS=/abs/tools FREN_CHROME=/abs/chrome node scripts/build_special_avatars.mjs
// (FREN_TOOLS: a folder with `npm i playwright`, as for scripts/fren_avatar_e2e.mjs)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TOOLS = process.env.FREN_TOOLS, CHROME = process.env.FREN_CHROME;
if (!TOOLS || !CHROME) { console.error('Set FREN_TOOLS and FREN_CHROME (see the header).'); process.exit(2); }
const pw = await import(createRequire(path.join(TOOLS, 'package.json')).resolve('playwright'));
const chromium = pw.chromium || pw.default.chromium;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = REPO + '/games/fren-avatar/source/special/';
const OUT = REPO + '/docs/meme/avatar-assets/';

// erase: stray marks in the source, as [x, y, w, h] in source pixels
// thumb: the head crop for the 96x72 thumbnail, as [x, y, w, h] in source pixels (4:3)
const SPECIALS = {
  explorer: { file: 'explorer-pepe-original.png', erase: [[0, 590, 150, 110]], thumb: [180, 40, 820, 615] }
};

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--headless=new'] });
const page = await browser.newPage();
for (const [name, s] of Object.entries(SPECIALS)) {
  const png = 'data:image/png;base64,' + (await readFile(SRC + s.file)).toString('base64');
  const out = await page.evaluate(async ({ png, s }) => {
    const img = new Image(); img.src = png; await img.decode();
    const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
    const g = src.getContext('2d'); g.drawImage(img, 0, 0);
    for (const [x, y, w, h] of s.erase) g.clearRect(x, y, w, h);
    const draw = (w, h, crop) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const k = c.getContext('2d'); k.imageSmoothingQuality = 'high';
      k.drawImage(src, crop[0], crop[1], crop[2], crop[3], 0, 0, w, h);
      return c.toDataURL('image/webp', 0.9).split(',')[1];
    };
    return { layer: draw(512, 512, [0, 0, img.width, img.height]), thumb: draw(96, 72, s.thumb) };
  }, { png, s });
  await writeFile(OUT + 'layers/special_' + name + '.webp', Buffer.from(out.layer, 'base64'));
  await writeFile(OUT + 'thumbs/special_' + name + '.webp', Buffer.from(out.thumb, 'base64'));
  console.log('special_' + name, Buffer.from(out.layer, 'base64').length, 'bytes');
}
await browser.close();
