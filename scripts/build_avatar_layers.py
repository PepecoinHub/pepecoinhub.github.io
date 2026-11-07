#!/usr/bin/env python3
"""Build the Fren Avatar layers and option thumbnails from the hand-drawn source sheets.

Input:  games/fren-avatar/source/base.webp          the frog head and shoulders (no eyes, no mouth)
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


def place(arr, w, cx, top=None, bottom=None, cy=None, sy=1.0):
    # sy < 1 squashes the part vertically (a lower crown for the bucket hat)
    img = Image.fromarray(arr)
    s = (w * K) / img.width
    im = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s * sy))), Image.LANCZOS)
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
    # sizes and places retuned 2026-11-07 (owner: hats sat too far left and too small): centred over the eyes
    None,
    ('hat_pep_cap', {'w': 380, 'cx': 300, 'bottom': 182}),
    ('hat_beanie', {'w': 370, 'cx': 298, 'bottom': 188}),
    ('hat_bucket', {'w': 450, 'cx': 282, 'bottom': 190, 'sy': 0.85}),   # wider and lower, wraps the head (owner 2026-11-07)
    ('hat_hardhat', {'w': 400, 'cx': 298, 'bottom': 186}),
    ('hat_crown', {'w': 270, 'cx': 302, 'bottom': 174}),
    ('-hat_wizard', {'w': 340, 'cx': 262, 'bottom': 172}),   # removed 2026-11-07 (owner); '-' = cut but not written
    ('hat_detective', {'w': 410, 'cx': 298, 'bottom': 184}),
]
CLOTHING = [('clothing_blue', 372), ('clothing_purple_hoodie', 356), ('clothing_black_hoodie', 356),
            ('clothing_suit', 368), ('clothing_shirt_tie', 370), ('clothing_camo', 368)]
ACCESSORIES = [  # the first box is the 'none' tile
    None,
    # glasses: centred on the eyes (eye whites about x 195-308 / 312-409, y 206 on the 512 layer), big enough to cover them
    ('accessory_shades', {'w': 350, 'cx': 330, 'cy': 192}),
    ('accessory_round', {'w': 340, 'cx': 330, 'cy': 192}),
    ('accessory_orange', {'w': 340, 'cx': 330, 'cy': 192}),
    # the sheet draws them for the left side of a face: the cigarette body is mirrored (the smoke stays over
    # the lit end) and the pipe is mirrored whole, so the filter / mouthpiece sits in the mouth corner
    ('accessory_cigarette', {'w': 120, 'cx': 452, 'cy': 318, 'mirror': 'body'}),
    ('accessory_pipe', {'w': 130, 'cx': 452, 'cy': 344, 'mirror': 'all'}),
    ('accessory_headphones', {'w': 640, 'cx': 282, 'top': -30, 'behind_head': True}),
]
# single drawings from the owner (2026-11-07), transparent PNGs saved losslessly in source-v3/extra/
EXTRA_EYES = {'eyes_side': {'w': 330, 'cx': 304, 'cy': 192}, 'eyes_happy': {'w': 320, 'cx': 304, 'cy': 186},
              'eyes_hearts': {'w': 340, 'cx': 304, 'cy': 196}}
EXTRA_MOUTHS = {'mouth_shout': {'w': 150, 'cx': 300, 'top': 290}, 'mouth_wide_tongue': {'w': 215, 'cx': 300, 'top': 296},
                'mouth_laugh': {'w': 200, 'cx': 306, 'top': 290}}
BACKGROUNDS = ['bg_sunset', 'bg_sky', 'bg_night', 'bg_city', 'bg_snow', 'bg_forest']


def extra(name):
    return np.asarray(Image.open(os.path.join(SRC3, 'extra', name + '.webp')).convert('RGBA'))


def mirror(arr, how):
    if how == 'all':
        return arr[:, ::-1].copy()
    # 'body': flip only the largest piece (the cigarette), keep the rest (the smoke) where it is
    lab, n = nd.label(arr[..., 3] > 20)
    sizes = nd.sum(np.ones(lab.shape), lab, range(1, n + 1))
    body = lab == 1 + int(np.argmax(sizes))
    ys, xs = np.nonzero(body)
    out = arr.copy(); out[body] = 0
    x0, x1 = xs.min(), xs.max() + 1
    piece = np.where(body[..., None], arr, 0)[:, x0:x1][:, ::-1]
    view = out[:, x0:x1]
    keep = piece[..., 3] > view[..., 3]
    view[keep] = piece[keep]
    return out


def bare_body(tee, base):
    """'No shirt': the blue tee's outline filled with the frog's own green. The outline is drawn only
    where the body meets the background, so there is no collar line across the neck."""
    t = np.array(tee); b = np.array(base)
    sil = t[..., 3] > 40
    sil = nd.binary_fill_holes(sil)
    green = np.median(b[..., :3][(b[..., 3] > 200) & (b[..., 1] > b[..., 0] + 30)], axis=0)
    edge = sil & ~nd.binary_erosion(sil, iterations=6)
    outside = ~nd.binary_dilation(sil, iterations=1) & (b[..., 3] < 30)
    near_out = nd.binary_dilation(outside, iterations=7)
    line = edge & near_out
    out = np.zeros_like(t)
    out[sil, :3] = green.astype(np.uint8); out[sil, 3] = 255
    out[line, :3] = 0
    # the arms: keep the tee's two inner arm lines (dark strokes low on the body)
    dark = (t[..., 3] > 200) & (t[..., :3].max(-1) < 60)
    lab, n = nd.label(dark & ~nd.binary_dilation(edge, iterations=4))
    for i, sl in enumerate(nd.find_objects(lab)):
        if sl[0].start > 0.8 * WORK and (lab[sl] == i + 1).sum() > 200:
            out[lab == i + 1, :3] = 0
    return Image.fromarray(out)


def skin_patch(shape, base, top):
    b = np.array(base); m = np.array(shape)[..., 3] > 40
    m = nd.binary_fill_holes(m)
    green = np.median(b[..., :3][(b[..., 3] > 200) & (b[..., 1] > b[..., 0] + 30)], axis=0)
    out = np.zeros_like(b)
    out[m, :3] = green.astype(np.uint8); out[m, 3] = 255
    # keep the outline of the eye bumps where the patch meets the sky, so the head shape stays drawn
    edge = m & ~nd.binary_erosion(m, iterations=5) & nd.binary_dilation(b[..., 3] < 30, iterations=6)
    out[edge, :3] = 0
    img = Image.fromarray(out); img.alpha_composite(top)
    return img


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
    for lid, p in EXTRA_EYES.items():
        arr = extra(lid); layers[lid] = place(arr, **p); thumbs[lid] = thumb(arr)
    # closed eyes are only lines: lay them on a patch of skin shaped like the open eyes, so the
    # base drawing's eyelid arcs under the eyes do not show through as extra brows
    layers['eyes_happy'] = skin_patch(layers['eyes_classic'], base, layers['eyes_happy'])
    for lid, p in EXTRA_MOUTHS.items():
        arr = extra(lid); layers[lid] = place(arr, **p); thumbs[lid] = thumb(arr)
    hats = cut_cells('hats'); assert len(hats) == len(HATS)
    for spec, arr in zip(HATS, hats):
        if spec is None:
            thumbs['hat_none'] = thumb(arr); continue
        if spec[0].startswith('-'):
            continue
        layers[spec[0]] = place(arr, **spec[1]); thumbs[spec[0]] = thumb(arr)
    clothes = cut_clothing(); assert len(clothes) == len(CLOTHING), len(clothes)
    for (lid, top), arr in zip(CLOTHING, clothes):
        layers[lid] = under_chin(place(arr, w=600, cx=250, top=top), base); thumbs[lid] = thumb(arr)
    layers['clothing_none'] = bare_body(layers['clothing_blue'], base); thumbs['clothing_none'] = thumbs['hat_none']
    acc = cut_cells('accessories'); assert len(acc) == len(ACCESSORIES), len(acc)
    for spec, arr in zip(ACCESSORIES, acc):
        if spec is None:
            thumbs['accessory_none'] = thumb(arr); continue
        p = dict(spec[1]); behind = p.pop('behind_head', False); how = p.pop('mirror', None)
        if how:
            arr = mirror(arr, how)
        L = place(arr, **p)
        # headphones: the cups sit behind the face (worn on the ears), so the head covers their middle
        layers[spec[0]] = under_chin(L, base) if behind else L
        thumbs[spec[0]] = thumb(arr)
    for lid, img in zip(BACKGROUNDS, cut_backgrounds()):
        layers[lid] = img; thumbs[lid] = thumb(img.resize((THUMB[0], THUMB[0])).crop((0, 12, THUMB[0], 12 + THUMB[1])))
    empty = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    for lid in ('hat_none', 'accessory_none'):
        layers[lid] = empty
    return layers, thumbs


def save(layers, thumbs, only=None):
    # --only id,id,...: write just those layers and thumbs and leave every other file as it is
    # (the special avatars come from scripts/build_special_avatars.mjs and must not be deleted)
    if only:
        layers = {k: v for k, v in layers.items() if k in only}
        thumbs = {k: v for k, v in thumbs.items() if k in only}
    for d in (OUT_DIR, THUMB_DIR):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith('.webp') and not only:
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
    save(L, T, sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None)
    if '--sheet' in sys.argv:
        out = sys.argv[sys.argv.index('--sheet') + 1]
        H = [h[0] for h in HATS if h] + ['hat_none']
        A = [a[0] for a in ACCESSORIES if a] + ['accessory_none']
        looks = []
        for i in range(12):
            looks.append({'bg': BACKGROUNDS[i % 6], 'clothing': CLOTHING[i % 6][0], 'mouth': MOUTHS[i % 6],
                          'eyes': EYES[(i + 1) % 6], 'hat': H[i % len(H)], 'accessory': A[i % len(A)]})
        test_sheet(L, out, looks)
