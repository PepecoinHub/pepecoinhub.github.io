"""Split the two PondOS wallpapers into layers for the living desktop.

Day  (docs/meme/img/wall-day.webp):   Pepe peeks over the green hill like the sun.
Night (docs/meme/img/wall-night.webp): sad Pepe hangs over the mountains like the moon.

For each picture this writes three files to docs/meme/img/sky/:
  <name>-sky.webp    the whole picture with Pepe painted out (the sky filled in where he stood)
  <name>-pepe.webp   Pepe alone, transparent around him, cropped to his box
  <name>-front.webp  the hill / mountains under Pepe, transparent above, cropped to his columns
and prints the box of each cut-out as percentages, for meme.css.

Stacked back in that order (sky, pepe, front) the layers give the original picture. Moving
the Pepe layer down hides him behind the hill or the mountains: that is the sunset and moonset.

Only Pillow and numpy. The sky behind Pepe is filled by copying sky from further along the
picture and blending its edges in (a small Poisson fill), so clouds and stars keep their grain.

    python scripts/build_sky_layers.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'docs', 'meme', 'img')
OUT = os.path.join(IMG, 'sky')


def dilate(m, r):
    out = m.copy()
    for _ in range(r):
        o = out.copy()
        o[1:, :] |= out[:-1, :]
        o[:-1, :] |= out[1:, :]
        o[:, 1:] |= out[:, :-1]
        o[:, :-1] |= out[:, 1:]
        out = o
    return out


def erode(m, r):
    return ~dilate(~m, r)


def outside(barrier, seeds):
    """Pixels reachable from the seeds without crossing the barrier."""
    h, w = barrier.shape
    im = Image.fromarray(np.where(barrier, 0, 255).astype(np.uint8)).copy()
    for x, y in seeds:
        if im.getpixel((x, y)) == 255:
            ImageDraw.floodfill(im, (x, y), 128)
    return np.asarray(im) == 128


def poisson_fill(img, hole, src, valid, wall):
    """Fill `hole` so its texture follows `src` and its edges meet `img` (Jacobi, coarse to fine).

    `wall` pixels (the hill, the mountains) are not used as edges: the fill only takes its
    colours from the sky around it, so the ground does not bleed up into it."""
    img = img.astype(np.float64)
    src = src.astype(np.float64)

    def nb(a):
        p = np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2), mode='edge')
        return [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]]

    def solve(I, H, G, V, Wt, iters):
        wn = nb(Wt)
        den = np.maximum(sum(wn), 1e-9)[..., None]
        for _ in range(iters):
            vn = nb(V)
            avg = sum(v * w[..., None] for v, w in zip(vn, wn)) / den
            V = np.where(H[..., None], avg + G, I)
        return V

    def down(a, how):
        h2, w2 = a.shape[0] // 2, a.shape[1] // 2
        a = a[:h2 * 2, :w2 * 2].reshape((h2, 2, w2, 2) + a.shape[2:])
        return getattr(a, how)(axis=(1, 3))

    levels = []
    I, H, S, K, Wt = img, hole, src, valid.astype(np.float64), (~wall).astype(np.float64)
    while min(I.shape[:2]) > 40:
        levels.append((I, H, S, K, Wt))
        I, S, H, K, Wt = down(I, 'mean'), down(S, 'mean'), down(H, 'any'), down(K, 'min'), down(Wt, 'max')
    levels.append((I, H, S, K, Wt))
    V = None
    for I, H, S, K, Wt in reversed(levels):
        # follow the copied sky's texture only where all of it is real sky; elsewhere stay smooth
        Kn = np.minimum.reduce([K] + nb(K)) * np.minimum.reduce([Wt] + nb(Wt))
        G = np.zeros_like(S)
        if V is None:
            V = np.where(H[..., None], S, I)
            iters = 3000
        else:
            up = np.repeat(np.repeat(V, 2, axis=0), 2, axis=1)
            full = np.pad(up, ((0, I.shape[0] - up.shape[0]), (0, I.shape[1] - up.shape[1]), (0, 0)), mode='edge')
            V = np.where(H[..., None], full[:I.shape[0], :I.shape[1]], I)
            iters = 400
        V = solve(I, H, G, V, Wt, iters)
    # the smooth fill above has the right colours; lay the copied sky's fine detail (cloud edges,
    # stars) on top. Only the detail: its broad brightness stays the fill's, so no dark or light blobs.
    detail = 0.55 * (src - box_blur(src, 6)) * valid[..., None]
    return np.clip(np.where(hole[..., None], V + detail, V), 0, 255)


def box_blur(a, r):
    """Mean over a (2r+1) square, edges clamped."""
    out = a.astype(np.float64)
    for axis in (0, 1):
        pad = [(0, 0)] * out.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(out, pad, mode='edge'), axis=axis)
        n = out.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(0, n), axis=axis)
        out = (hi - lo) / (2 * r + 1)
    return out


def shifted(a, dx):
    """a moved by dx columns, mirrored at the picture's edges."""
    w = a.shape[1]
    xs = np.arange(w) + dx
    xs = np.where(xs < 0, -xs, xs)
    xs = np.where(xs >= w, 2 * (w - 1) - xs, xs)
    return a[:, xs], xs


