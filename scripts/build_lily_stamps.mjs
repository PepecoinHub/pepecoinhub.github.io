// Build the Fren Passport art drawn by Lily (games/fren-passport/source/stamps-lily/*.png, transparent):
//   docs/meme/passport-assets/stamps-lily.webp   one row of stamp tiles, 138x150 each (shown at 69x75), order = LILY below
//   docs/meme/passport-assets/stamp-new.webp     80x80, the icon of the "New stamp" notice
//   docs/meme/avatar-assets/layers/hat_explorer.webp + thumbs/hat_explorer.webp   the 14-day explorer hat
// Crops are [x0, y0, x1, y1] in sheet pixels (found from the transparent background).
// Uses a Chromium canvas for the WebP encoding:
//   FREN_TOOLS=/abs/tools FREN_CHROME=/abs/chrome node scripts/build_lily_stamps.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const TOOLS = process.env.FREN_TOOLS, CHROME = process.env.FREN_CHROME;
if (!TOOLS || !CHROME) { console.error('Set FREN_TOOLS and FREN_CHROME (see the header).'); process.exit(2); }
const pw = await import(createRequire(path.join(TOOLS, 'package.json')).resolve('playwright'));
const chromium = pw.chromium || pw.default.chromium;
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = REPO + '/games/fren-passport/source/stamps-lily/';
const S1 = 'sheet-1-pioneer-welcome-guesser-week-scout-words.png', S2 = 'sheet-2-pepegochi-14day-icon.png', S3 = 'sheet-3-mentions-editors-miner.png';

// stamp id -> [sheet, crop]. The order is the sprite order (docs/meme/meme.js PP_LILY must match).
export const LILY = [
  ['pond_pioneer', S1, [48, 40, 328, 368]], ['welcome_back', S1, [372, 40, 652, 368]], ['pepe_guesser', S1, [688, 40, 972, 368]],
  ['week_scout', S1, [40, 404, 328, 724]], ['scout_fren', S1, [368, 404, 652, 724]], ['first_words', S1, [688, 404, 984, 728]],
  ['hey_fren', S3, [44, 16, 332, 364]], ['dear_editor', S3, [368, 16, 656, 364]], ['junior_editor', S3, [692, 16, 980, 364]],
  ['senior_editor', S3, [184, 388, 480, 744]], ['rookie_miner', S3, [544, 388, 848, 744]],
  ['first_hatch', S2, [96, 16, 416, 372]], ['little_fren', S2, [460, 12, 784, 372]], ['grown_fren', S2, [96, 388, 416, 748]],
  ['streak_14', S2, [456, 388, 784, 748]]
];
const TILE = [138, 150];
const ICON = [S2, [824, 312, 972, 456]];
const HAT = { file: 'hat-14-explorer.png', crop: [96, 164, 916, 708], thumb: [720, 808, 964, 976],
  // same place as the other hats on the shared 512 canvas (hat_bucket spans x 114-403, bottom y 201)
  to: [108, 2, 408, 201] };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sheets = {};
  for (const f of [S1, S2, S3, HAT.file]) sheets[f] = 'data:image/png;base64,' + (await readFile(SRC + f)).toString('base64');
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--headless=new'] });
  const page = await browser.newPage();
  const out = await page.evaluate(async ({ sheets, LILY, TILE, ICON, HAT }) => {
    const imgs = {};
    for (const [k, u] of Object.entries(sheets)) { const i = new Image(); i.src = u; await i.decode(); imgs[k] = i; }
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; return [c, g]; };
    // fit a crop into a box, keeping its shape, centred
    const fit = (g, img, [x0, y0, x1, y1], [bx, by, bw, bh]) => {
      const w = x1 - x0, h = y1 - y0, k = Math.min(bw / w, bh / h), dw = w * k, dh = h * k;
      g.drawImage(img, x0, y0, w, h, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
    };
    const webp = (c, q) => c.toDataURL('image/webp', q).split(',')[1];
    const [sc, sg] = canvas(TILE[0] * LILY.length, TILE[1]);
    LILY.forEach(([, f, crop], i) => fit(sg, imgs[f], crop, [i * TILE[0] + 3, 3, TILE[0] - 6, TILE[1] - 6]));
    const [ic, ig] = canvas(80, 80); fit(ig, imgs[ICON[0]], ICON[1], [2, 2, 76, 76]);
    const [hc, hg] = canvas(512, 512); fit(hg, imgs[HAT.file], HAT.crop, [HAT.to[0], HAT.to[1], HAT.to[2] - HAT.to[0], HAT.to[3] - HAT.to[1]]);
    const [tc, tg] = canvas(96, 72); fit(tg, imgs[HAT.file], HAT.thumb, [4, 4, 88, 64]);
    return { sprite: webp(sc, 0.78), icon: webp(ic, 0.9), hat: webp(hc, 0.9), thumb: webp(tc, 0.9) };
  }, { sheets, LILY, TILE, ICON, HAT });
  const put = async (rel, b64) => { const b = Buffer.from(b64, 'base64'); await writeFile(REPO + '/docs/meme/' + rel, b); console.log(rel, b.length, 'bytes'); };
  await put('passport-assets/stamps-lily.webp', out.sprite);
  await put('passport-assets/stamp-new.webp', out.icon);
  await put('avatar-assets/layers/hat_explorer.webp', out.hat);
  await put('avatar-assets/thumbs/hat_explorer.webp', out.thumb);
  await browser.close();
}
