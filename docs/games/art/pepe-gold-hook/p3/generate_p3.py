#!/usr/bin/env python3
"""Pepe Gold Hook art pack P3.

Screen contract (960×720):
  frog feet anchor (40, 88) placed at world (420, 300)
  winch rope exit (40, 48) placed at world (480, 280)
  => frog sprite origin (380, 212), winch sprite origin (440, 232)
  => a winch-local point (cx, cy) is frog-local (cx+60, cy+20)

Crank handles are the source of truth. Miner palms use that same point.
"""

from __future__ import annotations

import hashlib
import json
import math
import shutil
import zipfile
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PACK = ROOT / "pack"
ASSETS = PACK / "assets"

OUT = (0x20, 0x20, 0x20, 255)

# Pepe palette sampled from pondwars pixel-v06, outline forced to #202020.
GREEN_H = (0x92, 0xCC, 0x50, 255)
GREEN = (0x65, 0xA8, 0x3D, 255)
GREEN_D = (0x39, 0x73, 0x34, 255)
GREEN_K = (0x15, 0x26, 0x19, 255)
BLUE_H = (0x47, 0x7A, 0xD3, 255)
BLUE = (0x20, 0x4F, 0xA4, 255)
BLUE_D = (0x16, 0x31, 0x6E, 255)
BLUE_K = (0x0F, 0x1A, 0x31, 255)
PANT_H = (0xBD, 0x80, 0x54, 255)
PANT = (0x98, 0x61, 0x41, 255)
PANT_D = (0x63, 0x3D, 0x2B, 255)
PANT_K = (0x3A, 0x2C, 0x27, 255)
BELT = (0xF3, 0xC1, 0x47, 255)
BELT_D = (0xB8, 0x86, 0x2A, 255)
MOUTH = (0xE0, 0x7D, 0x59, 255)
MOUTH_D = (0x9B, 0x43, 0x3E, 255)
EYE = (0xF6, 0xF3, 0xDF, 255)
HELM_H = (0xA4, 0xAD, 0x4C, 255)
HELM = (0x74, 0x7C, 0x31, 255)
HELM_D = (0x47, 0x4F, 0x29, 255)
HELM_K = (0x2C, 0x34, 0x18, 255)

WOOD_H = (0xC4, 0x9A, 0x6C, 255)
WOOD = (0xA5, 0x6B, 0x3C, 255)
WOOD_D = (0x6B, 0x44, 0x28, 255)
WOOD_K = (0x3A, 0x2C, 0x27, 255)
MET_H = (0xD5, 0xDD, 0xE4, 255)
MET = (0x8E, 0x99, 0xA4, 255)
MET_D = (0x4E, 0x59, 0x64, 255)
MET_K = (0x2A, 0x31, 0x38, 255)
BR_H = (0xFF, 0xE0, 0x8A, 255)
BR = (0xF3, 0xC1, 0x47, 255)
BR_D = (0xB8, 0x86, 0x2A, 255)
BR_K = (0x6B, 0x4E, 0x12, 255)
COIL = (0xC4, 0xA4, 0x78, 255)
COIL_D = (0x8C, 0x6C, 0x46, 255)

SKY = (0x7E, 0xB6, 0xD6, 255)
SKY_H = (0xB7, 0xDF, 0xF2, 255)
CLOUD = (0xF6, 0xF3, 0xDF, 255)
CLOUD_D = (0xC5, 0xD0, 0xD4, 255)
GRASS_H = (0x92, 0xCC, 0x50, 255)
GRASS = (0x65, 0xA8, 0x3D, 255)
GRASS_D = (0x39, 0x73, 0x34, 255)
GRASS_K = (0x15, 0x26, 0x19, 255)
DIRT_H = (0xBD, 0x80, 0x54, 255)
DIRT = (0x98, 0x61, 0x41, 255)
DIRT_D = (0x63, 0x3D, 0x2B, 255)
DIRT_K = (0x3A, 0x2C, 0x27, 255)

HUD_BG = (0x6B, 0x44, 0x28, 255)
HUD_BG_D = (0x3A, 0x2C, 0x27, 255)
WELL = (0x12, 0x18, 0x1E, 255)
WELL_D = (0x0A, 0x0E, 0x12, 255)
WELL_H = (0x2A, 0x38, 0x44, 255)

# Winch-local crank. 0° handle to the right, then clockwise 90/180/270.
# Rightmost handle stays at x=18 so the frog palm (x+60) still fits in the 80px frame.
PIVOT = (11, 30)
HANDLES = ((18, 30), (11, 37), (4, 30), (11, 23))
ROPE_EXIT = (40, 48)
FROG_ANCHOR = (40, 88)

# World placement delta: winch origin - frog origin = (60, 20).
FROG_HAND_SHIFT = (60, 20)

NUMBER_FIELDS = {
    "score": [40, 23, 136, 34],
    "goal": [216, 23, 136, 34],
    "time": [392, 23, 136, 34],
    "level": [568, 23, 136, 34],
    "wallet": [744, 23, 136, 34],
}


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def put(im: Image.Image, x: int, y: int, color) -> None:
    if 0 <= x < im.width and 0 <= y < im.height and color[3] == 255:
        im.putpixel((x, y), color)


def fill_rect(im: Image.Image, x: int, y: int, w: int, h: int, color) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(im, xx, yy, color)


def fill_ellipse(im: Image.Image, cx: int, cy: int, rx: int, ry: int, color) -> None:
    if rx < 0 or ry < 0:
        return
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if (x - cx) * (x - cx) * ry * ry + (y - cy) * (y - cy) * rx * rx <= rx * rx * ry * ry:
                put(im, x, y, color)


def fill_ellipse_shaded(im, cx, cy, rx, ry, light, mid, dark, shadow) -> None:
    """Corner light, not a diagonal stripe. Highlight sits top-left."""
    if rx < 1 or ry < 1:
        return
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if (x - cx) * (x - cx) * ry * ry + (y - cy) * (y - cy) * rx * rx > rx * rx * ry * ry:
                continue
            nx = (x - cx) / rx
            ny = (y - cy) / ry
            if nx < -0.05 and ny < -0.05:
                color = light
            elif nx > 0.28 and ny > 0.18:
                color = shadow
            elif nx > 0.42 or ny > 0.48:
                color = dark
            else:
                color = mid
            put(im, x, y, color)


