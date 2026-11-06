#!/usr/bin/env python3
"""Cut the Avatar Maker window art from the owner's mockup.

Source: games/fren-avatar/source-v3/maker-mockup.webp (lossless, 1024x768). Only decoration is
reused; the sample Pepe inside the photo frame is removed (the window shows the player's own Fren).

Writes docs/meme/avatar-assets/maker/:
  header.webp  the dark green title band (Fren Passport laurel logo, passport icon, "Avatar Maker")
  frame.webp   the taped photo frame; its photo window is transparent
  icons.webp   one row of 9 icons, 48x48 cells: mouth, eyes, hat, clothing, accessory, dice, floppy,
               check, passport (the same order as ICONS below)

Run: PYTHONPATH=<pillow+numpy+scipy> python3 scripts/build_maker_art.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games/fren-avatar/source-v3/maker-mockup.webp')
OUT = os.path.join(ROOT, 'docs/meme/avatar-assets/maker')

HEADER = (110, 106, 990, 210)          # x0, y0, x1, y1
FRAME = (106, 212, 402, 576)
WINDOW_SEARCH = (124, 232, 390, 562)   # the sample photo sits inside this box
ICONS = [  # name, box (padded a little; the panel colour around it is flood-filled away)
    ('mouth', (407, 240, 452, 270)), ('eyes', (407, 302, 455, 331)), ('hat', (407, 364, 456, 397)),
    ('clothing', (407, 427, 457, 469)), ('accessory', (406, 495, 455, 523)),
    ('dice', (417, 594, 455, 633)), ('floppy', (599, 595, 635, 631)), ('check', (776, 597, 811, 632)),
    ('passport', (117, 575, 190, 655)),
]
CELL = 48


def flood_keep(crop, tol):
    """Pixels NOT connected to the crop border through background-like colour."""
    rgb = crop[..., :3].astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, 0)
    near = np.abs(rgb - bg).max(-1) < tol
    lab, _ = nd.label(near)
    edge = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    outside = np.isin(lab, np.unique(edge[edge > 0]))
    keep = ~outside
    lab2, n = nd.label(keep)
    if n > 1:
        sizes = np.asarray(nd.sum(keep, lab2, range(1, n + 1)))
        keep = np.isin(lab2, 1 + np.nonzero(sizes >= 0.05 * sizes.max())[0])
    return nd.binary_fill_holes(keep)


def main():
    a = np.asarray(Image.open(SRC).convert('RGBA')).copy()
    os.makedirs(OUT, exist_ok=True)
    sizes = {}

    x0, y0, x1, y1 = HEADER
    Image.fromarray(a[y0:y1, x0:x1, :3]).save(os.path.join(OUT, 'header.webp'), 'WEBP', quality=86, method=6)

    # photo frame: drop the dark panel around it, then cut the photo window out
    x0, y0, x1, y1 = FRAME
    fr = a[y0:y1, x0:x1].copy()
    keep = flood_keep(fr, 38)
    sx0, sy0, sx1, sy1 = [v - o for v, o in zip(WINDOW_SEARCH, (x0, y0, x0, y0))]
    rgb = fr[..., :3].astype(np.int16)
    cream = (rgb.min(-1) > 170) & ((rgb.max(-1) - rgb.min(-1)) < 70)          # frame paper and tape
    tape = (rgb[..., 0] > 170) & (rgb[..., 0] - rgb[..., 2] > 40) & (rgb[..., 1] > 140)
    win = np.zeros(keep.shape, bool)
    win[sy0:sy1, sx0:sx1] = ~(cream | tape)[sy0:sy1, sx0:sx1]
    lab, n = nd.label(win)
    if n > 1:
        s = np.asarray(nd.sum(win, lab, range(1, n + 1)))
        win = lab == 1 + int(np.argmax(s))
    win = nd.binary_fill_holes(nd.binary_closing(win, iterations=3))
    ys, xs = np.nonzero(win)
    # a clean rectangle (the frame is upright), one pixel under the frame edge
    wy0, wy1 = int(np.percentile(ys, 0.5)), int(np.percentile(ys, 99.5))
    wx0, wx1 = int(np.percentile(xs, 0.5)), int(np.percentile(xs, 99.5))
    rect = np.zeros(keep.shape, bool); rect[wy0:wy1 + 1, wx0:wx1 + 1] = True
    # tape stays only where the two strips are: the top-left and bottom-right corners
    corners = np.zeros(keep.shape, bool); corners[:72, :72] = True; corners[-80:, -80:] = True
    tape_keep = nd.binary_fill_holes(nd.binary_closing(tape & corners, iterations=2)) & corners
    hole = rect & ~tape_keep
    # the frame is everything paper- or tape-coloured plus its dark rim; the panel around it goes
    paper = nd.binary_closing(cream | tape_keep | (rect ^ nd.binary_erosion(rect, iterations=2)), iterations=2)
    lab, n = nd.label(paper)
    if n > 1:
        s = np.asarray(nd.sum(paper, lab, range(1, n + 1)))
        paper = np.isin(lab, 1 + np.nonzero(s >= 0.02 * s.max())[0])
    keep = nd.binary_fill_holes(paper)
    keep = nd.binary_dilation(keep, iterations=1)
    fr[..., 3] = np.where(keep & ~hole, 255, 0)
    Image.fromarray(fr, 'RGBA').save(os.path.join(OUT, 'frame.webp'), 'WEBP', quality=88, alpha_quality=100, method=6)
    H, W = fr.shape[:2]
    window_pct = [round(wx0 / W * 100, 3), round(wy0 / H * 100, 3), round((wx1 + 1 - wx0) / W * 100, 3), round((wy1 + 1 - wy0) / H * 100, 3)]

    sheet = Image.new('RGBA', (CELL * len(ICONS), CELL), (0, 0, 0, 0))
    for i, (name, (ix0, iy0, ix1, iy1)) in enumerate(ICONS):
        c = a[iy0:iy1, ix0:ix1].copy()
        k = flood_keep(c, 40 if name != 'passport' else 34)
        c[..., 3] = np.where(k, 255, 0)
        ys, xs = np.nonzero(k)
        im = Image.fromarray(c[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
        im.thumbnail((CELL - 2, CELL - 2), Image.LANCZOS)
        sheet.paste(im, (i * CELL + (CELL - im.width) // 2, (CELL - im.height) // 2), im)
    sheet.save(os.path.join(OUT, 'icons.webp'), 'WEBP', quality=92, alpha_quality=100, method=6)

    for f in sorted(os.listdir(OUT)):
        sizes[f] = os.path.getsize(os.path.join(OUT, f))
    print({'frame_size': [W, H], 'window_pct_x_y_w_h': window_pct, 'bytes': sizes,
           'header_size': [HEADER[2] - HEADER[0], HEADER[3] - HEADER[1]]})


if __name__ == '__main__':
    main()
