"""Build the Fren Passport v3 stamp sprite from the owner-approved art (PR #233).

Reads games/fren-passport/source/stamps-new/<id>.png (and the two accepted small scenes in
stamps-review/art-v3-wip/), fits each stamp into a 138x150 tile (shown at 69x75, so 2x), and writes
docs/meme/passport-assets/stamps-v3.webp: one row of tiles in the order of V3 below.
docs/meme/meme.js PP_V3 must list the same ids in the same order (tests check it).

Add a stamp here only after the owner approved its picture.
Run: python3 scripts/build_v3_stamps.py [art-root]   (art-root defaults to games/fren-passport)
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

V3 = [
    'frog_of_the_week', 'moonwalker', 'vox_populi', 'certified_fren', 'old_frog', 'good_parent', 'first_avatar',
    'detective_fren', 'good_game', 'yeet_adept', 'fud_buster', 'long_snake', 'arcade_hopper', 'secret_starter',
    'i_voted', 'checkmate', 'picasso_fren',
    # the owner's pixel-art sheet of 7 (2026-11-09); first_avatar above uses its new picture too
    'first_fren', 'sharp_eye', 'community_fren', 'like_it_here', 'nasa_is_hiring', 'rookie_miner',
    # launch scene blocks (2026-11-09)
    'season_champion', 'bug_hunter', 'podium', 'game_night', 'quiz_master', 'frogmas',
    'treasure_hunter', 'interior_designer', 'pep_birthday', 'thanksgiving_fren',
    # redraws of Lily's stamps (owner, 2026-11-09)
    'welcome_back', 'first_words', 'hey_fren', 'dear_editor', 'junior_editor', 'senior_editor', 'streak_14', 'pepe_guesser', 'week_scout',
    'scout_fren', 'first_hatch', 'little_fren', 'grown_fren',
]
SMALL = {'picasso_fren'}   # an accepted scene that exist only as the small review files so far
TILE = (138, 150)
PAD = 3

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def clear_margin(im):
    """Make an opaque near-white margin around the stamp transparent (flood from the edges)."""
    a = np.array(im)
    rgb, al = a[:, :, :3].astype(int), a[:, :, 3]
    h, w = al.shape
    white = (rgb.min(2) >= 228) & ((rgb.max(2) - rgb.min(2)) < 14) & (al > 0)
    seen = np.zeros((h, w), bool)
    q = deque((y, x) for y in range(h) for x in (0, w - 1)) + deque((y, x) for x in range(w) for y in (0, h - 1))
    q = deque(p for p in q if white[p])
    for p in q:
        seen[p] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    a[seen, 3] = 0
    return Image.fromarray(a)


def main():
    art = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'games', 'fren-passport')
    sheet = Image.new('RGBA', (TILE[0] * len(V3), TILE[1]), (0, 0, 0, 0))
    for i, sid in enumerate(V3):
        sub = 'stamps-review/art-v3-wip' if sid in SMALL else 'source/stamps-new'
        im = clear_margin(Image.open(os.path.join(art, sub, sid + '.png')).convert('RGBA'))
        # crop to the stamp: rows and columns with real content (ignores stray pixels in a transparent margin)
        al = np.array(im)[:, :, 3] > 128
        rows, cols = np.nonzero(al.sum(1) > 20)[0], np.nonzero(al.sum(0) > 20)[0]
        im = im.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1))
        s = min((TILE[0] - 2 * PAD) / im.width, (TILE[1] - 2 * PAD) / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        sheet.alpha_composite(im, (i * TILE[0] + (TILE[0] - im.width) // 2, (TILE[1] - im.height) // 2))
    out = os.path.join(ROOT, 'docs', 'meme', 'passport-assets', 'stamps-v3.webp')
    sheet.save(out, 'WEBP', quality=74, method=6)
    print(out, sheet.size, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
