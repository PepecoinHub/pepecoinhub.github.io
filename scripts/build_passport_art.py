#!/usr/bin/env python3
"""Cut the hand-drawn Fren Passport art into the web assets the Passport uses.

Source: games/fren-passport/source/passport-mockup.webp (lossless, 1024x768). It is the
owner-supplied ChatGPT mockup of the whole window. Only the art is reused; every
number, name and stamp state in it was sample data and is erased here, so the
Passport fills those spots with the player's real server data.

Writes to docs/meme/passport-assets/:
  page-left.webp   left booklet page. Fields erased; the photo window is transparent
                   so the saved avatar shows through from underneath (clip and tape stay).
  page-right.webp  right booklet page. Stamp grid erased; the reserved BALI stamp stays
                   printed on the page.
  stamps.webp      sprite: the 15 stamp tiles + the '?' locked tile, cut out with alpha.
  icons.webp       sprite: My Fren Journey / Next Milestone / tab icons, cut out with alpha.

Run: PYTHONPATH=<pillow+numpy+scipy> python3 scripts/build_passport_art.py
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games/fren-passport/source/passport-mockup.webp')
OUT = os.path.join(ROOT, 'docs/meme/passport-assets')
DEBUG = os.environ.get('PASSPORT_ART_DEBUG')  # optional folder for inspection images

# ---- geometry, in source pixels ----
BOOK = (26, 92, 746, 620)            # outer box of the open booklet (both pages + rim)
SPLIT = (BOOK[0] + BOOK[2]) // 2     # left page | right page
PHOTO_QUAD = [(48, 280), (194, 270), (198, 462), (56, 472)]   # search area for the photo window
CLIP_BOX = (64, 255, 91, 317)        # paper clip: its metal stays over the avatar
TAPE_RGB = (232, 200, 145)           # masking tape colour
TAPES = [[(128, 262), (190, 256), (194, 287), (132, 292)],    # top-right tape
         [(36, 462), (80, 445), (96, 478), (52, 494)]]        # bottom-left tape
FIELDS = (206, 280, 381, 424)        # sample Fren ID / nickname / date / status
GRID = (389, 171, 728, 479)          # 5 x 4 sample stamp grid
CLEAN = (212, 474, 372, 508)         # untouched paper used as texture for the fills
STAMP_COLS, STAMP_ROWS = 5, 4
# stamp art, row by row, in the order printed on the mockup (row 4 is the locked '?')
STAMP_NAMES = ['calendar', 'gamepad', 'pickaxe', 'duck', 'magnifier',
               'folders', 'computer', 'people', 'sprout', 'handshake',
               'rocket', 'binoculars', 'deerstalker', 'moon', 'joystick',
               'locked']
# icon boxes (padded); background is removed by flood fill from the box edge
ICONS = {
    'plane': (764, 109, 813, 143), 'calendar': (762, 162, 802, 193), 'trophy': (762, 196, 802, 228),
    'box': (762, 228, 803, 262), 'gamepad': (762, 259, 804, 293), 'star': (764, 292, 802, 324),
    'gift': (761, 397, 811, 453),
    'tab_home': (54, 633, 106, 676), 'tab_trophy': (246, 631, 296, 674), 'tab_stamp': (461, 631, 509, 676),
    'tab_box': (644, 628, 699, 676), 'tab_stats': (852, 628, 911, 673),
}
CELL = 48  # icon sprite cell (CSS px at 1x)


def load():
    if not os.path.exists(SRC):
        sys.exit('missing source art: ' + SRC)
    return np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)


def poly_mask(shape, poly):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255)
    return np.asarray(m) > 0


def lum(a):
    return a[..., :3].mean(-1)


def sat(a):
    return a[..., :3].max(-1) - a[..., :3].min(-1)


def texture_from(a, box, shape, seed=7):
    """High-pass paper grain, tiled from a clean patch with random offsets and soft seams."""
    x0, y0, x1, y1 = box
    patch = a[y0:y1, x0:x1, :3]
    hp = patch - nd.gaussian_filter(patch, (4, 4, 0))
    ph, pw = hp.shape[:2]
    rng = np.random.default_rng(seed)
    out = np.zeros(shape + (3,), np.float32)
    wsum = np.zeros(shape, np.float32)
    t = 24
    win = np.outer(np.hanning(t + 2)[1:-1], np.hanning(t + 2)[1:-1]).astype(np.float32) + 1e-3
    for y in range(-t // 2, shape[0], t // 2):
        for x in range(-t // 2, shape[1], t // 2):
            sy, sx = rng.integers(0, ph - t), rng.integers(0, pw - t)
            tile = hp[sy:sy + t, sx:sx + t]
            ys, xs = max(0, y), max(0, x)
            ye, xe = min(shape[0], y + t), min(shape[1], x + t)
            if ye <= ys or xe <= xs:
                continue
            ty, tx = ys - y, xs - x
            w = win[ty:ty + ye - ys, tx:tx + xe - xs]
            out[ys:ye, xs:xe] += tile[ty:ty + ye - ys, tx:tx + xe - xs] * w[..., None]
            wsum[ys:ye, xs:xe] += w
    return out / wsum[..., None]


def harmonic(rgb, hole, iters=400):
    """Smooth fill of `hole` from its border (coarse-to-fine Jacobi relaxation of Laplace's equation)."""
    levels = []
    img, m = rgb.copy(), hole.copy()
    while min(m.shape) > 24:
        levels.append((img, m))
        h2, w2 = m.shape[0] // 2, m.shape[1] // 2
        k = (~m[:h2 * 2, :w2 * 2]).reshape(h2, 2, w2, 2).astype(np.float32)
        v = (img[:h2 * 2, :w2 * 2] * (~m[:h2 * 2, :w2 * 2])[..., None]).reshape(h2, 2, w2, 2, 3)
        ks = k.sum((1, 3))
        img = v.sum((1, 3)) / np.maximum(ks, 1)[..., None]
        m = ks == 0
    levels.append((img, m))
    est = None
    for img, m in reversed(levels):
        cur = img.copy()
        if est is not None:
            up = np.asarray(Image.fromarray(np.clip(est, 0, 255).astype(np.uint8), 'RGB').resize((m.shape[1], m.shape[0]), Image.BILINEAR), np.float32)
            cur[m] = up[m]
        else:
            cur[m] = img[~m].mean(0) if (~m).any() else 128
        for _ in range(iters):
            avg = (np.roll(cur, 1, 0) + np.roll(cur, -1, 0) + np.roll(cur, 1, 1) + np.roll(cur, -1, 1)) / 4
            cur[m] = avg[m]
        est = cur
    return est


def inpaint(a, hole, tex, box):
    """Fill `hole` (inside `box`) with the surrounding paper colour plus paper grain,
    feathered into the untouched pixels."""
    x0, y0, x1, y1 = box
    pad = 8
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    sub = a[Y0:Y1, X0:X1, :3].copy()
    h = hole[Y0:Y1, X0:X1]
    # border pixels darker than the paper (frame shadows, page rim) would bleed in: clamp them
    ring = ~h
    med = np.median(sub[ring], 0)
    guide = sub.copy()
    dark = ring & (sub.mean(-1) < med.mean() - 22)
    guide[dark] = med
    low = harmonic(guide, h)
    fill = low + tex[Y0:Y1, X0:X1]
    soft = np.maximum(nd.gaussian_filter(h.astype(np.float32), 1.5), h)
    out = a.copy()
    out[Y0:Y1, X0:X1, :3] = np.clip(sub * (1 - soft[..., None]) + fill * soft[..., None], 0, 255)
    return out


def flood_alpha(crop, close_to, tol):
    """Alpha for a sprite: everything connected to the crop border that looks like the
    surrounding background (within `tol` of `close_to`) becomes transparent."""
    d = np.abs(crop[..., :3] - np.asarray(close_to, np.float32)).max(-1)
    bg = d < tol
    seed = np.zeros_like(bg)
    seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
    lab, _ = nd.label(bg)
    ids = np.unique(lab[seed & bg])
    outside = np.isin(lab, ids[ids > 0])
    keep = ~outside
    # drop slivers of neighbouring art; keep every sizeable piece (the stats icon has 4 bars)
    lab2, n = nd.label(keep)
    if n > 1:
        sizes = np.asarray(nd.sum(keep, lab2, range(1, n + 1)))
        keep = np.isin(lab2, 1 + np.nonzero(sizes >= 0.08 * sizes.max())[0])
    keep = nd.binary_fill_holes(keep)
    return keep


def stamp_tiles(a):
    """Cut the 20 grid tiles (5 x 4) with alpha. The tile border is a cream perforated
    edge with a dark outline; the page paper around it is flood-filled away."""
    x0, y0, x1, y1 = GRID
    cw, ch = (x1 - x0) / STAMP_COLS, (y1 - y0) / STAMP_ROWS
    paper = np.median(a[CLEAN[1]:CLEAN[3], CLEAN[0]:CLEAN[2], :3].reshape(-1, 3), 0)
    tiles, masks = [], np.zeros(a.shape[:2], bool)
    for r in range(STAMP_ROWS):
        for c in range(STAMP_COLS):
            bx0, by0 = int(round(x0 + c * cw)), int(round(y0 + r * ch))
            bx1, by1 = int(round(x0 + (c + 1) * cw)), int(round(y0 + (r + 1) * ch))
            crop = a[by0:by1, bx0:bx1]
            dark = lum(crop) < 140          # the tile's outline is the wall the flood stops at
            d = np.abs(crop[..., :3] - paper).max(-1)
            bg = (d < 46) & ~dark
            seed = np.zeros_like(bg)
            seed[0, :] = seed[-1, :] = seed[:, 0] = seed[:, -1] = True
            lab, _ = nd.label(bg)
            ids = np.unique(lab[seed & bg])
            keep = ~np.isin(lab, ids[ids > 0])
            lab2, n = nd.label(keep)
            if n > 1:
                sizes = nd.sum(keep, lab2, range(1, n + 1))
                keep = lab2 == (1 + int(np.argmax(sizes)))
            keep = nd.binary_fill_holes(keep)
            tiles.append((crop.copy(), keep))
            masks[by0:by1, bx0:bx1] |= keep
    return tiles, masks


def sprite(cells, cw, chh):
    sheet = Image.new('RGBA', (cw * len(cells), chh), (0, 0, 0, 0))
    for i, (crop, keep) in enumerate(cells):
        rgba = crop.copy()
        rgba[..., 3] = np.where(keep, 255, 0)
        im = Image.fromarray(rgba.astype(np.uint8), 'RGBA')
        ys, xs = np.nonzero(keep)
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        im.thumbnail((cw, chh), Image.LANCZOS)
        sheet.paste(im, (i * cw + (cw - im.width) // 2, (chh - im.height) // 2), im)
    return sheet


def save(im, name, **kw):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', method=6, **kw)
    return path, os.path.getsize(path)


def main():
    a = load()
    os.makedirs(OUT, exist_ok=True)
    H, W = a.shape[:2]
    tex = texture_from(a, CLEAN, (H, W))

    # --- stamp tiles first (cut from the untouched art), then erase the grid ---
    tiles, tile_mask = stamp_tiles(a)
    # the 15 drawn stamps and one '?' tile (row 4, column 3 is the cleanest)
    # The '?' tile is printed on page paper, so it is kept as an opaque rectangle (same paper
    # as the page) with a feathered edge instead of a flood-filled cut-out.
    lc, _ = tiles[17]
    lk = np.zeros(lc.shape[:2], bool); lk[2:-2, 2:-2] = True
    cells = tiles[:15] + [(lc, lk)]
    tw = max(int(k.any(0).sum()) for _, k in cells) + 2
    th = max(int(k.any(1).sum()) for _, k in cells) + 2
    stamp_sheet = sprite(cells, tw, th)

    # --- icons ---
    icon_cells = []
    for name, (ix0, iy0, ix1, iy1) in ICONS.items():
        crop = a[iy0:iy1, ix0:ix1]
        border = np.concatenate([crop[0, :, :3], crop[-1, :, :3], crop[:, 0, :3], crop[:, -1, :3]])
        bgc = np.median(border, 0)
        keep = flood_alpha(crop, bgc, 34)
        icon_cells.append((crop.copy(), keep))
    icon_sheet = sprite(icon_cells, CELL, CELL)

    # --- erase sample data: the field block and the stamp grid, as whole rectangles ---
    hole = np.zeros((H, W), bool)
    clean = a
    for x0, y0, x1, y1 in (FIELDS, GRID):
        hole[y0:y1, x0:x1] = True
        clean = inpaint(clean, hole, tex, (x0, y0, x1, y1))

    # --- photo window: transparent, except the paper clip metal and the tape ---
    # Inside a generous quad, everything that is not the cream polaroid frame belongs to the
    # sample photo; keep its largest piece, fill its holes (white hoodie strings etc.).
    quad = poly_mask((H, W), PHOTO_QUAD)
    frame = (lum(a) > 196) & (sat(a) < 60)
    photo = quad & ~frame
    lab, n = nd.label(photo)
    if n > 1:
        sizes = nd.sum(photo, lab, range(1, n + 1))
        photo = lab == (1 + int(np.argmax(sizes)))
    photo = nd.binary_fill_holes(nd.binary_closing(photo, iterations=2))
    # straighten: fit a line to each edge of the found window and use that quadrilateral
    ys, xs = np.nonzero(photo)
    rows = np.arange(ys.min() + 12, ys.max() - 12)
    cols = np.arange(xs.min() + 12, xs.max() - 12)
    lft = np.array([np.nonzero(photo[r])[0].min() for r in rows])
    rgt = np.array([np.nonzero(photo[r])[0].max() for r in rows])
    top = np.array([np.nonzero(photo[:, c])[0].min() for c in cols])
    bot = np.array([np.nonzero(photo[:, c])[0].max() for c in cols])
    fit = lambda t, v: np.polyfit(t, np.median(v) + np.clip(v - np.median(v), -3, 3), 1)
    L, R, T, B = fit(rows, lft), fit(rows, rgt), fit(cols, top), fit(cols, bot)

    def meet(vline, hline):  # x = vline(y), y = hline(x)
        y = 0.0
        for _ in range(20):
            x = np.polyval(vline, y); y = np.polyval(hline, x)
        return (float(np.polyval(vline, y)), float(y))
    PHOTO = [meet(L, T), meet(R, T), meet(R, B), meet(L, B)]
    photo = poly_mask((H, W), [(x + dx, y + dy) for (x, y), (dx, dy) in zip(PHOTO, [(-1, -1), (1, -1), (1, 1), (-1, 1)])])
    keep_over = np.zeros((H, W), bool)
    cx0, cy0, cx1, cy1 = CLIP_BOX
    clip = a[cy0:cy1, cx0:cx1]
    metal = sat(clip) < 70
    lab, _ = nd.label(metal)
    top = np.unique(lab[0][lab[0] > 0])           # the clip enters the photo from above
    keep_over[cy0:cy1, cx0:cx1] = np.isin(lab, top)
    tape_col = np.asarray(TAPE_RGB, np.float32)
    for t in TAPES:
        pm = poly_mask((H, W), t)
        tape = pm & (np.abs(a[..., :3] - tape_col).max(-1) < 48)
        keep_over |= nd.binary_fill_holes(nd.binary_closing(tape, iterations=3)) & pm
    window = photo & ~keep_over
    global LAYOUT_PHOTO
    LAYOUT_PHOTO = PHOTO
    clean[..., 3] = np.where(window, 0, clean[..., 3])

    # --- outside the rim (window background in the corners) -> transparent ---
    bx0, by0, bx1, by1 = BOOK
    book = clean[by0:by1, bx0:bx1].copy()
    border = np.concatenate([book[0, :, :3], book[-1, :, :3], book[:, 0, :3], book[:, -1, :3]])
    outside = ~flood_alpha(book, np.median(border, 0), 30)
    book[..., 3] = np.where(outside, 0, book[..., 3])

    split = SPLIT - bx0
    left = Image.fromarray(book[:, :split].astype(np.uint8), 'RGBA')
    right = Image.fromarray(book[:, split:].astype(np.uint8), 'RGBA')

    report = {}
    for im, name in ((left, 'page-left.webp'), (right, 'page-right.webp')):
        report[name] = save(im, name, quality=88, alpha_quality=100)[1]
    report['stamps.webp'] = save(stamp_sheet, 'stamps.webp', quality=90, alpha_quality=100)[1]
    report['icons.webp'] = save(icon_sheet, 'icons.webp', quality=92, alpha_quality=100)[1]

    PHOTO = LAYOUT_PHOTO

    def rel(p, page_x0):
        return [round((p[0] - page_x0) / split * 100, 3), round((p[1] - by0) / (by1 - by0) * 100, 3)]
    layout = {
        'page': [split, by1 - by0],
        'photo_quad_pct': [rel(p, bx0) for p in PHOTO],
        'fields_pct': [rel((FIELDS[0], FIELDS[1]), bx0), rel((FIELDS[2], FIELDS[3]), bx0)],
        'grid_pct': [rel((GRID[0], GRID[1]), SPLIT), rel((GRID[2], GRID[3]), SPLIT)],
        'stamp_cell': [tw, th], 'stamp_names': STAMP_NAMES,
        'icon_cell': CELL, 'icon_names': list(ICONS),
        'bytes': report,
    }
    print(json.dumps(layout, indent=1))
    if DEBUG:
        os.makedirs(DEBUG, exist_ok=True)
        Image.fromarray(clean.astype(np.uint8), 'RGBA').save(os.path.join(DEBUG, 'clean-full.png'))
        Image.fromarray((hole * 255).astype(np.uint8)).save(os.path.join(DEBUG, 'hole.png'))


if __name__ == '__main__':
    main()