def save(arr, name, box=None, alpha=None):
    os.makedirs(OUT, exist_ok=True)
    a = arr.astype(np.uint8)
    if alpha is not None:
        a = np.dstack([a, (alpha * 255).astype(np.uint8)])
    if box:
        x0, y0, x1, y1 = box
        a = a[y0:y1, x0:x1]
    im = Image.fromarray(a, 'RGBA' if alpha is not None else 'RGB')
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=82, method=6, **({'exact': False} if alpha is not None else {}))
    return os.path.getsize(path)


def bbox(m, pad, shape):
    ys, xs = np.nonzero(m)
    h, w = shape
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad + 1), min(h, ys.max() + pad + 1))


def build(name, path, pepe_core, ground, region, seeds, dx, glow, close=2, extra=None):
    img = np.asarray(Image.open(path).convert('RGB')).astype(int)
    h, w = img.shape[:2]
    rx0, ry0, rx1, ry1 = region
    r, g, b = img[..., 0], img[..., 1], img[..., 2]

    inreg = np.zeros((h, w), bool)
    inreg[ry0:ry1, rx0:rx1] = True
    core = pepe_core(r, g, b) & inreg
    # the ground is what looks like ground AND is joined to the bottom of the picture,
    # so dark bits of Pepe (his outline, his chin) never count as hill or mountain
    cand = ground(r, g, b)
    gnd = outside(~cand, [(x, h - 1) for x in range(0, w, 7)])
    barrier = dilate(core, close) | gnd
    sky = outside(barrier | ~inreg, seeds) | ~inreg
    # the barrier was fattened by `close` to seal gaps in the outline; take that ring back off
    pepe = erode(~sky | gnd, max(0, close - 1)) & ~gnd
    # close small gaps and drop specks
    pepe = erode(dilate(pepe, 2), 2) & ~gnd
    pepe = dilate(erode(pepe, 2), 2)
    if extra is not None:
        pepe |= extra(h, w)
    # stray bits of his outline just outside the mask belong to him too
    pepe |= core & dilate(pepe, 8) & ~gnd
    pepe &= inreg

    # Pepe's own layer keeps his outline glow; the hole in the sky is a little wider than that
    cut = dilate(pepe, glow) & ~gnd & inreg
    hole = dilate(cut, 6) & inreg & ~gnd

    # the ground line: under each column, the first row below Pepe where solid ground starts
    cols = np.nonzero(cut.any(axis=0))[0]
    gx0, gx1 = max(0, cols.min() - 8), min(w, cols.max() + 9)
    line = np.full(w, h, int)
    run = 10
    for x in range(gx0, gx1):
        below = np.nonzero(cut[:, x])[0]
        y = below.max() + 1 if len(below) else ry0
        col = gnd[:, x]
        while y < h - run and not col[y:y + run].all():
            y += 1
        line[x] = y
    sm = line.copy()
    for x in range(gx0, gx1):
        sm[x] = int(np.median(line[max(gx0, x - 2):min(gx1, x + 3)]))
    # never let the smoothing lift the line over Pepe's own pixels
    for x in range(gx0, gx1):
        below = np.nonzero(cut[:, x])[0]
        if len(below):
            sm[x] = max(sm[x], below.max() + 1)
    line = sm
    yy = np.arange(h)[:, None]
    front = (yy >= line[None, :])
    front[:, :gx0] = False
    front[:, gx1:] = False

    src, xs = shifted(img, dx)
    bad = dilate(hole, 2)[:, xs] | gnd[:, xs]
    filled = img.astype(np.float64).copy()
    pad = 12
    bx0, by0, bx1, by1 = bbox(hole, pad, (h, w))
    sub = poisson_fill(img[by0:by1, bx0:bx1], hole[by0:by1, bx0:bx1], src[by0:by1, bx0:bx1], ~bad[by0:by1, bx0:bx1], gnd[by0:by1, bx0:bx1])
    filled[by0:by1, bx0:bx1] = sub
    # a whisper of grain so the filled patch is not smoother than the photo around it
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 1.6, filled.shape)
    filled = np.clip(np.where(hole[..., None], filled + noise, filled), 0, 255)
    filled = np.where(front[..., None] & ~hole[..., None], img, filled)

    # soft 1px edges on the cut-outs
    pa = cut.astype(np.float64)
    pa = (pa + erode(cut, 1)) / 2.0
    fa = front.astype(np.float64)
    fa = np.where(front & ~erode(front, 1), 0.6, fa)

    pbox = bbox(cut, 1, (h, w))
    fys = np.nonzero(front.any(axis=1))[0]
    fbox = (gx0, int(fys.min()), gx1, h)
    sizes = {
        'sky': save(filled, name + '-sky.webp'),
        'pepe': save(img, name + '-pepe.webp', pbox, pa),
        'front': save(img, name + '-front.webp', fbox, fa),
    }
    pct = lambda bx: {'left': round(bx[0] / w * 100, 3), 'top': round(bx[1] / h * 100, 3),
                      'width': round((bx[2] - bx[0]) / w * 100, 3), 'height': round((bx[3] - bx[1]) / h * 100, 3)}
    # how far Pepe must sink, as a share of his own height, to be fully behind the ground
    sink = (int(line[pbox[0]:pbox[2]].max()) - pbox[1]) / (pbox[3] - pbox[1])
    return {'size': [w, h], 'pepe': pct(pbox), 'front': pct(fbox), 'sink': round(sink + 0.04, 3), 'bytes': sizes}


