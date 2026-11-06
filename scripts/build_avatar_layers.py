#!/usr/bin/env python3
"""Build the Fren Avatar layers and option thumbnails from the hand-drawn source sheets.

Input:  games/fren-avatar/source/base.webp          the frog head and shoulders (no eyes, no mouth)
        games/fren-avatar/source/accessories.webp   only for the reserved PEP pin
        games/fren-avatar/source-v3/*.webp          the owner's part sheets (white background, lossless):
            mouths, eyes, hats, clothing, accessories, backgrounds
Output: docs/meme/avatar-assets/layers/<id>.webp    one 512x512 layer per option, part already in place
        docs/meme/avatar-assets/thumbs/<id>.webp    one small picture of the part itself, for the maker rows

Every layer is a full 512x512 canvas, so the Avatar Maker just stacks them with no offsets.
All placement numbers are in the base drawing's own 512 coordinates (see PLACE below). The base
is drawn a little smaller on the canvas (VIEW) so tall hats and headphones fit. The base green is
shifted to the green of the new eye art, so the head and the eyelids match.

Needs Pillow, numpy and scipy (not used by the site itself):
    python3 scripts/build_avatar_layers.py                # write layers + thumbs
    python3 scripts/build_avatar_layers.py --sheet x.jpg  # also a test sheet of looks
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games', 'fren-avatar', 'source')
SRC3 = os.path.join(ROOT, 'games', 'fren-avatar', 'source-v3')
OUT_DIR = os.path.join(ROOT, 'docs', 'meme', 'avatar-assets', 'layers')
THUMB_DIR = os.path.join(ROOT, 'docs', 'meme', 'avatar-assets', 'thumbs')

WORK = 1024        # composed at 2x, then saved at 512
SIZE = 512
THUMB = (96, 72)   # thumbnail box (CSS shows it at 48x36)
VX, VY, VS = -64, -72, 656   # visible window in base units: x -64..592, y -72..584
K = WORK / VS
GREEN_NEW = np.array([99, 159, 43], np.float32)     # median green of the v3 eye art
GREEN_OLD = np.array([102, 133, 63], np.float32)    # median green of base.webp


def tx(x): return (x - VX) * K
def ty(y): return (y - VY) * K


def rgb(name):
    return np.asarray(Image.open(os.path.join(SRC3, name + '.webp')).convert('RGB')).astype(np.int16)


# ---------------------------------------------------------------- cutting
# Cells of the boxed sheets, as (y0, y1, x0, x1) in sheet pixels, read off the grid lines.
def grid(rows, cols):
    return [(rows[r] , rows[r + 1], cols[c], cols[c + 1]) for r in range(len(rows) - 1) for c in range(len(cols) - 1)]


CELLS = {
    'mouths': grid([9, 384, 760], [6, 342, 680, 1017]),
    'eyes': grid([1, 256, 508, 766], [1, 512, 1022]),
    'hats': grid([83, 392, 703], [8, 256, 511, 767, 1017]),
}


def frame_cells(a):
    """Separate rounded boxes (accessories sheet): each box outline is one thin component."""
    ink = a.min(-1) < 200
    lab, _ = nd.label(ink)
    cells = []
    for i, sl in enumerate(nd.find_objects(lab)):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h > 120 and w > 120 and (lab[sl] == i + 1).sum() / (h * w) < 0.12:
            cells.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    cells.sort(key=lambda c: (c[0] > 300, c[2]))
    return cells


def cutout(cell_rgb, inset=10):
    """RGBA of the part drawn in one cell: the white paper connected to the cell edge becomes
    transparent (enclosed whites such as eye whites and teeth stay), with a soft edge."""
    a = cell_rgb[inset:-inset, inset:-inset]
    white = a.min(-1) > 200
    lab, _ = nd.label(white)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    outside = np.isin(lab, np.unique(border[border > 0]))
    # also drop specks: keep only sizeable pieces of the part
    part = ~outside
    plab, n = nd.label(part)
    if n > 1:
        sizes = np.asarray(nd.sum(part, plab, range(1, n + 1)))
        part = np.isin(plab, 1 + np.nonzero(sizes >= max(60, 0.01 * sizes.max()))[0])
    alpha = part.astype(np.float32)
    # anti-aliased rim: pixels next to the paper get alpha from how dark they are
    rim = part & nd.binary_dilation(~part, iterations=1)
    dark = 1 - (a.min(-1).astype(np.float32) - 120) / 135
    alpha[rim] = np.clip(dark[rim], 0, 1)
    out = np.zeros(a.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(a, 0, 255)
    out[..., 3] = (alpha * 255).astype(np.uint8)
    ys, xs = np.nonzero(out[..., 3] > 20)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cut_cells(name):
    a = rgb(name)
    cells = CELLS.get(name) or frame_cells(a)
    return [cutout(a[y0:y1, x0:x1]) for y0, y1, x0, x1 in cells]


def cut_clothing():
    """No boxes on this sheet: one connected drawing per garment, 3 per row."""
    a = rgb('clothing')
    ink = a.min(-1) < 200
    lab, _ = nd.label(nd.binary_closing(ink, iterations=2))
    boxes = []
    for i, sl in enumerate(nd.find_objects(lab)):
        if (lab[sl] == i + 1).sum() > 4000:
            boxes.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    boxes.sort(key=lambda b: (b[0] > 384, b[2]))
    return [cutout(a[max(0, y0 - 14):y1 + 14, max(0, x0 - 14):x1 + 14]) for y0, y1, x0, x1 in boxes]


def cut_backgrounds():
    a = rgb('backgrounds').astype(np.uint8)
    tiles = [(22, 369, 22, 335), (22, 369, 356, 668), (22, 369, 690, 1001),
             (395, 741, 22, 335), (395, 741, 356, 668), (395, 741, 690, 1001)]
    out = []
    for y0, y1, x0, x1 in tiles:
        t = Image.fromarray(a[y0 + 4:y1 - 4, x0 + 4:x1 - 4])
        # portrait tile -> square layer: fill the width, keep the bottom (mountains, city, pond)
        s = WORK / t.width
        t = t.resize((WORK, round(t.height * s)), Image.LANCZOS)
        sq = t.crop((0, t.height - WORK, WORK, t.height)) if t.height >= WORK else t.resize((WORK, WORK), Image.LANCZOS)
        out.append(sq.convert('RGBA'))
    return out


def old_pin():
    """The reserved PEP pin keeps its earlier art (bottom-left item of the old accessories sheet)."""
    a = np.array(Image.open(os.path.join(SRC, 'accessories.webp')).convert('RGBA'))
    m = a[..., 3] > 20
    lab, _ = nd.label(nd.binary_dilation(m, iterations=22))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab)):
        keep = lab[sl] == i + 1
        if (keep & m[sl]).sum() < 1500:
            continue
        sub = a[sl].copy(); sub[~keep] = 0
        ys, xs = np.where(sub[..., 3] > 20)
        comps.append((sl[0].start, sl[1].start, sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    return max(comps, key=lambda c: c[0] - c[1])[2]


# ---------------------------------------------------------------- placing
def place(arr, w, cx, top=None, bottom=None, cy=None):
    img = Image.fromarray(arr)
    s = (w * K) / img.width
    im = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    x = round(tx(cx) - im.width / 2)
    if top is not None:
        y = round(ty(top))
    elif bottom is not None:
        y = round(ty(bottom) - im.height)
    else:
        y = round(ty(cy) - im.height / 2)
    cv = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    cv.paste(im, (x, y), im)
    return cv


# Chin and jaw line of the base drawing. Clothing and neckwear are erased where
# they would cover the head above this line, so the chin sits in front of the collar.
JAW = [(-64, 372), (40, 382), (100, 405), (160, 428), (250, 447), (330, 432),
       (380, 414), (430, 392), (470, 368), (592, 360)]


def base_layer():
    b = np.array(Image.open(os.path.join(SRC, 'base.webp')).convert('RGBA')).astype(np.float32)
    c = b[..., :3]
    greenish = (c[..., 1] > c[..., 0] + 12) & (c[..., 1] > c[..., 2] + 12)
    c[greenish] = np.clip(c[greenish] * (GREEN_NEW / GREEN_OLD), 0, 255)
    img = Image.fromarray(b.astype(np.uint8), 'RGBA').resize((round(512 * K), round(512 * K)), Image.LANCZOS)
    cv = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    cv.paste(img, (round(tx(0)), round(ty(0))), img)
    return cv


def under_chin(layer, base):
    m = Image.new('L', (WORK, WORK), 0)
    ImageDraw.Draw(m).polygon([(tx(x), ty(y)) for x, y in JAW] + [(WORK, 0), (0, 0)], fill=255)
    a = np.array(layer)
    a[(np.array(m) > 0) & (np.array(base)[..., 3] > 30), 3] = 0
    return Image.fromarray(a)


# Sheet order -> option id and placement (base units). Ids must match docs/meme/avatar-options.json.
EYES = ['eyes_classic', 'eyes_sleepy', 'eyes_angry', 'eyes_bloodshot', 'eyes_3d', 'eyes_hypno']
PLACE_EYES = {'w': 330, 'cx': 304, 'top': 104}
MOUTHS = ['mouth_flat', 'mouth_smile', 'mouth_open', 'mouth_tongue', 'mouth_teeth', 'mouth_smirk']
MOUTH_W = 200
MOUTH_CX, MOUTH_TOP = 306, 296
HATS = [  # the first cell is the 'none' tile
    None,
    ('hat_pep_cap', {'w': 330, 'cx': 270, 'bottom': 176}),
    ('hat_beanie', {'w': 320, 'cx': 268, 'bottom': 180}),
    ('hat_bucket', {'w': 370, 'cx': 268, 'bottom': 186}),
    ('hat_hardhat', {'w': 350, 'cx': 268, 'bottom': 180}),
    ('hat_crown', {'w': 250, 'cx': 266, 'bottom': 162}),
    ('hat_wizard', {'w': 340, 'cx': 262, 'bottom': 172}),
    ('hat_detective', {'w': 360, 'cx': 268, 'bottom': 186}),
]
CLOTHING = [('clothing_blue', 372), ('clothing_purple_hoodie', 356), ('clothing_black_hoodie', 356),
            ('clothing_suit', 368), ('clothing_shirt_tie', 370), ('clothing_camo', 368)]
ACCESSORIES = [  # the first box is the 'none' tile
    None,
    ('accessory_shades', {'w': 330, 'cx': 304, 'cy': 196}),
    ('accessory_round', {'w': 320, 'cx': 304, 'cy': 196}),
    ('accessory_orange', {'w': 320, 'cx': 304, 'cy': 196}),
    ('accessory_cigarette', {'w': 120, 'cx': 452, 'cy': 318}),
    ('accessory_pipe', {'w': 130, 'cx': 452, 'cy': 344}),
    ('accessory_headphones', {'w': 640, 'cx': 282, 'top': -30, 'behind_head': True}),
]
BACKGROUNDS = ['bg_sunset', 'bg_sky', 'bg_night', 'bg_city', 'bg_snow', 'bg_forest']


def thumb(arr):
    im = Image.fromarray(arr) if not isinstance(arr, Image.Image) else arr
    im = im.copy(); im.thumbnail(THUMB, Image.LANCZOS)
    t = Image.new('RGBA', THUMB, (0, 0, 0, 0))
    t.paste(im, ((THUMB[0] - im.width) // 2, (THUMB[1] - im.height) // 2), im)
    return t


def build():
    base = base_layer()
    layers, thumbs = {'base_frog': base}, {}
    eyes = cut_cells('eyes'); assert len(eyes) == 6
    for lid, arr in zip(EYES, eyes):
        layers[lid] = place(arr, **PLACE_EYES); thumbs[lid] = thumb(arr)
    mouths = cut_cells('mouths'); assert len(mouths) == 6
    for lid, arr in zip(MOUTHS, mouths):
        # the open mouths hang down from the same lip line
        layers[lid] = place(arr, w=MOUTH_W * (1.0 if lid != 'mouth_teeth' else 0.92), cx=MOUTH_CX, top=MOUTH_TOP); thumbs[lid] = thumb(arr)
    hats = cut_cells('hats'); assert len(hats) == len(HATS)
    for spec, arr in zip(HATS, hats):
        if spec is None:
            thumbs['hat_none'] = thumb(arr); continue
        layers[spec[0]] = place(arr, **spec[1]); thumbs[spec[0]] = thumb(arr)
    clothes = cut_clothing(); assert len(clothes) == len(CLOTHING), len(clothes)
    for (lid, top), arr in zip(CLOTHING, clothes):
        layers[lid] = under_chin(place(arr, w=600, cx=250, top=top), base); thumbs[lid] = thumb(arr)
    acc = cut_cells('accessories'); assert len(acc) == len(ACCESSORIES), len(acc)
    for spec, arr in zip(ACCESSORIES, acc):
        if spec is None:
            thumbs['accessory_none'] = thumb(arr); continue
        p = dict(spec[1]); behind = p.pop('behind_head', False)
        L = place(arr, **p)
        # headphones: the cups sit behind the face (worn on the ears), so the head covers their middle
        layers[spec[0]] = under_chin(L, base) if behind else L
        thumbs[spec[0]] = thumb(arr)
    pin = old_pin()
    layers['accessory_pin'] = place(pin, w=56, cx=150, cy=520); thumbs['accessory_pin'] = thumb(pin)
    for lid, img in zip(BACKGROUNDS, cut_backgrounds()):
        layers[lid] = img; thumbs[lid] = thumb(img.resize((THUMB[0], THUMB[0])).crop((0, 12, THUMB[0], 12 + THUMB[1])))
    empty = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    for lid in ('hat_none', 'accessory_none'):
        layers[lid] = empty
    return layers, thumbs


def save(layers, thumbs):
    for d in (OUT_DIR, THUMB_DIR):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith('.webp'):
                os.remove(os.path.join(d, f))
    for lid, img in layers.items():
        img.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT_DIR, lid + '.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    for lid, img in thumbs.items():
        img.save(os.path.join(THUMB_DIR, lid + '.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    print('wrote %d layers and %d thumbs' % (len(layers), len(thumbs)))


def test_sheet(layers, path, looks):
    tiles = []
    for look in looks:
        cv = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
        for k in ('bg', 'base', 'clothing', 'mouth', 'eyes', 'hat', 'accessory'):
            cv.alpha_composite(layers[look[k]] if k != 'base' else layers['base_frog'])
        tiles.append(cv.resize((300, 300), Image.LANCZOS))
    cols = 4
    sh = Image.new('RGB', (300 * cols, 300 * ((len(tiles) + cols - 1) // cols)), (255, 0, 255))
    for i, t in enumerate(tiles):
        sh.paste(t, ((i % cols) * 300, (i // cols) * 300), t)
    sh.save(path, quality=85)


if __name__ == '__main__':
    L, T = build()
    save(L, T)
    if '--sheet' in sys.argv:
        out = sys.argv[sys.argv.index('--sheet') + 1]
        H = [h[0] for h in HATS if h] + ['hat_none']
        A = [a[0] for a in ACCESSORIES if a] + ['accessory_none']
        looks = []
        for i in range(12):
            looks.append({'bg': BACKGROUNDS[i % 6], 'clothing': CLOTHING[i % 6][0], 'mouth': MOUTHS[i % 6],
                          'eyes': EYES[(i + 1) % 6], 'hat': H[i % len(H)], 'accessory': A[i % len(A)]})
        test_sheet(L, out, looks)
