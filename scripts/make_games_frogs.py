#!/usr/bin/env python3
"""Writes the PEP Games frog illustrations (docs/games/img/frog-*.svg full body, avatar-*.svg heads).

Run:  python3 scripts/make_games_frogs.py
Same cartoon style as games_frogs_base.py; each frog is the base frog plus an accessory.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import games_frogs_base as F

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'games', 'img')
K, G = F.K, F.G
GOLD, RED, NAVY = '#F6BB60', '#c8452f', '#1f3a6e'

def crown():
    return (f'<path d="M-40,-76 L-48,-124 L-22,-98 L0,-132 L22,-98 L48,-124 L40,-76 C20,-70 -20,-70 -40,-76Z" fill="{GOLD}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<circle cx="-48" cy="-126" r="6" fill="#e0627a" stroke="{K}" stroke-width="3"/><circle cx="0" cy="-134" r="7" fill="#4fb3ff" stroke="{K}" stroke-width="3"/><circle cx="48" cy="-126" r="6" fill="#e0627a" stroke="{K}" stroke-width="3"/>')

def captain():
    return (f'<path d="M-62,-80 C-64,-122 64,-122 62,-80Z" fill="#fff" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M-64,-86 L64,-86 L66,-70 L-66,-70Z" fill="{NAVY}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M-62,-72 C-30,-60 30,-60 62,-72 L72,-62 C30,-46 -30,-46 -72,-62Z" fill="#14181c" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/>'
            f'<circle cx="0" cy="-102" r="11" fill="{GOLD}" stroke="{K}" stroke-width="3"/><path d="M-5,-102 L5,-102 M0,-107 L0,-97" stroke="{K}" stroke-width="2.5"/>')

def beret():
    return (f'<path d="M-66,-80 C-76,-120 40,-134 68,-98 C74,-84 40,-74 -66,-80Z" fill="{RED}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M10,-120 C12,-132 22,-134 24,-126" fill="none" stroke="{K}" stroke-width="4" stroke-linecap="round"/>')

def party():
    return (f'<path d="M-34,-76 L10,-156 L52,-76 C20,-68 -10,-68 -34,-76Z" fill="#7c6ae0" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M-20,-96 L40,-92 M-8,-118 L30,-114" stroke="{GOLD}" stroke-width="6" stroke-linecap="round"/>'
            f'<circle cx="10" cy="-158" r="10" fill="{GOLD}" stroke="{K}" stroke-width="3.5"/>'
            '<circle cx="-70" cy="-96" r="5" fill="#e0627a"/><circle cx="84" cy="-70" r="5" fill="#4fb3ff"/><circle cx="-84" cy="-60" r="4" fill="#f1cf7a"/><circle cx="92" cy="-100" r="4" fill="#e0627a"/>')

def headphones():
    return (f'<path d="M-80,-10 C-92,-104 96,-104 86,-10" fill="none" stroke="{K}" stroke-width="11" stroke-linecap="round"/>'
            f'<rect x="-98" y="-26" width="26" height="42" rx="11" fill="#2a2f36" stroke="{K}" stroke-width="4"/><rect x="70" y="-26" width="26" height="42" rx="11" fill="#2a2f36" stroke="{K}" stroke-width="4"/>')

def qbubble():
    return (f'<circle cx="86" cy="-96" r="24" fill="#fff" stroke="{K}" stroke-width="4"/><circle cx="62" cy="-66" r="6" fill="#fff" stroke="{K}" stroke-width="3"/>'
            f'<text x="86" y="-86" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="{K}">?</text>')

def zzz():
    t = lambda x, y, sz: f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="{sz}" fill="#6b7a91" stroke="{K}" stroke-width="1.2">z</text>'
    return t(70, -70, 24) + t(88, -96, 32) + t(110, -128, 40)

def trophy():
    return (f'<path d="M-24,66 L24,66 C26,96 14,108 0,108 C-14,108 -26,96 -24,66Z" fill="{GOLD}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M-24,72 C-44,72 -44,96 -22,98 M24,72 C44,72 44,96 22,98" fill="none" stroke="{K}" stroke-width="4"/>'
            f'<rect x="-8" y="108" width="16" height="12" fill="{GOLD}" stroke="{K}" stroke-width="3.5"/><rect x="-20" y="118" width="40" height="10" rx="3" fill="#c99a2e" stroke="{K}" stroke-width="3.5"/>'
            '<path d="M-12,74 C-14,88 -10,96 -6,100" fill="none" stroke="#fff" stroke-width="3" opacity=".7" stroke-linecap="round"/>')

def pencil():
    return (f'<g transform="translate(80,116) rotate(32)"><rect x="-6" y="-70" width="12" height="62" fill="#f1cf7a" stroke="{K}" stroke-width="3.5"/>'
            f'<path d="M-6,-8 L0,12 L6,-8Z" fill="#f3d9b5" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/><path d="M-2.4,3 L0,12 L2.4,3Z" fill="{K}"/>'
            f'<rect x="-6" y="-80" width="12" height="12" fill="#e0627a" stroke="{K}" stroke-width="3.5"/></g>'
            f'<circle cx="74" cy="122" r="10" fill="{G}" stroke="{K}" stroke-width="3"/>')

def sleepy_eyes():
    # cover the open eyes with closed ones
    s = ''
    for cx in (-30, 28):
        s += f'<ellipse cx="{cx}" cy="-40" rx="23" ry="17" fill="{G}" stroke="{K}" stroke-width="3.5"/>'
        s += f'<path d="M{cx-17},-40 C{cx-8},-28 {cx+8},-28 {cx+17},-40" fill="none" stroke="{K}" stroke-width="4" stroke-linecap="round"/>'
    return s

def head(mood='smile', **kw):
    return F.head(mood, **kw)

def body(kind):
    """(svg inner markup) for a full-body frog."""
    if kind == 'chill':   return F.shirt() + head('chill')
    if kind == 'winner':  return F.shirt(arms='clasp') + head('smile') + trophy() + crown()
    if kind == 'thinker': return F.shirt(arms='down') + head('serious', glasses=True) + qbubble()
    if kind == 'artist':  return F.shirt(color=RED, arms='down') + head('smile') + pencil() + beret()
    if kind == 'captain': return F.shirt(color=NAVY, arms='down') + head('smile') + captain()
    if kind == 'sleepy':  return F.shirt(color='#7a8fb8', arms='down') + head('smile') + sleepy_eyes() + zzz()
    if kind == 'party':   return F.shirt(color='#e0627a', arms='down') + head('smile') + party()
    if kind == 'gamer':   return F.shirt(color='#3a3f47', arms='down') + head('chill') + headphones()
    if kind == 'sad':     return F.shirt(color='#e9eef5', arms='down') + head('sad')
    raise KeyError(kind)

def avatar(kind):
    acc = {'chill': '', 'winner': crown(), 'thinker': '', 'artist': beret(), 'captain': captain(), 'sleepy': sleepy_eyes(), 'party': party(), 'gamer': headphones(), 'sad': ''}[kind]
    mood = {'thinker': 'serious', 'sad': 'sad', 'gamer': 'chill', 'chill': 'chill'}.get(kind, 'smile')
    glasses = kind == 'thinker'
    return head(mood, glasses=glasses) + acc

def write(name, vb, w, h, inner, title):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" role="img" aria-label="{title}"><title>{title}</title>{inner}</svg>\n'
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
        fh.write(svg)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    kinds = ['chill', 'winner', 'thinker', 'artist', 'captain', 'sleepy', 'party', 'gamer', 'sad']
    for k in kinds:
        write(f'frog-{k}.svg', '-135 -170 270 350', 270, 350, body(k), f'Frog: {k}')
        write(f'avatar-{k}.svg', '-135 -170 270 240', 270, 240, avatar(k), f'Frog avatar: {k}')
    print('wrote', len(kinds) * 2, 'files to', os.path.normpath(OUT))
