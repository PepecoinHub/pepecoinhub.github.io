"""Folder icons for the PEP-TV Ads (docs/meme/img/ico/ad-*.webp), one look per infomercial.

Each icon is a Fren built from the Avatar Maker's own layers (docs/meme/avatar-assets/layers) on a loud
background, plus one prop drawn here: a news mic, a tabloid star, a price tag, a palm tree, a title belt,
a telethon phone, a crystal ball. Drawn at 256 px and scaled to 64 px, like the other folder icons.

    python scripts/build_ad_icons.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYERS = os.path.join(ROOT, 'docs', 'meme', 'avatar-assets', 'layers')
STAMPS = os.path.join(ROOT, 'docs', 'meme', 'passport-assets', 'stamps-v3.webp')
OUT = os.path.join(ROOT, 'docs', 'meme', 'img', 'ico')
S = 256
INK = (20, 16, 24, 255)


def fren(clothing, mouth, eyes, hat, acc, size=210):
    im = Image.new('RGBA', (512, 512))
    for part in ('base_frog', clothing, mouth, eyes, hat, acc):
        layer = Image.open(os.path.join(LAYERS, part + '.webp')).convert('RGBA')
        im.alpha_composite(layer)
    return im.resize((size, size), Image.LANCZOS)


def grad(c1, c2, vertical=True):
    im = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(im)
    for i in range(S):
        t = i / (S - 1)
        c = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3)) + (255,)
        d.line([(0, i), (S, i)] if vertical else [(i, 0), (i, S)], fill=c)
    return im


def burst(d, cx, cy, r1, r2, n, fill, outline=INK, rot=0.0):
    pts = []
    for i in range(n * 2):
        a = rot + math.pi * i / n
        r = r1 if i % 2 == 0 else r2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=fill, outline=outline, width=5)


def rounded(base):
    """Soft corners and a dark rim, like the other ad icons."""
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=34, fill=255)
    out = Image.new('RGBA', (S, S))
    out.paste(base, (0, 0), mask)
    ImageDraw.Draw(out).rounded_rectangle((2, 2, S - 3, S - 3), radius=32, outline=INK, width=6)
    return out


def save(im, name):
    im.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)


def stamp(name_index, h=150):
    sheet = Image.open(STAMPS).convert('RGBA')
    return sheet.crop((name_index * 138, 0, name_index * 138 + 138, 150))


def news():
    im = grad((210, 20, 30), (20, 40, 150))
    d = ImageDraw.Draw(im)
    for k in range(0, S, 22):  # the shiny 2001 globe lines
        d.arc((-60, 40 + k // 3, S + 60, S + 120 - k // 3), 180, 360, fill=(255, 255, 255, 50), width=3)
    im.alpha_composite(fren('clothing_suit', 'mouth_open', 'eyes_classic', 'hat_none', 'accessory_none'), (24, 30))
    # microphone
    d.rectangle((150, 150, 166, 236), fill=(40, 40, 40, 255), outline=INK, width=4)
    d.ellipse((136, 112, 180, 160), fill=(180, 180, 190, 255), outline=INK, width=5)
    d.rectangle((130, 160, 186, 182), fill=(220, 20, 30, 255), outline=INK, width=4)
    # BREAKING bar
    d.rectangle((0, 196, S, 236), fill=(255, 212, 0, 255), outline=INK, width=4)
    for x in range(14, 120, 26):
        d.rectangle((x, 208, x + 16, 224), fill=(210, 20, 30, 255))
    save(rounded(im), 'ad-news')


def tabloid():
    im = grad((255, 70, 170), (120, 0, 120))
    d = ImageDraw.Draw(im)
    burst(d, 128, 128, 150, 118, 18, (255, 120, 200, 255), outline=None)
    im.alpha_composite(fren('clothing_purple_hoodie', 'mouth_shout', 'eyes_hearts', 'hat_none', 'accessory_shades'), (8, 40))
    d = ImageDraw.Draw(im)
    burst(d, 196, 64, 54, 34, 12, (255, 236, 0, 255), rot=0.2)
    d.rectangle((188, 34, 204, 76), fill=INK)  # "!"
    d.ellipse((187, 82, 205, 100), fill=INK)
    for x, y in ((40, 40), (60, 200), (220, 170)):  # sparkles
        d.line((x - 14, y, x + 14, y), fill=(255, 255, 255, 255), width=5)
        d.line((x, y - 14, x, y + 14), fill=(255, 255, 255, 255), width=5)
    save(rounded(im), 'ad-tabloid')


def shop():
    im = grad((90, 20, 150), (30, 0, 70))
    d = ImageDraw.Draw(im)
    for i in range(10):  # gold rays
        a = i * math.pi / 5
        d.polygon([(128, 128), (128 + 200 * math.cos(a - .12), 128 + 200 * math.sin(a - .12)),
                   (128 + 200 * math.cos(a + .12), 128 + 200 * math.sin(a + .12))], fill=(255, 200, 40, 70))
    st = stamp(7).resize((150, 163), Image.LANCZOS).rotate(-8, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(st, (20, 34))
    d = ImageDraw.Draw(im)
    burst(d, 184, 186, 66, 44, 14, (255, 222, 0, 255), rot=0.1)
    # a big drawn "0" on the tag (no font needed)
    d.ellipse((160, 158, 208, 214), outline=(210, 20, 30, 255), width=12)
    save(rounded(im), 'ad-shop')


def travel():
    im = Image.open(os.path.join(LAYERS, 'bg_sunset.webp')).convert('RGBA').resize((S, S), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.ellipse((150, 30, 236, 116), fill=(255, 230, 90, 255))
    # palm tree
    d.line((214, 250, 200, 120), fill=(110, 70, 30, 255), width=14)
    for a in (-2.6, -2.0, -1.2, -0.5, 0.2):
        d.line((200, 120, 200 + 70 * math.cos(a), 120 + 50 * math.sin(a) + 20), fill=(30, 140, 60, 255), width=12)
    im.alpha_composite(fren('clothing_blue', 'mouth_smile', 'eyes_classic', 'hat_explorer', 'accessory_shades'), (0, 46))
    save(rounded(im), 'ad-travel')


def belt():
    im = grad((255, 190, 0), (200, 20, 0))
    d = ImageDraw.Draw(im)
    for x in range(-20, S, 34):  # flames
        d.polygon([(x, S), (x + 17, 150 + (x * 7) % 40), (x + 34, S)], fill=(255, 90, 0, 255))
        d.polygon([(x + 8, S), (x + 17, 190 + (x * 5) % 30), (x + 26, S)], fill=(255, 220, 60, 255))
    im.alpha_composite(fren('clothing_none', 'mouth_shout', 'eyes_angry', 'hat_none', 'accessory_none'), (23, 0))
    d = ImageDraw.Draw(im)
    # the title belt held up in front
    d.rounded_rectangle((14, 168, 242, 214), radius=16, fill=(40, 30, 20, 255), outline=INK, width=5)
    d.ellipse((88, 146, 168, 236), fill=(255, 205, 40, 255), outline=INK, width=6)
    d.ellipse((106, 164, 150, 218), fill=(255, 240, 150, 255), outline=(170, 120, 0, 255), width=4)
    for x in (40, 62, 194, 216):
        d.ellipse((x - 8, 183, x + 8, 199), fill=(255, 205, 40, 255), outline=INK, width=3)
    save(rounded(im), 'ad-belt')


def telethon():
    im = grad((20, 70, 190), (10, 20, 80))
    d = ImageDraw.Draw(im)
    for x in range(16, S, 40):  # tote board bulbs
        d.ellipse((x, 10, x + 18, 28), fill=(255, 230, 120, 255))
    im.alpha_composite(fren('clothing_shirt_tie', 'mouth_teeth', 'eyes_happy', 'hat_none', 'accessory_headphones'), (-10, 38))
    d = ImageDraw.Draw(im)
    # a big red desk phone
    d.rounded_rectangle((130, 170, 246, 236), radius=14, fill=(220, 30, 30, 255), outline=INK, width=5)
    d.rounded_rectangle((122, 140, 254, 172), radius=16, fill=(240, 50, 50, 255), outline=INK, width=5)
    d.ellipse((166, 182, 210, 226), fill=(250, 240, 230, 255), outline=INK, width=4)
    for k in range(8):
        a = k * math.pi / 4
        d.ellipse((188 + 14 * math.cos(a) - 3, 204 + 14 * math.sin(a) - 3, 188 + 14 * math.cos(a) + 3, 204 + 14 * math.sin(a) + 3), fill=INK)
    save(rounded(im), 'ad-telethon')


def psychic():
    im = grad((60, 0, 110), (10, 0, 40))
    d = ImageDraw.Draw(im)
    for x, y in ((30, 30), (220, 40), (200, 110), (40, 120), (120, 20)):
        burst(d, x, y, 10, 4, 4, (255, 240, 160, 255), outline=None)
    im.alpha_composite(fren('clothing_purple_hoodie', 'mouth_smirk', 'eyes_hypno', 'hat_none', 'accessory_none'), (23, 10))
    d = ImageDraw.Draw(im)
    glow = Image.new('RGBA', (S, S))
    ImageDraw.Draw(glow).ellipse((60, 130, 196, 266), fill=(150, 220, 255, 140))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    d.ellipse((76, 140, 180, 244), fill=(140, 200, 255, 230), outline=INK, width=5)
    d.ellipse((96, 158, 126, 182), fill=(240, 250, 255, 220))
    d.polygon([(70, 250), (186, 250), (166, 226), (90, 226)], fill=(200, 150, 40, 255), outline=INK)
    save(rounded(im), 'ad-psychic')


if __name__ == '__main__':
    for f in (news, tabloid, shop, travel, belt, telethon, psychic):
        f()
    print('ok')
