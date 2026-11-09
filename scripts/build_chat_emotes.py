#!/usr/bin/env python3
"""Build the PondOS chat emotes from the Pepecoin.com "Pepe Emojis for Reddit" set.

Source: https://github.com/pepecoinppc/pepe_emojis_for_reddit (folder emojis/, 64x64 PNG/JPG/WEBP + GIF).
Usage:  python3 -I scripts/build_chat_emotes.py /path/to/pepe_emojis_for_reddit/emojis
Writes docs/meme/emotes/<code>.webp (static q82, animated q70, 64x64) and docs/meme/emotes/emotes.json.
A code is the file name in lower case with spaces as "_": "pepe kek.png" -> :pepe_kek:.
"""
import json, re, sys
from pathlib import Path
from PIL import Image, ImageSequence

SRC = Path(sys.argv[1]); OUT = Path(__file__).resolve().parent.parent / 'docs/meme/emotes'
OUT.mkdir(parents=True, exist_ok=True)
# names our chat filter would mask or punish (games.badwords / blocked_terms), or that do not fit a public chat
RENAME = {'pepe lets fucking go lfg': 'pepe lfg'}
SKIP = {'pepe retard', 'pepe feels ahegao man'}
FAM = {'1': 'pepe', '2': 'apu', '3': 'peepo', '4': 'pepega', '5': 'pepega'}

def code_of(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

def fit(im):
    im = im.convert('RGBA')
    if im.size != (64, 64):
        im.thumbnail((64, 64), Image.LANCZOS)
        c = Image.new('RGBA', (64, 64), (0, 0, 0, 0)); c.paste(im, ((64 - im.width) // 2, (64 - im.height) // 2)); im = c
    return im

items, seen = [], set()
for kind in ('static', 'gif'):
    for f in sorted((SRC / kind).rglob('*')):
        if not f.is_file() or f.name.startswith('.') or f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp', '.gif'):
            continue
        name = f.stem.strip()
        if name.lower() in SKIP: continue
        name = RENAME.get(name.lower(), name)
        code = code_of(name)
        if code in seen:
            code += '_gif' if kind == 'gif' else '_2'
        if code in seen or not re.fullmatch(r'[a-z0-9_]{2,32}', code):
            print('skip', f, file=sys.stderr); continue
        seen.add(code)
        fam = FAM.get(f.parent.name[:1], 'pepe')
        im = Image.open(f)
        dst = OUT / (code + '.webp')
        n = getattr(im, 'n_frames', 1)
        if kind == 'gif' and n > 1:
            frames, durs = [], []
            for fr in ImageSequence.Iterator(im):
                frames.append(fit(fr.copy())); durs.append(max(20, fr.info.get('duration', im.info.get('duration', 80)) or 80))
            frames[0].save(dst, 'WEBP', save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=70, method=6, minimize_size=True)
        else:
            fit(im).save(dst, 'WEBP', quality=82, method=6)
        items.append({'c': code, 'n': name, 'f': fam, 'a': 1 if kind == 'gif' and n > 1 else 0})

(OUT / 'emotes.json').write_text(json.dumps({'source': 'https://github.com/pepecoinppc/pepe_emojis_for_reddit', 'emotes': items}, separators=(',', ':')))
print(len(items), 'emotes;', sum(i['a'] for i in items), 'animated')
