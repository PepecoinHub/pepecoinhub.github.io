"""Base cartoon frog drawing (head, shirt, a few outfits) used by make_games_frogs.py. viewBox -100 -95 200 250."""
G='#6fb043'; G2='#4f8f2f'; K='#1b2416'; LIP='#b8643c'; SHIRT='#2f6fe0'; SHIRT2='#2459bf'
def head(mood='chill', glasses=False, tears=False):
    s=[]
    # head
    s.append(f'<path d="M-80,-6 C-84,-46 -62,-60 -44,-58 C-36,-84 -4,-84 4,-60 C14,-84 50,-84 56,-56 C76,-54 88,-32 84,-4 C80,30 46,44 2,44 C-44,44 -77,28 -80,-6Z" fill="{G}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>')
    s.append(f'<path d="M-66,18 C-40,34 40,34 70,14" fill="none" stroke="{G2}" stroke-width="3" opacity=".55"/>')
    # eyes
    for cx,px in ((-30,-23),(28,35)):
        s.append(f'<ellipse cx="{cx}" cy="-40" rx="22" ry="16" fill="#fff" stroke="{K}" stroke-width="3.5"/>')
        py = -38 if mood!='cry' else -36
        s.append(f'<circle cx="{px}" cy="{py}" r="9" fill="{K}"/><circle cx="{px+3}" cy="{py-4}" r="3" fill="#fff"/>')
        if mood in ('chill','smile','serious','sad','cry'):
            if mood=='sad' or mood=='cry':
                d=f'M{cx-24},-46 C{cx-12},-60 {cx+12},-58 {cx+24},-52 L{cx+24},-62 L{cx-24},-62Z' if cx<0 else f'M{cx-24},-52 C{cx-12},-58 {cx+12},-60 {cx+24},-46 L{cx+24},-62 L{cx-24},-62Z'
            elif mood=='serious':
                d=f'M{cx-24},-41 C{cx-10},-45 {cx+10},-45 {cx+24},-41 L{cx+24},-62 L{cx-24},-62Z'
            else:
                d=f'M{cx-24},-44 C{cx-10},-52 {cx+10},-52 {cx+24},-44 L{cx+24},-62 L{cx-24},-62Z'
            s.append(f'<path d="{d}" fill="{G}" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/>')
    if glasses:
        s.append(f'<g fill="none" stroke="{K}" stroke-width="4"><rect x="-54" y="-58" width="46" height="34" rx="6"/><rect x="4" y="-58" width="46" height="34" rx="6"/><path d="M-8,-44 L4,-44 M50,-46 L80,-52"/></g>')
    # mouth
    if mood in ('chill','smile'):
        s.append(f'<path d="M-60,6 C-34,16 30,16 62,2 C60,16 30,26 -2,25 C-34,25 -56,18 -60,6Z" fill="{LIP}" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/>')
        s.append(f'<path d="M-56,9 C-30,18 30,17 59,6" fill="none" stroke="{K}" stroke-width="2.5"/>')
    elif mood in ('sad','serious'):
        s.append(f'<path d="M-60,16 C-30,2 30,2 62,14 C60,24 30,20 -2,19 C-34,20 -56,26 -60,16Z" fill="{LIP}" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/>')
    elif mood=='cry':
        s.append(f'<path d="M-44,30 C-30,0 30,0 46,30 C30,40 -30,40 -44,30Z" fill="#5a1a1a" stroke="{K}" stroke-width="3.5" stroke-linejoin="round"/><path d="M-24,33 C-10,24 12,24 26,33 C14,38 -12,38 -24,33Z" fill="#e0627a"/><path d="M-30,12 C-14,4 14,4 32,12 L28,17 C12,11 -12,11 -27,17Z" fill="#fff"/>')
    if tears or mood=='cry':
        s.append('<path d="M-46,-26 C-52,-6 -50,14 -56,40" fill="none" stroke="#4fb3ff" stroke-width="7" stroke-linecap="round" opacity=".9"/><path d="M48,-26 C54,-6 52,14 58,40" fill="none" stroke="#4fb3ff" stroke-width="7" stroke-linecap="round" opacity=".9"/>')
    return ''.join(s)

def shirt(color=SHIRT, arms='down'):
    s=[f'<path d="M-30,140 L-34,166 M30,140 L34,166" stroke="{G}" stroke-width="16" stroke-linecap="round"/>',
       f'<path d="M-30,140 L-34,166 M30,140 L34,166" stroke="{K}" stroke-width="3" fill="none" opacity="0"/>',
       f'<ellipse cx="-38" cy="168" rx="16" ry="7" fill="{G}" stroke="{K}" stroke-width="3"/><ellipse cx="38" cy="168" rx="16" ry="7" fill="{G}" stroke="{K}" stroke-width="3"/>',
       f'<path d="M-58,34 C-80,70 -80,128 -58,146 C-30,156 30,156 58,146 C80,128 80,70 58,34 C30,48 -30,48 -58,34Z" fill="{color}" stroke="{K}" stroke-width="4" stroke-linejoin="round"/>']
    if arms=='down':
        s.append(f'<path d="M-62,56 C-80,84 -82,104 -74,118" fill="none" stroke="{K}" stroke-width="3"/><path d="M62,56 C80,84 82,104 74,118" fill="none" stroke="{K}" stroke-width="3"/>')
        s.append(f'<circle cx="-74" cy="122" r="10" fill="{G}" stroke="{K}" stroke-width="3"/><circle cx="74" cy="122" r="10" fill="{G}" stroke="{K}" stroke-width="3"/>')
    elif arms=='clasp':
        s.append(f'<path d="M-62,60 C-60,92 -30,104 -8,104 M62,60 C60,92 30,104 8,104" fill="none" stroke="{K}" stroke-width="3"/>')
        s.append(f'<ellipse cx="0" cy="104" rx="20" ry="13" fill="{G}" stroke="{K}" stroke-width="3"/><path d="M-10,98 C-2,104 6,104 12,98 M-12,106 C-2,112 8,110 14,106" fill="none" stroke="{K}" stroke-width="2.5"/>')
    return ''.join(s)

