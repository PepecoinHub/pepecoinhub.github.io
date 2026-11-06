#!/usr/bin/env python3
"""Build the Fren Avatar layers from the hand-drawn source sheets.

Input:  games/fren-avatar/source/*.webp  (the ChatGPT art, transparent sheets, lossless)
Output: docs/meme/avatar-assets/layers/<id>.webp  (one 512x512 layer per option)

Every layer is a full 512x512 canvas with the part already in its final place,
so the Avatar Maker just stacks them with no offsets. All placement numbers live
in PLACE below, in the base drawing's own 512 coordinates. The base is drawn a
little smaller on the canvas (VIEW) so tall hats and headphones fit.

Needs Pillow, numpy and scipy (not used by the site itself):
    pip install pillow numpy scipy
    python3 scripts/build_avatar_layers.py           # write layers
    python3 scripts/build_avatar_layers.py --sheet out.jpg  # also a test sheet
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games', 'fren-avatar', 'source')
OUT_DIR = os.path.join(ROOT, 'docs', 'meme', 'avatar-assets', 'layers')

WORK = 1024        # composed at 2x, then saved at 512
SIZE = 512
VX, VY, VS = -64, -72, 656   # visible window in base units: x -64..592, y -72..584
K = WORK / VS


def tx(x): return (x - VX) * K
def ty(y): return (y - VY) * K


def sheet(name):
    return np.array(Image.open(os.path.join(SRC, name + '.webp')).convert('RGBA'))


# ---------------------------------------------------------------- cutting
def _runs(v, mingap):
    idx = np.where(v)[0]
    if not len(idx):
        return []
    spans = [[idx[0], idx[0] + 1]]
    for i in idx[1:]:
        if i - spans[-1][1] < mingap:
            spans[-1][1] = i + 1
        else:
            spans.append([i, i + 1])
    return spans


def cut_grid(name, colgap=8):
    """Items laid out in rows with empty space between them."""
    a = sheet(name); m = a[..., 3] > 20; out = []
    for r0, r1 in _runs(m.any(1), 25):
        for c0, c1 in _runs(m[r0:r1].any(0), colgap):
            sub = m[r0:r1, c0:c1]
            if sub.sum() < 1500:
                continue
            ys, xs = np.where(sub)
            out.append(a[r0 + ys.min():r0 + ys.max() + 1, c0 + xs.min():c0 + xs.max() + 1])
    return out


def cut_blobs(name, dil, merge_small=0):
    """Items separated only by shape (touching boxes): connected components."""
    a = sheet(name); m = a[..., 3] > 20
    lab, _ = nd.label(nd.binary_dilation(m, iterations=dil))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab)):
        area = ((lab[sl] == i + 1) & m[sl]).sum()
        if area < 300:
            continue
        comps.append([sl[0].start, sl[0].stop, sl[1].start, sl[1].stop, area, i + 1])
    big = [c for c in comps if c[4] > merge_small]
    for s in [c for c in comps if c[4] <= merge_small]:
        cy, cx = (s[0] + s[1]) / 2, (s[2] + s[3]) / 2
        b = min(big, key=lambda b: abs((b[2] + b[3]) / 2 - cx) + 3 * abs((b[0] + b[1]) / 2 - cy))
        b[0], b[1], b[2], b[3] = min(b[0], s[0]), max(b[1], s[1]), min(b[2], s[2]), max(b[3], s[3])
    rows = a.shape[0] / 2
    big.sort(key=lambda c: (c[0] > rows * 0.85, c[2]))
    return [a[y0:y1, x0:x1] for y0, y1, x0, x1, _, _ in big]


def cut_accessories():
    a = sheet('accessories'); m = a[..., 3] > 20
    lab, _ = nd.label(nd.binary_dilation(m, iterations=22))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab)):
        keep = lab[sl] == i + 1
        if (keep & m[sl]).sum() < 1500:
            continue
        sub = a[sl].copy(); sub[~keep] = 0
        ys, xs = np.where(sub[..., 3] > 20)
        comps.append((sl[0].start, sl[1].start, sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    # chain (top-left), scarf (top-right), headphones (bottom-right), pin (bottom-left)
    tl = min(comps, key=lambda c: c[0] + c[1])
    tr = min(comps, key=lambda c: c[0] - c[1])
    br = max(comps, key=lambda c: c[0] + c[1])
    bl = max(comps, key=lambda c: c[0] - c[1])
    return [tl[2], tr[2], br[2], bl[2]]


# ---------------------------------------------------------------- placing
def glass(arr, alpha=70):
    """Astronaut helmet: the big white visor becomes see-through glass."""
    a = arr.copy()
    white = (a[..., :3].min(-1) > 222) & (a[..., 3] > 200)
    lab, n = nd.label(white)
    if n:
        sizes = nd.sum(white, lab, range(1, n + 1))
        a[lab == int(np.argmax(sizes)) + 1, 3] = alpha
    return a


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
    b = Image.open(os.path.join(SRC, 'base.webp')).convert('RGBA')
    b = b.resize((round(512 * K), round(512 * K)), Image.LANCZOS)
    cv = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    cv.paste(b, (round(tx(0)), round(ty(0))), b)
    return cv


def under_chin(layer, base):
    m = Image.new('L', (WORK, WORK), 0)
    ImageDraw.Draw(m).polygon([(tx(x), ty(y)) for x, y in JAW] + [(WORK, 0), (0, 0)], fill=255)
    a = np.array(layer)
    a[(np.array(m) > 0) & (np.array(base)[..., 3] > 30), 3] = 0
    return Image.fromarray(a)


# id -> (source list, index, placement). Placement is in base units.
PLACE = {
    'eyes': {'w': 330, 'cx': 304, 'top': 112},
    'mouth': {'w': 230, 'cx': 300, 'cy': 322},
}
EYES = ['eyes_classic', 'eyes_sleepy', 'eyes_wide', 'eyes_shades', 'eyes_round', 'eyes_3d']
MOUTHS = ['mouth_smile', 'mouth_grin', 'mouth_open', 'mouth_tongue', 'mouth_flat', 'mouth_smirk']
HATS = [
    ('hat_pep_cap', {'w': 330, 'cx': 268, 'bottom': 172}),
    ('hat_beanie', {'w': 320, 'cx': 268, 'bottom': 172}),
    ('hat_bucket', {'w': 360, 'cx': 268, 'bottom': 182}),
    ('hat_crown', {'w': 250, 'cx': 262, 'bottom': 174}),
    ('hat_astronaut', {'w': 520, 'cx': 262, 'cy': 250}),
    ('hat_hardhat', {'w': 340, 'cx': 268, 'bottom': 176}),
    ('hat_detective', {'w': 340, 'cx': 268, 'bottom': 182}),
    ('hat_fedora', {'w': 400, 'cx': 268, 'bottom': 176}),
]
CLOTHING = [
    ('clothing_blue', 378), ('clothing_purple_hoodie', 330), ('clothing_black_hoodie', 330),
    ('clothing_white_pep', 374), ('clothing_orange_vest', 366), ('clothing_suit', 358),
]
ACCESSORIES = [
    ('accessory_chain', {'w': 230, 'cx': 236, 'top': 440, 'neck': True}),
    ('accessory_scarf', {'w': 320, 'cx': 250, 'top': 410, 'neck': True}),
    ('accessory_headphones', {'w': 540, 'cx': 282, 'top': 64}),
    ('accessory_pin', {'w': 56, 'cx': 150, 'cy': 520}),
]
# backgrounds sheet is a 2x2 grid of framed tiles; the frame is trimmed off
BACKGROUNDS = [('bg_pond', 0), ('bg_solid_green', 1), ('bg_sunset', 2), ('bg_meadow', 3)]


def build():
    base = base_layer()
    layers = {'base_frog': base}
    for lid, arr in zip(EYES, cut_grid('eyes')):
        layers[lid] = place(arr, **PLACE['eyes'])
    for lid, arr in zip(MOUTHS, cut_grid('mouths')):
        layers[lid] = place(arr, **PLACE['mouth'])
    hats = cut_blobs('hats', dil=2, merge_small=4000)
    assert len(hats) == len(HATS), 'expected %d hats, found %d' % (len(HATS), len(hats))
    for (lid, p), arr in zip(HATS, hats):
        layers[lid] = place(glass(arr) if lid == 'hat_astronaut' else arr, **p)
    clothes = cut_grid('clothing')
    for (lid, top), arr in zip(CLOTHING, clothes):
        layers[lid] = under_chin(place(arr, w=610, cx=250, top=top), base)
    for (lid, p), arr in zip(ACCESSORIES, cut_accessories()):
        p = dict(p); neck = p.pop('neck', False)
        L = place(arr, **p)
        layers[lid] = under_chin(L, base) if neck else L
    bg = Image.open(os.path.join(SRC, 'backgrounds.webp')).convert('RGBA')
    tiles = [(16, 16, 502, 502), (522, 16, 1008, 502), (16, 522, 502, 1008), (522, 522, 1008, 1008)]
    for lid, i in BACKGROUNDS:
        x0, y0, x1, y1 = tiles[i]; ins = 12
        layers[lid] = bg.crop((x0 + ins, y0 + ins, x1 - ins, y1 - ins)).resize((WORK, WORK), Image.LANCZOS)
    empty = Image.new('RGBA', (WORK, WORK), (0, 0, 0, 0))
    for lid in ('bg_none', 'hat_none', 'accessory_none'):
        layers[lid] = empty
    return layers


def save(layers):
    os.makedirs(OUT_DIR, exist_ok=True)
    for lid, img in layers.items():
        img.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT_DIR, lid + '.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    print('wrote %d layers to %s' % (len(layers), os.path.relpath(OUT_DIR, ROOT)))


if __name__ == '__main__':
    L = build()
    save(L)
