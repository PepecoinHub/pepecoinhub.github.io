#!/usr/bin/env python3
"""Refresh the "Site pictures" list in docs/meme/newsroom.js (the Newsroom's picture picker).

Lists docs/meme/img/*.{webp,png,gif} (without the "-still" copies) and docs/meme/img/chars/*.
Run it after adding pictures to docs/meme/img:  python3 scripts/build_newsroom_pictures.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'docs', 'meme', 'img')
JS = os.path.join(ROOT, 'docs', 'meme', 'newsroom.js')
SKIP = {'wall-day.webp', 'wall-night.webp', 'recycle-bin.webp'}
OK = re.compile(r'^[a-z0-9_-]+\.(webp|png|gif)$')

names = sorted(n for n in os.listdir(IMG) if OK.match(n) and '-still.' not in n and n not in SKIP)
chars = os.path.join(IMG, 'chars')
if os.path.isdir(chars):
    names += sorted('chars/' + n for n in os.listdir(chars) if OK.match(n) and '-still.' not in n)

src = open(JS, encoding='utf-8').read()
new = re.sub(r'var PICS = \[.*?\];', lambda m: 'var PICS = ' + json.dumps(names, separators=(',', ':')) + ';', src, count=1, flags=re.S)
if new == src and 'var PICS = ' not in src:
    raise SystemExit('PICS list not found in newsroom.js')
open(JS, 'w', encoding='utf-8').write(new)
print(len(names), 'pictures')
