"""Make the small still icons PondOS uses (docs/meme/img/ico/NAME.webp) from docs/meme/img/NAME.webp.

Desktop icons, the Start menu, title bars, the taskbar, folders and balloons show pictures at 16-40 px.
Loading the full animated WebPs for them cost several hundred KB on the first visit, so each icon is
the first frame of its picture, at most 96 px on the long side (sharp on 2x screens). Run again after
adding a picture: python3 scripts/make_meme_icons.py
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'docs', 'meme', 'img')
OUT = os.path.join(SRC, 'ico')
os.makedirs(OUT, exist_ok=True)
total = 0
for name in sorted(os.listdir(SRC)):
    if not name.endswith('.webp') or name.startswith('wall-'):
        continue
    with Image.open(os.path.join(SRC, name)) as im:
        im.seek(0)
        fr = im.convert('RGBA')
    fr.thumbnail((96, 96), Image.LANCZOS)
    dst = os.path.join(OUT, name)
    fr.save(dst, 'WEBP', quality=82, method=6)
    total += os.path.getsize(dst)
print('icons:', len(os.listdir(OUT)), 'total KB:', total // 1024)