def fill_rect_shaded(im, x, y, w, h, light, mid, dark, shadow) -> None:
    """Top edge lit, bottom and right edge in shadow."""
    if w <= 0 or h <= 0:
        return
    top = max(1, h // 5)
    bot = max(1, h // 5)
    right = max(1, w // 5)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if yy >= y + h - bot:
                color = shadow
            elif xx >= x + w - right:
                color = dark
            elif yy < y + top:
                color = light
            else:
                color = mid
            put(im, xx, yy, color)


def thick_line(im, a, b, radius: int, color) -> None:
    x0, y0 = a
    x1, y1 = b
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(steps + 1):
        t = i / steps
        x = int(round(x0 + (x1 - x0) * t))
        y = int(round(y0 + (y1 - y0) * t))
        fill_ellipse(im, x, y, radius, radius, color)


def silhouette(im: Image.Image) -> None:
    w, h = im.size
    src = im.copy()
    sp = src.load()
    dp = im.load()
    for y in range(h):
        for x in range(w):
            if sp[x, y][3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and sp[nx, ny][3] == 255:
                    dp[x, y] = OUT
                    break


def stamp(dest: Image.Image, src: Image.Image, overwrite: bool = False) -> None:
    dp = dest.load()
    sp = src.load()
    for y in range(src.height):
        for x in range(src.width):
            if sp[x, y][3] == 255 and (overwrite or dp[x, y][3] == 0):
                dp[x, y] = sp[x, y]


def content_bounds(im: Image.Image):
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 255:
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return [0, 0, 0, 0]
    return [minx, miny, maxx - minx + 1, maxy - miny + 1]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def elbow(shoulder, wrist, bend: int):
    sx, sy = shoulder
    wx, wy = wrist
    mx = (sx + wx) / 2
    my = (sy + wy) / 2
    dx = wx - sx
    dy = wy - sy
    mag = math.hypot(dx, dy) or 1
    px, py = -dy / mag, dx / mag
    if py > 0:
        px, py = -px, -py
    return (int(round(mx + px * bend)), int(round(my + py * bend)))


def draw_lower_body(im: Image.Image) -> None:
    # Far leg, then near leg. Soles end at y=87 so the outline lands on y=88.
    fill_rect_shaded(im, 24, 66, 14, 16, PANT_H, PANT, PANT_D, PANT_K)
    fill_rect_shaded(im, 38, 66, 14, 16, PANT_H, PANT, PANT_D, PANT_K)
    fill_ellipse_shaded(im, 30, 82, 9, 5, GREEN_H, GREEN, GREEN_D, GREEN_K)
    fill_ellipse_shaded(im, 46, 82, 9, 5, GREEN_H, GREEN, GREEN_D, GREEN_K)
    fill_rect_shaded(im, 22, 83, 16, 5, GREEN_H, GREEN, GREEN_D, GREEN_K)
    fill_rect_shaded(im, 40, 83, 16, 5, GREEN_H, GREEN, GREEN_D, GREEN_K)
    # Toe splits and a darker sole line, still above the outline row.
    for x in (28, 36, 44, 52):
        put(im, x, 86, GREEN_K)
    for x in range(22, 56):
        if im.getpixel((x, 87))[3]:
            put(im, x, 87, GREEN_D if x % 2 == 0 else GREEN_K)


def draw_torso(im: Image.Image) -> None:
    fill_ellipse_shaded(im, 34, 58, 14, 12, BLUE_H, BLUE, BLUE_D, BLUE_K)
    fill_rect_shaded(im, 22, 52, 24, 16, BLUE_H, BLUE, BLUE_D, BLUE_K)
    # Hem and belt. Buckle is gold, no lettering.
    fill_rect(im, 22, 64, 28, 5, PANT_K)
    fill_rect(im, 23, 65, 26, 3, WOOD_D)
    fill_rect_shaded(im, 34, 64, 8, 5, BELT, BELT, BELT_D, BR_K)
    put(im, 36, 66, BR_H)
    put(im, 37, 66, BR_H)
    # Sleeve stumps at the shoulders so the arms read as coming out of the shirt.
    fill_ellipse_shaded(im, 46, 56, 5, 4, BLUE_H, BLUE, BLUE_D, BLUE_K)
    fill_ellipse_shaded(im, 24, 58, 4, 3, BLUE_D, BLUE_D, BLUE_K, BLUE_K)


def draw_head(im: Image.Image, lid: int) -> None:
    # Big Pepe head, seen from behind-left so the face is only the right side.
    fill_ellipse_shaded(im, 32, 40, 16, 14, GREEN_H, GREEN, GREEN_D, GREEN_K)
    # Cheek shadow on the lower right, under the mouth.
    fill_ellipse(im, 40, 48, 8, 4, GREEN_D)
    # Helmet dome, then a forward brim. No letter on the shell.
    fill_ellipse_shaded(im, 30, 24, 16, 11, HELM_H, HELM, HELM_D, HELM_K)
    fill_rect_shaded(im, 16, 26, 34, 5, HELM_H, HELM, HELM_D, HELM_K)
    fill_rect_shaded(im, 44, 27, 12, 4, HELM, HELM, HELM_D, HELM_K)
    # Rivet, not a glyph.
    put(im, 24, 22, HELM_H)
    put(im, 40, 24, HELM_D)
    # Brow.
    fill_rect(im, 38, 32, 14, 2, GREEN_K)
    # Eye: outline ring, cream, pupil toward the crank, lid for idle/effort.
    fill_ellipse(im, 44, 38, 7, 6, OUT)
    fill_ellipse(im, 44, 38, 6, 5, EYE)
    if lid:
        fill_rect(im, 38, 33, 13, lid, GREEN_D)
        fill_rect(im, 38, 33, 13, 1, OUT)
    fill_ellipse(im, 46, 39, 2, 2, OUT)
    put(im, 45, 38, EYE)
    # Mouth sticking forward, short of the crank so the fists stay clear of the face.
    fill_ellipse(im, 48, 46, 7, 4, OUT)
    fill_ellipse(im, 48, 46, 6, 3, MOUTH)
    fill_rect(im, 44, 47, 10, 2, MOUTH_D)
    put(im, 53, 45, MOUTH)
    # Brass lamp on the front of the helmet — a miner's cap, no lettering.
    fill_ellipse(im, 50, 29, 3, 3, OUT)
    fill_ellipse_shaded(im, 50, 29, 2, 2, BR_H, BR, BR_D, BR_K)
    put(im, 49, 28, BR_H)


def draw_arm(im: Image.Image, shoulder, wrist, bend: int, near: bool) -> None:
    layer = blank(im.width, im.height)
    mid = elbow(shoulder, wrist, bend)
    sleeve_end = (
        int(round(shoulder[0] * 0.55 + mid[0] * 0.45)),
        int(round(shoulder[1] * 0.55 + mid[1] * 0.45)),
    )
    blue = BLUE if near else BLUE_D
    blue_d = BLUE_D if near else BLUE_K
    green = GREEN if near else GREEN_D
    thick_line(layer, shoulder, sleeve_end, 1, blue)
    thick_line(layer, sleeve_end, wrist, 1, green)
    # Cuff.
    fill_ellipse(layer, sleeve_end[0], sleeve_end[1], 3, 3, blue_d)
    stamp(im, layer, overwrite=True)


def draw_hands(im: Image.Image, hx: int, hy: int) -> None:
    """Two small fists on the frog side of a knob centered at (hx, hy).

    Fingertips land on the knob's left edge. The center and the right side
    of the knob stay empty in this sprite so the brass handle stays visible.
    """
    fill_ellipse_shaded(im, hx - 6, hy - 3, 2, 2, GREEN_D, GREEN_D, GREEN_K, GREEN_K)
    fill_ellipse_shaded(im, hx - 6, hy + 2, 2, 2, GREEN_H, GREEN, GREEN_D, GREEN_K)
    put(im, hx - 4, hy - 1, GREEN_D)
    put(im, hx - 3, hy - 1, GREEN_D)
    put(im, hx - 3, hy, GREEN)
    put(im, hx - 2, hy, GREEN)
    put(im, hx - 3, hy + 1, GREEN)
    put(im, hx - 4, hy + 1, GREEN_H)


def draw_stick(im: Image.Image, x: int, y: int, lit: bool) -> None:
    """Small dynamite in the hand. y is the bottom of the stick."""
    fill_rect(im, x, y - 14, 7, 14, OUT)
    fill_rect_shaded(im, x + 1, y - 13, 5, 12, (0xE0, 0x7D, 0x59, 255), (0xD2, 0x4B, 0x3A, 255), MOUTH_D, (0x6E, 0x28, 0x22, 255))
    fill_rect(im, x + 1, y - 9, 5, 2, EYE)
    fill_rect(im, x + 1, y - 5, 5, 2, EYE)
    # Fuse.
    put(im, x + 3, y - 15, WOOD_K)
    put(im, x + 3, y - 16, WOOD_K)
    put(im, x + 4, y - 17, WOOD_D)
    if lit:
        put(im, x + 4, y - 18, BR)
        put(im, x + 5, y - 19, BR_H)
        put(im, x + 3, y - 19, BR)
        put(im, x + 6, y - 18, EYE)


def draw_open_hand(im: Image.Image, hx: int, hy: int) -> None:
    fill_ellipse_shaded(im, hx - 2, hy, 4, 3, GREEN_H, GREEN, GREEN_D, GREEN_K)
    for dx, dy in ((2, -2), (3, 0), (3, 2), (1, 3)):
        put(im, hx + dx, hy + dy, GREEN)
        put(im, hx + dx + 1, hy + dy, GREEN_H)


def make_miner(kind: str, handle=None) -> Image.Image:
    im = blank(80, 96)
    draw_lower_body(im)
    # Far arm first so the torso covers the shoulder.
    if kind in ("crank", "idle") and handle is not None:
        hx, hy = handle
        far_wrist = (hx - 9, hy - 4)
        draw_arm(im, (28, 58), far_wrist, 5, near=False)
    elif kind == "reach":
        draw_arm(im, (28, 58), (22, 70), 3, near=False)
    elif kind == "windup":
        draw_arm(im, (28, 58), (18, 48), 4, near=False)
    elif kind == "throw":
        draw_arm(im, (28, 58), (20, 62), 4, near=False)
    elif kind == "recover":
        draw_arm(im, (28, 58), (24, 60), 3, near=False)
    draw_torso(im)
    lid = 2 if kind == "idle" else (3 if kind == "throw" else 0)
    draw_head(im, lid)
    if kind in ("crank", "idle") and handle is not None:
        hx, hy = handle
        wrist = (hx - 8, hy + 2)
        bend = 3 if hx >= 74 else 6
        draw_arm(im, (46, 56), wrist, bend, near=True)
        draw_hands(im, hx, hy)
    elif kind == "reach":
        draw_arm(im, (46, 56), (48, 62), 4, near=True)
        draw_stick(im, 46, 66, lit=False)
        draw_hands(im, 52, 60)
    elif kind == "windup":
        draw_arm(im, (46, 56), (54, 24), 6, near=True)
        draw_stick(im, 52, 22, lit=True)
        draw_hands(im, 56, 20)
    elif kind == "throw":
        draw_arm(im, (46, 56), (68, 64), 3, near=True)
        draw_open_hand(im, 72, 64)
    elif kind == "recover":
        draw_arm(im, (46, 56), (56, 50), 5, near=True)
        draw_open_hand(im, 58, 48)
    silhouette(im)
    # Soles stay on the anchor row. Nothing hangs below the feet.
    px = im.load()
    for y in range(89, 96):
        for x in range(80):
            px[x, y] = (0, 0, 0, 0)
    return im


def draw_winch_base(im: Image.Image) -> None:
    # Rear post and a foot that stays inside x=0..15 below the rope line.
    fill_rect_shaded(im, 2, 14, 6, 40, WOOD_H, WOOD, WOOD_D, WOOD_K)
    # Foot skid. Stops at y=61 so the outline stays off the -65° rope at (7, 63).
    fill_rect_shaded(im, 0, 50, 9, 6, WOOD_H, WOOD, WOOD_D, WOOD_K)
    fill_rect_shaded(im, 1, 56, 5, 6, WOOD, WOOD_D, WOOD_K, WOOD_K)
    # Top beam and a brace holding the drum out to the right.
    fill_rect_shaded(im, 2, 12, 50, 5, WOOD_H, WOOD, WOOD_D, WOOD_K)
    thick_line(im, (8, 20), (30, 36), 1, WOOD_D)
    thick_line(im, (8, 18), (28, 34), 1, WOOD)
    # Short right bracket stops ON y=48, never below.
    fill_rect_shaded(im, 50, 30, 5, 19, WOOD_H, WOOD, WOOD_D, WOOD_K)
    # Drum flange (the round end) and a short barrel to the right.
    fill_ellipse(im, 40, 30, 13, 13, OUT)
    fill_ellipse_shaded(im, 40, 30, 12, 12, MET_H, MET, MET_D, MET_K)
    fill_ellipse(im, 40, 30, 7, 7, WOOD_D)
    fill_ellipse_shaded(im, 40, 30, 6, 6, COIL, COIL, COIL_D, WOOD_K)
    # Wound coils on the hub only — the free rope is drawn by the game.
    for r, col in ((4, COIL_D), (2, WOOD_K)):
        fill_ellipse(im, 40, 30, r, r, col)
    fill_rect_shaded(im, 46, 20, 10, 18, MET_H, MET, MET_D, MET_K)
    fill_rect(im, 46, 20, 10, 2, MET_H)
    fill_rect(im, 46, 36, 10, 2, MET_K)
    # Rope throat. Bottom pixel is the exit (40, 48). Nothing under it.
    fill_rect(im, 37, 40, 7, 8, OUT)
    fill_rect_shaded(im, 38, 41, 5, 6, MET_H, MET, MET_D, MET_K)
    put(im, 40, 47, MET_K)
    put(im, 40, 48, OUT)
    put(im, 39, 48, MET_K)
    put(im, 41, 48, MET_K)
    # Axle from the flange toward the frog.
    fill_rect_shaded(im, 12, 29, 18, 5, MET_H, MET, MET_D, MET_K)
    # Bolts.
    put(im, 20, 31, MET_K)
    put(im, 48, 24, BR)
    put(im, 54, 28, MET_H)


def draw_crank(im: Image.Image, handle) -> None:
    hx, hy = handle
    thick_line(im, PIVOT, handle, 2, WOOD_K)
    thick_line(im, PIVOT, handle, 1, WOOD)
    fill_ellipse(im, hx, hy, 4, 4, OUT)
    fill_ellipse_shaded(im, hx, hy, 3, 3, BR_H, BR, BR_D, BR_K)
    put(im, hx - 1, hy - 1, BR_H)
    # Pivot cap, drawn last so every frame shares it.
    fill_ellipse(im, PIVOT[0], PIVOT[1], 2, 2, OUT)
    fill_ellipse(im, PIVOT[0], PIVOT[1], 1, 1, MET_H)


def make_winch(handle) -> Image.Image:
    im = blank(64, 64)
    draw_winch_base(im)
    draw_crank(im, handle)
    silhouette(im)
    # The rope swings through x=16..63 below the exit. Keep that band empty.
    px = im.load()
    for y in range(49, 64):
        for x in range(16, 64):
            px[x, y] = (0, 0, 0, 0)
    return im


def make_dynamite(frame: int) -> Image.Image:
    im = blank(16, 32)
    fill_rect(im, 4, 10, 8, 18, OUT)
    fill_rect_shaded(im, 5, 11, 6, 16, (0xE8, 0x78, 0x58, 255), (0xD2, 0x4B, 0x3A, 255), MOUTH_D, (0x6E, 0x28, 0x22, 255))
    fill_rect(im, 5, 16, 6, 2, EYE)
    fill_rect(im, 5, 22, 6, 2, EYE)
    # Fuse, crooked, up toward the spark.
    for x, y in ((8, 10), (8, 9), (7, 8), (7, 7), (8, 6), (9, 5)):
        put(im, x, y, WOOD_K)
    if frame == 0:
        spark = [(8, 2, BR_H), (7, 3, BR), (9, 3, BR_H), (8, 4, EYE), (10, 2, BR), (6, 4, BR_D)]
    else:
        spark = [(9, 1, EYE), (8, 2, BR_H), (10, 3, BR), (7, 3, BR_H), (9, 4, BR), (11, 2, BR_D), (6, 2, EYE)]
    for x, y, col in spark:
        put(im, x, y, col)
    silhouette(im)
    return im


def make_surface() -> Image.Image:
    im = blank(960, 96)
    px = im.load()
    for y in range(96):
        for x in range(960):
            px[x, y] = SKY
    # Soft sky band at the top (flat colors, no blend).
    fill_rect(im, 0, 0, 960, 10, SKY_H)

    def cloud(cx, cy, rx, ry):
        fill_ellipse(im, cx + 2, cy + 2, rx, ry, CLOUD_D)
        fill_ellipse(im, cx, cy, rx, ry, CLOUD)
        # Outline only the outer rim by stamping a ring via silhouette on a layer.
        layer = blank(960, 96)
        fill_ellipse(layer, cx, cy, rx, ry, CLOUD)
        silhouette(layer)
        # Keep the outline, not the refill.
        lp = layer.load()
        for y in range(max(0, cy - ry - 2), min(96, cy + ry + 3)):
            for x in range(max(0, cx - rx - 2), min(960, cx + rx + 3)):
                if lp[x, y] == OUT and im.getpixel((x, y)) == SKY or (
                    lp[x, y] == OUT and im.getpixel((x, y)) == SKY_H
                ):
                    px[x, y] = OUT

    cloud(90, 16, 18, 6)
    cloud(94, 16, 10, 5)
    cloud(340, 12, 22, 6)
    cloud(700, 18, 16, 5)
    cloud(860, 14, 14, 5)

    # Distant ridge, integer steps.
    def ridge(x: int) -> int:
        t = x / 959
        h = 34 + int(6 * math.sin(t * math.tau * 2.0) + 3 * math.sin(t * math.tau * 5.0))
        return h

    for x in range(960):
        y0 = ridge(x)
        for y in range(y0, 52):
            col = GRASS_D if (x + y) % 11 == 0 else (GRASS if y < y0 + 4 else GRASS_D)
            px[x, y] = col
        px[x, y0] = OUT if x % 3 == 0 else GRASS_K
        if y0 > 0:
            px[x, y0 - 1] = GRASS_H if x % 4 == 0 else px[x, y0 - 1]

    # Near grass up to the foot line. y=88 is the ground the feet stand on.
    for y in range(52, 89):
        for x in range(960):
            if y >= 80:
                col = GRASS if (x * 3 + y) % 7 else GRASS_H
            elif y >= 68:
                col = GRASS if (x + y) % 5 else GRASS_D
            else:
                col = GRASS_D if (x // 3 + y) % 4 else GRASS
            px[x, y] = col
    for x in range(960):
        px[x, 88] = GRASS_K if x % 2 == 0 else GRASS_D
        px[x, 87] = GRASS_H if x % 3 == 0 else GRASS

    # Tufts above the foot line, kept off the frog's standing patch (x=390..470).
    for x in range(8, 952, 14):
        if 390 <= x <= 470:
            continue
        h = 4 + (x // 14) % 4
        for i in range(h):
            px[x, 88 - i] = GRASS_H if i < 2 else GRASS
            if i == h - 1:
                px[x, 88 - i] = GRASS_K
        if x % 28 == 8:
            px[x - 1, 86] = GRASS_D
            px[x + 1, 85] = GRASS

    # Flowers and stones, away from the winch foot.
    for fx in (120, 260, 620, 800, 910):
        px[fx, 84] = GRASS_K
        px[fx, 83] = GRASS
        px[fx, 82] = MOUTH
        px[fx - 1, 83] = MOUTH
        px[fx + 1, 83] = BR

    def rock(cx, top):
        fill_ellipse(im, cx, top + 3, 6, 4, OUT)
        fill_ellipse_shaded(im, cx, top + 3, 5, 3, DIRT_H, DIRT, DIRT_D, DIRT_K)
        put(im, cx - 2, top + 2, DIRT_H)

    rock(190, 80)
    rock(560, 81)
    rock(760, 80)

    # Dirt lip under the foot line, with a timber facing. No winch, no frog.
    for y in range(89, 96):
        for x in range(960):
            px[x, y] = DIRT if (x + y) % 6 else DIRT_D
    for x in range(960):
        px[x, 89] = WOOD_D
        px[x, 90] = WOOD if x % 5 else WOOD_H
        px[x, 93] = WOOD_K
        px[x, 94] = WOOD_D
        px[x, 95] = DIRT_K
    for x in range(16, 960, 48):
        for y in range(89, 96):
            px[x, y] = WOOD_K
            if x + 1 < 960:
                px[x + 1, y] = WOOD
    return im


def icon_nugget(im, x, y):
    fill_ellipse(im, x + 8, y + 8, 6, 5, OUT)
    fill_ellipse_shaded(im, x + 8, y + 8, 5, 4, BR_H, BR, BR_D, BR_K)
    put(im, x + 6, y + 6, BR_H)


def icon_target(im, x, y):
    fill_ellipse(im, x + 8, y + 8, 6, 6, OUT)
    fill_ellipse(im, x + 8, y + 8, 5, 5, EYE)
    fill_ellipse(im, x + 8, y + 8, 3, 3, OUT)
    fill_ellipse(im, x + 8, y + 8, 2, 2, MOUTH)
    put(im, x + 8, y + 8, BR_H)


def icon_hourglass(im, x, y):
    fill_rect(im, x + 3, y + 1, 10, 2, OUT)
    fill_rect(im, x + 3, y + 13, 10, 2, OUT)
    fill_rect(im, x + 4, y + 2, 8, 1, WOOD_H)
    fill_rect(im, x + 4, y + 12, 8, 1, WOOD)
    glass = (
        (4, 4, 8),
        (5, 5, 6),
        (6, 6, 4),
        (7, 7, 2),
        (6, 8, 4),
        (5, 9, 6),
        (4, 10, 8),
    )
    for gx, gy, gw in glass:
        fill_rect(im, x + gx, y + gy, gw, 1, EYE)
        put(im, x + gx, y + gy, OUT)
        put(im, x + gx + gw - 1, y + gy, OUT)
    fill_rect(im, x + 6, y + 4, 4, 2, BR)
    fill_rect(im, x + 5, y + 9, 6, 2, BR_D)


def icon_level(im, x, y):
    # Three rising bars. No digits.
    for i, h in enumerate((4, 7, 11)):
        fill_rect(im, x + 2 + i * 5, y + 13 - h, 4, h, OUT)
        fill_rect(im, x + 3 + i * 5, y + 14 - h, 2, h - 2, GRASS_H if i == 2 else (BR if i == 1 else BLUE_H))


def icon_wallet(im, x, y):
    fill_ellipse(im, x + 8, y + 9, 6, 5, OUT)
    fill_ellipse_shaded(im, x + 8, y + 9, 5, 4, WOOD_H, WOOD, WOOD_D, WOOD_K)
    fill_ellipse(im, x + 11, y + 9, 3, 3, OUT)
    fill_ellipse(im, x + 11, y + 9, 2, 2, BR)
    put(im, x + 10, y + 8, BR_H)


def make_hud() -> Image.Image:
    im = blank(900, 80)
    fill_rect(im, 0, 0, 900, 80, OUT)
    fill_rect(im, 2, 2, 896, 76, HUD_BG)
    fill_rect(im, 2, 2, 896, 4, WOOD_H)
    fill_rect(im, 2, 72, 896, 6, HUD_BG_D)
    # Plank seams and top-left light.
    px = im.load()
    for y in (10, 70):
        for x in range(6, 894):
            if px[x, y][3]:
                px[x, y] = WOOD_D if y == 70 else WOOD_H
    for x in range(8, 892, 2):
        if px[x, 4][3]:
            px[x, 4] = WOOD_H
    # Corner rivets.
    for rx, ry in ((8, 8), (888, 8), (8, 70), (888, 70)):
        fill_ellipse(im, rx, ry, 2, 2, OUT)
        fill_ellipse(im, rx, ry, 1, 1, MET_H)
    icons = (icon_nugget, icon_target, icon_hourglass, icon_level, icon_wallet)
    for (name, rect), icon in zip(NUMBER_FIELDS.items(), icons):
        x, y, w, h = rect
        fill_rect(im, x - 1, y - 1, w + 2, h + 2, OUT)
        fill_rect(im, x, y, w, h, WELL)
        # Inset shadow on the top-left, highlight on the bottom-right.
        for i in range(w):
            px[x + i, y] = WELL_D
            px[x + i, y + h - 1] = WELL_H
        for j in range(h):
            px[x, y + j] = WELL_D
            px[x + w - 1, y + j] = WELL_H
        icon(im, x - 22, y + 9)
    return im


def frog_handle(winch_handle):
    return (winch_handle[0] + FROG_HAND_SHIFT[0], winch_handle[1] + FROG_HAND_SHIFT[1])


def build_sprites():
    winches = [make_winch(h) for h in HANDLES]
    miners = [make_miner("crank", frog_handle(h)) for h in HANDLES]
    idle = make_miner("idle", frog_handle(HANDLES[0]))
    throws = [
        make_miner("reach"),
        make_miner("windup"),
        make_miner("throw"),
        make_miner("recover"),
    ]
    dynamite = [make_dynamite(0), make_dynamite(1)]
    surface = make_surface()
    hud = make_hud()
    return {
        "winches": winches,
        "miners": miners,
        "idle": idle,
        "throws": throws,
        "dynamite": dynamite,
        "surface": surface,
        "hud": hud,
    }


def compose_preview(sprites) -> Image.Image:
    teal = (0, 128, 128)
    width = 960
    panel_w, panel_h = 240, 210
    preview = Image.new("RGB", (width, panel_h + 8 + 150 + 8 + 96 + 8 + 80), teal)
    feet = (100, 176)
    for i, (frog, winch) in enumerate(zip(sprites["miners"], sprites["winches"])):
        ox = i * panel_w
        panel = Image.new("RGBA", (panel_w, panel_h), (0, 0, 0, 0))
        rope = (feet[0] + 60, feet[1] - 20)
        frog_xy = (feet[0] - FROG_ANCHOR[0], feet[1] - FROG_ANCHOR[1])
        winch_xy = (rope[0] - ROPE_EXIT[0], rope[1] - ROPE_EXIT[1])
        panel.paste(winch, winch_xy, winch)
        panel.paste(frog, frog_xy, frog)
        preview.paste(panel, (ox, 0), panel)
    # Throw row + dynamite, native pixels, same foot line.
    for i, frog in enumerate(sprites["throws"]):
        preview.paste(frog, (16 + i * 100, panel_h + 16), frog)
    for i, stick in enumerate(sprites["dynamite"]):
        big = stick.resize((64, 128), Image.NEAREST)
        preview.paste(big, (440 + i * 80, panel_h + 12), big)
    sy = panel_h + 8 + 150 + 8
    preview.paste(sprites["surface"], (0, sy))
    preview.paste(sprites["hud"], (30, sy + 96 + 8))
    return preview


def compose_mock(sprites) -> Image.Image:
    """In-game arrangement for the first crank frame. Not an asset."""
    screen = Image.new("RGBA", (960, 720), SKY)
    screen.paste(sprites["surface"], (0, 212))
    # Mine opening under the lip.
    mine = Image.new("RGBA", (912, 324), (0x2A, 0x1C, 0x14, 255))
    mp = mine.load()
    for y in range(324):
        for x in range(912):
            if (x // 16 + y // 16) % 2 == 0:
                mp[x, y] = (0x3A, 0x28, 0x1C, 255)
            if y < 3 or x < 2 or x > 909:
                mp[x, y] = WOOD_K
    screen.paste(mine, (24, 324))
    frog = sprites["miners"][0]
    winch = sprites["winches"][0]
    screen.paste(winch, (440, 232), winch)
    screen.paste(frog, (380, 212), frog)
    # Code-drawn rope, shown here only so the clear cone is visible.
    draw = ImageDraw.Draw(screen)
    draw.line([(480, 280), (560, 640)], fill=(0x6B, 0x44, 0x28, 255), width=1)
    screen.paste(sprites["hud"], (30, 24))
    return screen


def zoom_row(images, scale: int) -> Image.Image:
    w = sum(im.width for im in images) * scale
    h = max(im.height for im in images) * scale
    sheet = Image.new("RGBA", (w, h), (0, 128, 128, 255))
    x = 0
    for im in images:
        big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        sheet.paste(big, (x, 0), big)
        x += big.width
    return sheet


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG")


def sprite_record(sid: str, rel: str, im: Image.Image, anchor, extra=None) -> dict:
    rec = {
        "id": sid,
        "path": rel,
        "width": im.width,
        "height": im.height,
        "anchor": list(anchor),
        "alpha": "0/255",
        "contentBounds": content_bounds(im),
        "sha256": sha256_file(PACK / rel),
    }
    if extra:
        rec.update(extra)
    return rec


def build_manifest(sprites, files) -> dict:
    sprites_meta = []
    for handle, name in zip(HANDLES, ("pm-winch-crank-00", "pm-winch-crank-01", "pm-winch-crank-02", "pm-winch-crank-03")):
        im = files[name]
        sprites_meta.append(
            sprite_record(
                name,
                f"assets/{name}.png",
                im,
                ROPE_EXIT,
                {"ropeExit": list(ROPE_EXIT), "crankHandle": list(handle)},
            )
        )
    sprites_meta.insert(
        0,
        sprite_record(
            "pm-winch-crank",
            "assets/pm-winch-crank.png",
            files["pm-winch-crank"],
            ROPE_EXIT,
            {"ropeExit": list(ROPE_EXIT), "crankHandle": list(HANDLES[0])},
        ),
    )
    for i, handle in enumerate(HANDLES):
        name = f"pm-miner-crank-0{i}"
        sprites_meta.append(
            sprite_record(
                name,
                f"assets/{name}.png",
                files[name],
                FROG_ANCHOR,
                {"hand": list(frog_handle(handle))},
            )
        )
    sprites_meta.append(
        sprite_record(
            "pm-miner-crank-idle",
            "assets/pm-miner-crank-idle.png",
            files["pm-miner-crank-idle"],
            FROG_ANCHOR,
            {"hand": list(frog_handle(HANDLES[0]))},
        )
    )
    throw_hands = [(52, 60), (56, 20), (72, 64), (58, 48)]
    for i, hand in enumerate(throw_hands):
        name = f"pm-miner-throw-0{i}"
        sprites_meta.append(
            sprite_record(name, f"assets/{name}.png", files[name], FROG_ANCHOR, {"hand": list(hand)})
        )
    for i in range(2):
        name = f"pm-dynamite-lit-0{i}"
        sprites_meta.append(sprite_record(name, f"assets/{name}.png", files[name], (8, 16)))
    hud_extra = {"numberFields": {k: list(v) for k, v in NUMBER_FIELDS.items()}}
    sprites_meta.append(sprite_record("pm-surface-wide", "assets/pm-surface-wide.png", files["pm-surface-wide"], (0, 88)))
    sprites_meta.append(
        sprite_record("pm-hud-wide", "assets/pm-hud-wide.png", files["pm-hud-wide"], (0, 0), hud_extra)
    )
    return {
        "pack": "pepe-gold-hook-art-p3",
        "engine": "nearest-neighbor",
        "outline": "#202020",
        "layout": {
            "screen": [960, 720],
            "surfaceBand": [168, 311],
            "groundY": 300,
            "frogFeet": [420, 300],
            "ropeExitWorld": [480, 280],
            "mine": {"x": [24, 936], "y": [324, 648]},
            "notes": "Surface strip is drawn with its y=88 on groundY, so the file origin is world y=212. Sky from y=168 to 212 is outside this strip.",
        },
        "sprites": sprites_meta,
        "animations": {
            "crank": {
                "frames": [f"pm-winch-crank-0{i}" for i in range(4)],
                "durationsMs": [90, 90, 90, 90],
                "loop": True,
            },
            "minerCrank": {
                "frames": [f"pm-miner-crank-0{i}" for i in range(4)],
                "durationsMs": [90, 90, 90, 90],
                "loop": True,
            },
            "throw": {
                "frames": [f"pm-miner-throw-0{i}" for i in range(4)],
                "durationsMs": [80, 80, 80, 120],
                "loop": False,
            },
            "dynamiteLit": {
                "frames": ["pm-dynamite-lit-00", "pm-dynamite-lit-01"],
                "durationsMs": [60, 60],
                "loop": True,
            },
        },
    }


def check_alpha(im: Image.Image) -> bool:
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] not in (0, 255):
                return False
    return True


def opaque_set(im: Image.Image, origin):
    found = set()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] == 255:
                found.add((origin[0] + x, origin[1] + y))
    return found


def rope_hits(im: Image.Image, deg: float) -> list:
    hits = []
    rad = math.radians(deg)
    px = im.load()
    for dist in range(1, 48):
        x = int(round(ROPE_EXIT[0] + math.sin(rad) * dist))
        y = int(round(ROPE_EXIT[1] + math.cos(rad) * dist))
        if y <= ROPE_EXIT[1]:
            continue
        if not (0 <= x < im.width and 0 <= y < im.height):
            continue
        if px[x, y][3] == 255:
            hits.append((x, y, deg))
    return hits


def run_qa(files) -> dict:
    checks = []

    def add(name, ok, detail=""):
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    expected = {
        "pm-winch-crank": (64, 64),
        "pm-winch-crank-00": (64, 64),
        "pm-winch-crank-01": (64, 64),
        "pm-winch-crank-02": (64, 64),
        "pm-winch-crank-03": (64, 64),
        "pm-miner-crank-00": (80, 96),
        "pm-miner-crank-01": (80, 96),
        "pm-miner-crank-02": (80, 96),
        "pm-miner-crank-03": (80, 96),
        "pm-miner-crank-idle": (80, 96),
        "pm-miner-throw-00": (80, 96),
        "pm-miner-throw-01": (80, 96),
        "pm-miner-throw-02": (80, 96),
        "pm-miner-throw-03": (80, 96),
        "pm-dynamite-lit-00": (16, 32),
        "pm-dynamite-lit-01": (16, 32),
        "pm-surface-wide": (960, 96),
        "pm-hud-wide": (900, 80),
    }
    for name, size in expected.items():
        im = files[name]
        add(f"size:{name}", im.size == size, f"{im.size} expected {size}")
        add(f"alpha:{name}", check_alpha(im))
        colors = {
            px[:3]
            for px in im.getdata()
            if px[3] == 255
        }
        add(f"outline:{name}", OUT[:3] in colors, f"{len(colors)} opaque colors")

    add(
        "winch-static-matches-frame-00",
        list(files["pm-winch-crank"].getdata()) == list(files["pm-winch-crank-00"].getdata()),
    )

    for i in range(4):
        im = files[f"pm-winch-crank-0{i}"]
        px = im.load()
        blocked = [
            (x, y)
            for y in range(49, 64)
            for x in range(16, 64)
            if px[x, y][3] == 255
        ]
        add(f"rope-clear:{i}", not blocked, f"{len(blocked)} pixels")
        add(f"rope-exit-opaque:{i}", px[40, 48][3] == 255, str(px[40, 48]))
        foot = any(px[x, y][3] == 255 for y in range(49, 64) for x in range(16))
        add(f"stand-foot:{i}", foot)
        hits = []
        for deg in (-65, -40, 0, 40, 65):
            hits.extend(rope_hits(im, deg))
        add(f"rope-cone:{i}", not hits, str(hits[:6]))

    # Frames share the stand. Only the crank arm changes, and only inside the orbit.
    base = files["pm-winch-crank-00"]
    for i in range(1, 4):
        other = files[f"pm-winch-crank-0{i}"]
        leaked = []
        for y in range(64):
            for x in range(64):
                if base.getpixel((x, y)) != other.getpixel((x, y)):
                    if not (0 <= x <= 26 and 16 <= y <= 46):
                        leaked.append((x, y))
        add(f"crank-only-moves:{i}", not leaked, str(leaked[:8]))

    # Feet row is the shared anchor across every frog frame.
    frog_names = [f"pm-miner-crank-0{i}" for i in range(4)] + [
        "pm-miner-crank-idle",
        "pm-miner-throw-00",
        "pm-miner-throw-01",
        "pm-miner-throw-02",
        "pm-miner-throw-03",
    ]
    feet_ref = []
    ref = files["pm-miner-crank-00"]
    for y in range(78, 89):
        for x in range(80):
            feet_ref.append(ref.getpixel((x, y)))
    for name in frog_names:
        im = files[name]
        got = [im.getpixel((x, y)) for y in range(78, 89) for x in range(80)]
        below = any(im.getpixel((x, y))[3] for y in range(89, 96) for x in range(80))
        add(f"feet-match:{name}", got == feet_ref and not below)
        add(f"anchor-sole:{name}", im.getpixel((40, 88))[3] == 255)

    # Hands meet the crank handle in world space, and palms overlap the knob.
    for i, handle in enumerate(HANDLES):
        frog = files[f"pm-miner-crank-0{i}"]
        winch = files[f"pm-winch-crank-0{i}"]
        world_handle = (440 + handle[0], 232 + handle[1])
        world_hand = (380 + frog_handle(handle)[0], 212 + frog_handle(handle)[1])
        add(f"hand-world:{i}", world_handle == world_hand, f"{world_handle} vs {world_hand}")
        frog_px = opaque_set(frog, (380, 212))
        winch_px = opaque_set(winch, (440, 232))
        overlap = frog_px & winch_px
        near = [p for p in overlap if abs(p[0] - world_handle[0]) <= 4 and abs(p[1] - world_handle[1]) <= 4]
        visible = [
            p
            for p in frog_px
            if abs(p[0] - world_handle[0]) <= 8
            and abs(p[1] - world_handle[1]) <= 8
            and p not in winch_px
        ]
        add(f"grip-overlap:{i}", len(near) >= 2, f"overlap {len(near)} visible-hand {len(visible)}")

    # Idle matches crank 00 except the eyelid.
    idle = files["pm-miner-crank-idle"]
    crank0 = files["pm-miner-crank-00"]
    eye_diff = []
    other_diff = 0
    for y in range(96):
        for x in range(80):
            if idle.getpixel((x, y)) != crank0.getpixel((x, y)):
                if 36 <= x <= 52 and 30 <= y <= 44:
                    eye_diff.append((x, y))
                else:
                    other_diff += 1
    add("idle-is-waiting-grip", other_diff == 0 and len(eye_diff) > 0, f"eyelid {len(eye_diff)} other {other_diff}")

    # HUD wells are the published rectangles and share one height.
    hud = files["pm-hud-wide"]
    wells_ok = True
    for rect in NUMBER_FIELDS.values():
        x, y, w, h = rect
        if y != 23 or h != 34:
            wells_ok = False
        if hud.getpixel((x + 2, y + 2))[:3] != WELL[:3]:
            wells_ok = False
        if hud.getpixel((x - 1, y - 1))[:3] != OUT[:3]:
            wells_ok = False
    add("hud-number-fields", wells_ok, json.dumps(NUMBER_FIELDS))

    # Surface foot line is opaque along y=88, and the frog's patch has no tall props.
    surface = files["pm-surface-wide"]
    ground = all(surface.getpixel((x, 88))[3] == 255 for x in range(960))
    clear_patch = all(surface.getpixel((x, y))[:3] in (GRASS[:3], GRASS_H[:3], GRASS_D[:3], GRASS_K[:3]) for x in range(400, 460) for y in range(78, 89))
    add("surface-ground-line", ground and clear_patch)

    # Dynamite frames differ only in the spark, share the anchor pixel.
    d0, d1 = files["pm-dynamite-lit-00"], files["pm-dynamite-lit-01"]
    spark_diff = sum(d0.getpixel((x, y)) != d1.getpixel((x, y)) for y in range(32) for x in range(16))
    add("dynamite-flicker", spark_diff > 0 and d0.getpixel((8, 16))[3] == 255, f"diff {spark_diff}")

    colors_preview = None
    return {
        "pack": "pepe-gold-hook-art-p3",
        "passed": all(c["ok"] for c in checks),
        "checks": checks,
        "paletteNote": "Body colors match pondwars pixel-v06 Pepe (green, blue shirt, brown pants, olive helmet, cream eye, salmon mouth). Outline is #202020 as specified for this pack. Helmet has no letter.",
        "crankHandles": [list(h) for h in HANDLES],
        "frogHands": [list(frog_handle(h)) for h in HANDLES],
        "numberFields": NUMBER_FIELDS,
        "untouched": "v1/P1/P2 files are not in this pack and were not modified.",
        "preview": colors_preview,
    }


def main() -> None:
    if PACK.exists():
        shutil.rmtree(PACK)
    ASSETS.mkdir(parents=True)
    (PACK / "docs").mkdir()
    sprites = build_sprites()
    files = {
        "pm-winch-crank": sprites["winches"][0],
        "pm-winch-crank-00": sprites["winches"][0],
        "pm-winch-crank-01": sprites["winches"][1],
        "pm-winch-crank-02": sprites["winches"][2],
        "pm-winch-crank-03": sprites["winches"][3],
        "pm-miner-crank-00": sprites["miners"][0],
        "pm-miner-crank-01": sprites["miners"][1],
        "pm-miner-crank-02": sprites["miners"][2],
        "pm-miner-crank-03": sprites["miners"][3],
        "pm-miner-crank-idle": sprites["idle"],
        "pm-miner-throw-00": sprites["throws"][0],
        "pm-miner-throw-01": sprites["throws"][1],
        "pm-miner-throw-02": sprites["throws"][2],
        "pm-miner-throw-03": sprites["throws"][3],
        "pm-dynamite-lit-00": sprites["dynamite"][0],
        "pm-dynamite-lit-01": sprites["dynamite"][1],
        "pm-surface-wide": sprites["surface"],
        "pm-hud-wide": sprites["hud"],
    }
    for name, im in files.items():
        save_png(im, ASSETS / f"{name}.png")
    # Static winch file must be its own bytes even when identical to frame 00.
    save_png(sprites["winches"][0], ASSETS / "pm-winch-crank.png")

    preview = compose_preview(sprites)
    save_png(preview.convert("RGB"), PACK / "preview.png")

    manifest = build_manifest(sprites, files)
    (PACK / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    qa = run_qa(files)
    (PACK / "docs" / "QA.json").write_text(json.dumps(qa, indent=2) + "\n")

    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    save_png(zoom_row(sprites["winches"], 4), art / "p3-winch-4x.png")
    save_png(zoom_row(sprites["miners"] + [sprites["idle"]], 4), art / "p3-frog-4x.png")
    save_png(zoom_row(sprites["throws"], 4), art / "p3-throw-4x.png")
    save_png(zoom_row(sprites["dynamite"], 8), art / "p3-dynamite-8x.png")
    save_png(preview.convert("RGB"), art / "p3-preview.png")
    save_png(sprites["surface"], art / "p3-surface.png")
    save_png(sprites["hud"], art / "p3-hud.png")
    mock = compose_mock(sprites)
    save_png(mock, art / "p3-mock.png")
    # Grip proof: four panels, same scale as the preview's top row.
    save_png(zoom_row(
        [
            _panel(sprites["miners"][i], sprites["winches"][i])
            for i in range(4)
        ],
        3,
    ), art / "p3-grip-3x.png")

    zip_path = ROOT / "pepe-gold-hook-art-p3.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(PACK.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(PACK).as_posix())
    failed = [c for c in qa["checks"] if not c["ok"]]
    print(f"checks {sum(c['ok'] for c in qa['checks'])}/{len(qa['checks'])} zip {zip_path}")
    for c in failed:
        print("FAIL", c["name"], c["detail"])
    if failed:
        raise SystemExit(1)


def _panel(frog, winch) -> Image.Image:
    panel_w, panel_h = 240, 210
    teal = (0, 128, 128, 255)
    panel = Image.new("RGBA", (panel_w, panel_h), teal)
    feet = (100, 176)
    rope = (feet[0] + 60, feet[1] - 20)
    frog_xy = (feet[0] - FROG_ANCHOR[0], feet[1] - FROG_ANCHOR[1])
    winch_xy = (rope[0] - ROPE_EXIT[0], rope[1] - ROPE_EXIT[1])
    panel.paste(winch, winch_xy, winch)
    panel.paste(frog, frog_xy, frog)
    return panel


if __name__ == "__main__":
    main()