def straw_hat():
    return (f'<g transform="translate(0,-80) rotate(-6) scale(.9)"><ellipse cx="0" cy="8" rx="96" ry="20" fill="#f1cf7a" stroke="{K}" stroke-width="4"/>'
            f'<path d="M-46,8 C-46,-34 46,-34 46,8Z" fill="#f4d98d" stroke="{K}" stroke-width="4"/>'
            f'<path d="M-45,-2 C-20,6 20,6 45,-2 L46,8 C20,16 -20,16 -46,8Z" fill="#c8452f" stroke="{K}" stroke-width="3"/>'
            '<path d="M-70,10 L-58,12 M-30,20 L-20,18 M20,20 L32,18 M60,12 L72,10" stroke="#c99a3a" stroke-width="3"/></g>')

def pep_coin(x,y,r=26):
    return (f'<g transform="translate({x},{y})"><circle r="{r}" fill="#f2c230" stroke="{K}" stroke-width="4"/><circle r="{r-6}" fill="none" stroke="#c99a2e" stroke-width="3"/>'
            f'<text y="{r*0.32}" text-anchor="middle" font-family="Lilita One, Ubuntu, sans-serif" font-size="{r*0.82}" fill="#5b4210">PEP</text></g>')

def frog(kind='chill', size=200, extra=''):
    vb='-100 -100 200 280'
    body=''
    if kind=='farmer':
        body = shirt(arms='none') + f'<path d="M-62,58 C-82,80 -60,104 -26,100" fill="none" stroke="{K}" stroke-width="3"/>' \
               + f'<path d="M62,58 C82,80 62,104 30,100" fill="none" stroke="{K}" stroke-width="3"/>' \
               + pep_coin(0,96,30) + f'<circle cx="-28" cy="100" r="10" fill="{G}" stroke="{K}" stroke-width="3"/><circle cx="28" cy="100" r="10" fill="{G}" stroke="{K}" stroke-width="3"/>' \
               + head('smile') + straw_hat()
    elif kind=='cry':
        body = shirt(arms='down') + head('cry')
    elif kind=='suit':
        body = (f'<path d="M-30,140 L-34,166 M30,140 L34,166" stroke="{G}" stroke-width="16" stroke-linecap="round"/>'
                f'<ellipse cx="-38" cy="168" rx="16" ry="7" fill="#222" stroke="{K}" stroke-width="3"/><ellipse cx="38" cy="168" rx="16" ry="7" fill="#222" stroke="{K}" stroke-width="3"/>'
                f'<path d="M-58,34 C-80,70 -80,128 -58,146 C-30,156 30,156 58,146 C80,128 80,70 58,34 C30,48 -30,48 -58,34Z" fill="#1f2326" stroke="{K}" stroke-width="4"/>'
                f'<path d="M-24,40 L0,92 L24,40 C10,46 -10,46 -24,40Z" fill="#fff" stroke="{K}" stroke-width="3"/>'
                f'<path d="M-6,46 L6,46 L10,58 L0,90 L-10,58Z" fill="#b3261e" stroke="{K}" stroke-width="2.5"/>'
                f'<rect x="28" y="70" width="22" height="5" fill="#fff"/>' + head('serious', glasses=True))
    elif kind=='swim':
        body = (f'<path d="M-28,136 L-32,166 M28,136 L32,166" stroke="{G}" stroke-width="18" stroke-linecap="round"/>'
                f'<ellipse cx="-38" cy="168" rx="16" ry="7" fill="{G}" stroke="{K}" stroke-width="3"/><ellipse cx="38" cy="168" rx="16" ry="7" fill="{G}" stroke="{K}" stroke-width="3"/>'
                f'<path d="M-56,32 C-84,70 -84,124 -50,140 C-20,150 20,150 50,140 C84,124 84,70 56,32 C30,46 -30,46 -56,32Z" fill="{G}" stroke="{K}" stroke-width="4"/>'
                f'<path d="M-52,118 C-20,128 20,128 52,118 L48,140 C20,152 -20,152 -48,140Z" fill="{SHIRT}" stroke="{K}" stroke-width="3.5"/>'
                f'<path d="M-58,50 C-90,70 -84,96 -62,100 M58,50 C90,70 84,96 62,100" fill="none" stroke="{K}" stroke-width="4"/>'
                f'<path d="M-30,80 C-20,86 -10,86 -4,80 M4,80 C10,86 20,86 30,80 M-4,106 L2,108" fill="none" stroke="{K}" stroke-width="2.5"/>' + head('chill'))
    elif kind=='clasp':
        body = shirt(arms='clasp') + head('chill')
    elif kind=='sad':
        body = shirt(color='#e9eef5', arms='down') + head('sad')
    else:
        body = shirt(arms='down') + head('chill')
    return f'<svg class="frog" viewBox="{vb}" width="{size}" height="{size*1.4:.0f}" aria-hidden="true">{body}{extra}</svg>'