def main():
    info = {}
    day = np.asarray(Image.open(os.path.join(IMG, 'wall-day.webp')).convert('RGB')).astype(int)
    dy = np.arange(day.shape[0])[:, None]
    info['day'] = build(
        'day', os.path.join(IMG, 'wall-day.webp'),
        pepe_core=lambda r, g, b: (((g > r + 30) & (g > b + 40) & (b > 35)) |   # skin
                                   ((r + g + b < 300) & (b < 140)) |             # outline
                                   ((r < 45) & (b > 150)) |                      # shirt
                                   ((r > g + 30) & (r > b))),                    # mouth
        # the hill: yellow-green grass under the horizon (Pepe's skin is bluer and greener)
        ground=lambda r, g, b: (dy > 330) & (b < 80) & (g > b + 20) & (g - r < 38),
        region=(20, 110, 690, 400), seeds=[(25, 115), (685, 115), (685, 300), (25, 250)],
        dx=560, glow=8)

    # night: Pepe sits behind the mountains; they are darker than the sky just above them
    n = np.asarray(Image.open(os.path.join(IMG, 'wall-night.webp')).convert('RGB')).astype(int)
    r, g, b = n[..., 0], n[..., 1], n[..., 2]
    lum = n.mean(axis=2)
    yy = np.arange(n.shape[0])[:, None]
    pepeish = ((g >= b - 4) & (g > r + 5)) | ((b > g + 60) & (b > 170)) | ((r > g + 30) & (r > b + 20))
    outline = ((r + g + b < 130) & (b < 80)) | ((r + g + b < 240) & (b - g < 30))
    # his chin outline dips to about y=400 and touches the peaks: keep it out of the mountains
    mountain = (yy > 360) & (lum < 160) & ~pepeish & ~(outline & (yy < 405))
    # a dark line with Pepe both above and below it (between his chin and his shirt) is Pepe, not rock
    above = np.zeros_like(pepeish)
    below = np.zeros_like(pepeish)
    for k in range(1, 26):
        above[k:] |= pepeish[:-k]
        below[:-k] |= pepeish[k:]
    mountain &= ~(above & below)
    info['night'] = build(
        'night', os.path.join(IMG, 'wall-night.webp'),
        pepe_core=lambda r, g, b: pepeish | outline,
        ground=lambda r, g, b: mountain,
        region=(1120, 0, 1600, 470), seeds=[(1125, 5), (1125, 300), (1300, 2)],
        dx=-520, glow=3, close=6,
        # his eyes run out to the edge of his face with no outline, so the flood gets in: add them by hand
        extra=lambda h, w: (((np.arange(w)[None, :] - 1338) / 158.0) ** 2 + ((np.arange(h)[:, None] - 173) / 38.0) ** 2) <= 1)
    print(json.dumps(info, indent=1))
    # the lines meme.css needs (living sky section)
    for k, v in info.items():
        for part in ('pepe', 'front'):
            b = v[part]
            print('.scene-%s .sky-%s { left: %s%%; top: %s%%; width: %s%%; height: %s%%; }' % (k, part, b['left'], b['top'], b['width'], b['height']))
        print('/* %s: sink %d%% */' % (k, round(v['sink'] * 100)))


if __name__ == '__main__':
    main()
