"""Draw three PondOS desktop icons in the classic 98 style.

- recycle-bin: a grey wire basket with green recycling arrows and paper inside
- internet: a globe (an original design, no browser logo)
- wp-folder: the Pepe Guesser folder, with Pepe peeking out of it so the icon fills its box

Writes docs/meme/img/recycle-bin.webp and docs/meme/img/internet.webp (128 px sources; make_meme_icons.py
turns them into icons) plus docs/meme/img/ico/{recycle-bin,internet,wp-folder}.webp (96 px).
Run: python3 scripts/make_classic_icons.py
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'meme', 'img')
S = 4            # draw at 4x, then shrink: clean edges
N = 128 * S      # working canvas


def P(v):
    return v * S


def W(v):             # line widths must be whole pixels
    return max(1, round(v * S))


def finish(img, name, src=True):
    small = img.resize((128, 128), Image.LANCZOS)
    if src:
        small.save(os.path.join(ROOT, name + '.webp'), 'WEBP', lossless=True)
    ico = small.resize((96, 96), Image.LANCZOS)
    ico.save(os.path.join(ROOT, 'ico', name + '.webp'), 'WEBP', quality=90, method=6)


# ---------------------------------------------------------------- recycle bin
def recycle_bin():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    OUT = (52, 52, 56, 255)
    cx, top, bot = 64, 27, 113
    tl, tr, bl, br = 21, 107, 34, 94          # body: top left/right, bottom left/right

    def edge_x(y, side):                      # x of the left/right body edge at height y
        t = (y - top) / (bot - top)
        return (tl + (bl - tl) * t) if side < 0 else (tr + (br - tr) * t)

    # body, shaded left (light) to right (dark), inside a mask
    body = Image.new('L', (N, N), 0)
    bd = ImageDraw.Draw(body)
    bd.polygon([(P(tl), P(top)), (P(tr), P(top)), (P(br), P(bot)), (P(bl), P(bot))], fill=255)
    bd.ellipse([P(bl), P(bot - 6), P(br), P(bot + 6)], fill=255)
    xs = np.linspace(0, 1, N)
    shade = np.clip(1.0 - 0.55 * xs ** 1.6 + 0.08 * np.exp(-((xs - 0.3) / 0.12) ** 2), 0, 1)
    rgb = np.zeros((N, N, 4), np.uint8)
    for i, (a, b) in enumerate([(150, 246), (150, 246), (156, 250)]):
        rgb[:, :, i] = (a + (b - a) * shade)[None, :]
    rgb[:, :, 3] = np.array(body)
    im.alpha_composite(Image.fromarray(rgb, 'RGBA'))

    # wire mesh: vertical wires that narrow towards the bottom, and curved rings
    mesh = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    md = ImageDraw.Draw(mesh)
    for i in range(-6, 7):
        x0 = cx + i * 6.6
        x1 = cx + i * 4.7
        md.line([(P(x0), P(top + 4)), (P(x1), P(bot + 4))], fill=(96, 98, 104, 255), width=W(1.6))
    for y in range(37, bot, 10):
        l, r = edge_x(y, -1), edge_x(y, 1)
        md.arc([P(l), P(y - 6), P(r), P(y + 6)], 0, 180, fill=(104, 106, 112, 255), width=W(1.7))
    mesh.putalpha(Image.fromarray(np.minimum(np.array(mesh.getchannel('A')), np.array(body))))
    im.alpha_composite(mesh)

    # a solid band near the bottom, like the foot of a wire basket
    band = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    bnd = ImageDraw.Draw(band)
    l, r = edge_x(bot - 6, -1), edge_x(bot - 6, 1)
    bnd.arc([P(l), P(bot - 12), P(r), P(bot)], 0, 180, fill=(70, 72, 78, 255), width=W(3.2))
    band.putalpha(Image.fromarray(np.minimum(np.array(band.getchannel('A')), np.array(body))))
    im.alpha_composite(band)

    d = ImageDraw.Draw(im)
    # body outline
    d.line([(P(tl), P(top)), (P(bl), P(bot))], fill=OUT, width=W(2.4))
    d.line([(P(tr), P(top)), (P(br), P(bot))], fill=OUT, width=W(2.4))
    d.arc([P(bl), P(bot - 6), P(br), P(bot + 6)], 0, 180, fill=OUT, width=W(2.4))

    # recycling arrows on the front: three arrows chasing round a triangle
    gx, gy, R = 64, 73, 19.5
    V = [(gx + R * math.cos(math.radians(a)), gy - R * math.sin(math.radians(a))) for a in (90, 210, 330)]
    plate = [(P(x), P(y)) for x, y in V]
    w = 4.4
    arrows = []
    for k in range(3):
        (ax, ay), (bx, by) = V[k], V[(k + 1) % 3]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        nx, ny = -uy, ux
        s = (ax + ux * L * 0.14, ay + uy * L * 0.14)
        e = (ax + ux * L * 0.62, ay + uy * L * 0.62)
        shaft = [(s[0] + nx * w / 2, s[1] + ny * w / 2), (e[0] + nx * w / 2, e[1] + ny * w / 2),
                 (e[0] - nx * w / 2, e[1] - ny * w / 2), (s[0] - nx * w / 2, s[1] - ny * w / 2)]
        hl = w * 1.9
        head = [(e[0] + nx * w * 1.25, e[1] + ny * w * 1.25), (e[0] + ux * hl, e[1] + uy * hl),
                (e[0] - nx * w * 1.25, e[1] - ny * w * 1.25)]
        arrows.append((shaft, head))
    # a soft light patch behind the logo keeps it readable over the mesh
    pad = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(pad).ellipse([P(gx - 21), P(gy - 20), P(gx + 21), P(gy + 19)], fill=(240, 242, 244, 210))
    im.alpha_composite(pad)
    d = ImageDraw.Draw(im)
    for shaft, head in arrows:              # dark rim first, then the green on top
        for poly in (shaft, head):
            d.polygon([(P(x), P(y)) for x, y in poly], fill=(14, 88, 34, 255), outline=(14, 88, 34, 255), width=W(2.6))
    for shaft, head in arrows:
        for poly in (shaft, head):
            d.polygon([(P(x), P(y)) for x, y in poly], fill=(38, 170, 70, 255))
    del plate

    # the opening: rim ring, dark inside, paper, then the front half of the rim over the paper
    d.ellipse([P(18), P(15), P(110), P(39)], fill=(232, 233, 236, 255), outline=OUT, width=W(2.4))
    d.ellipse([P(24), P(19), P(104), P(35)], fill=(58, 60, 66, 255))
    # crumpled paper ball and a folded sheet sticking out
    d.polygon([(P(40), P(30)), (P(36), P(18)), (P(43), P(8)), (P(55), P(6)), (P(63), P(14)), (P(61), P(27)), (P(52), P(32))],
              fill=(252, 252, 250, 255), outline=(120, 122, 128, 255), width=W(1.6))
    d.line([(P(43), P(12)), (P(50), P(19)), (P(46), P(26))], fill=(150, 152, 158, 255), width=W(1.3))
    d.line([(P(55), P(10)), (P(52), P(19)), (P(58), P(24))], fill=(150, 152, 158, 255), width=W(1.3))
    d.polygon([(P(66), P(30)), (P(72), P(4)), (P(92), P(9)), (P(86), P(32))],
              fill=(255, 249, 214, 255), outline=(120, 122, 128, 255), width=W(1.6))
    for k in range(3):
        y = 12 + k * 5
        d.line([(P(74 + k * 0.4), P(y)), (P(87 - k * 0.6), P(y + 3.4))], fill=(150, 160, 190, 255), width=W(1.2))
    # front half of the rim ring
    front = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front)
    fd.ellipse([P(18), P(15), P(110), P(39)], fill=(232, 233, 236, 255))
    fd.ellipse([P(24), P(19), P(104), P(35)], fill=(0, 0, 0, 0))
    cut = Image.new('L', (N, N), 0)
    ImageDraw.Draw(cut).rectangle([0, P(27), N, N], fill=255)
    front.putalpha(Image.fromarray(np.minimum(np.array(front.getchannel('A')), np.array(cut))))
    im.alpha_composite(front)
    d = ImageDraw.Draw(im)
    d.arc([P(18), P(15), P(110), P(39)], 0, 180, fill=OUT, width=W(2.4))
    d.arc([P(24), P(19), P(104), P(35)], 0, 180, fill=(120, 122, 128, 255), width=W(1.4))
    d.arc([P(18), P(15), P(110), P(39)], 180, 360, fill=OUT, width=W(2.4))
    finish(im, 'recycle-bin')


# ---------------------------------------------------------------- globe
def globe():
    cx = cy = N / 2
    r = P(55)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
    X = (xx - cx) / r
    Y = (cy - yy) / r
    rr = X * X + Y * Y
    inside = rr <= 1.0
    Z = np.sqrt(np.clip(1 - rr, 0, 1))
    # tilt the globe a little, then turn it so Europe and Africa face the viewer
    tilt = math.radians(18)
    Y2 = Y * math.cos(tilt) + Z * math.sin(tilt)
    Z2 = -Y * math.sin(tilt) + Z * math.cos(tilt)
    lat = np.degrees(np.arcsin(np.clip(Y2, -1, 1)))
    lon = np.degrees(np.arctan2(X, Z2)) - 8

    def blob(la, lo, rad):
        dl = (lon - lo + 180) % 360 - 180
        return np.exp(-(((lat - la) / rad) ** 2 + ((dl * np.cos(np.radians(la))) / rad) ** 2))

    land = (blob(50, 12, 13) + blob(58, 38, 16) + blob(44, 70, 18) + blob(8, 20, 17) + blob(-14, 26, 13)
            + blob(22, 5, 11) + blob(28, 48, 9) + blob(42, -100, 18) + blob(58, -115, 15) + blob(18, -95, 8)
            + blob(-12, -58, 14) + blob(-32, -64, 8) + blob(-25, 135, 12) + blob(66, -40, 9))
    noise = (np.sin(np.radians(lat) * 9 + np.radians(lon) * 4) * np.sin(np.radians(lon) * 11 - np.radians(lat) * 3)) * 0.12
    is_land = (land + noise) > 0.55

    # light from the top left
    Lx, Ly, Lz = -0.5, 0.6, 0.62
    n = math.sqrt(Lx * Lx + Ly * Ly + Lz * Lz)
    light = np.clip((X * Lx + Y * Ly + Z * Lz) / n, 0, 1)
    k = 0.38 + 0.72 * light
    ocean = np.stack([30 + 60 * light, 92 + 90 * light, 196 + 50 * light], -1)
    ground = np.stack([46 + 70 * light, 140 + 70 * light, 52 + 40 * light], -1) * np.clip(k[..., None], 0.55, 1.1)
    col = np.where(is_land[..., None], ground, ocean)
    # latitude and longitude lines
    grid = (np.abs(((lat + 90) % 30) - 15) > 14.2) | (np.abs(((lon + 180) % 30) - 15) > 14.25)
    col = np.where((grid & inside)[..., None], col * 0.6 + np.array([220, 236, 255]) * 0.4, col)
    # shine
    spec = np.exp(-(((X + 0.42) / 0.26) ** 2 + ((Y - 0.48) / 0.18) ** 2)) * 0.75
    col = col * (1 - spec[..., None]) + 255 * spec[..., None]
    rgba = np.zeros((N, N, 4), np.uint8)
    rgba[..., :3] = np.clip(col, 0, 255)
    rgba[..., 3] = np.where(inside, 255, 0)
    im = Image.fromarray(rgba, 'RGBA')
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(10, 38, 92, 255), width=W(2.6))
    finish(im, 'internet')


# ---------------------------------------------------------------- Pepe Guesser folder
def wp_folder():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    OUT = (150, 116, 28, 255)
    d.rounded_rectangle([P(6), P(26), P(56), P(46)], radius=P(5), fill=(214, 172, 52, 255), outline=OUT, width=W(2.4))
    d.rounded_rectangle([P(6), P(36), P(122), P(118)], radius=P(6), fill=(214, 172, 52, 255), outline=OUT, width=W(2.4))
    pepe = Image.open(os.path.join(ROOT, 'wp-pepe.webp')).convert('RGBA')
    w = P(112)
    h = round(pepe.height * w / pepe.width)
    pepe = pepe.resize((w, h), Image.LANCZOS)
    im.alpha_composite(pepe, (P(9), P(1)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([P(6), P(80), P(122), P(118)], radius=P(6), fill=(238, 200, 78, 255), outline=OUT, width=W(2.4))
    d.line([(P(10), P(84)), (P(118), P(84))], fill=(252, 226, 140, 255), width=W(2.2))
    small = im.resize((128, 128), Image.LANCZOS).resize((96, 96), Image.LANCZOS)
    small.save(os.path.join(ROOT, 'ico', 'wp-folder.webp'), 'WEBP', quality=90, method=6)


if __name__ == '__main__':
    recycle_bin()
    globe()
    wp_folder()
    print('ok')
