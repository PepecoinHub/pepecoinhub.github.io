# Measure QA metadata only. Never rewrites the supplied PNGs or manifest.
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'docs/games/img/pondwars/players/pixel-v04'
manifest = json.loads((root / 'manifest.json').read_text())
body = Image.open(root / 'atlas.png').convert('RGBA')
helmet = Image.open(root / 'helmet_pose_atlas.png').convert('RGBA')
skin = {(92, 164, 76), (128, 196, 102), (71, 132, 62)}
frames = []
for state, clip in manifest['clips'].items():
    for index, frame in enumerate(clip['frames']):
        x, y, w, h = frame['rect']
        tile = body.crop((x, y, x + w, y + h))
        points = {(px, py) for py in range(h) for px in range(w) if tile.getpixel((px, py))[:3] in skin and tile.getpixel((px, py))[3]}
        fists = []
        while points:
            queue, component = [points.pop()], []
            while queue:
                px, py = queue.pop()
                component.append((px, py))
                for p in [(px-1, py), (px+1, py), (px, py-1), (px, py+1)]:
                    if p in points:
                        points.remove(p)
                        queue.append(p)
            left, top = min(p[0] for p in component), min(p[1] for p in component)
            right, bottom = max(p[0] for p in component)+1, max(p[1] for p in component)+1
            if len(component) >= 36 and right-left <= 18 and bottom-top <= 18 and bottom <= 114:
                center = ((left+right)/2, (top+bottom)/2)
                grip = min(component, key=lambda p: ((p[0]-center[0])**2+(p[1]-center[1])**2, p))
                fists.append(grip)
        if not fists:
            raise ValueError(f'No isolated fist found: {state}/{index}')
        hand = min(fists, key=lambda p: (p[0]-frame['hand'][0])**2+(p[1]-frame['hand'][1])**2)
        bounds = helmet.crop((x, y, x+w, y+h)).getbbox()
        left, top, right, bottom = bounds
        frames.append({'state': state, 'index': index, 'rect': frame['rect'],
                       'head': [(left+right)/2, (top+bottom)/2],
                       'helmetRect': [x+left, y+top, right-left, bottom-top],
                       'hand': list(hand), 'sourceHand': frame['hand']})
result = {'version': 1, 'status': 'QA measurements; not artist-approved grips',
          'headMeaning': 'center of nontransparent helmet bounds in local frame coordinates',
          'handMeaning': 'center skin pixel in isolated fist nearest supplied hand; visually review weapon-specific grip',
          'frames': frames}
header = json.dumps({k: v for k, v in result.items() if k != 'frames'}, indent=2).removesuffix('\n}')
entries = ',\n'.join('    ' + json.dumps(frame) for frame in frames)
encoded = header + ',\n  \"frames\": [\n' + entries + '\n  ]\n}\n'
if '--check' in sys.argv:
    assert (root / 'qa-anchors.json').read_text() == encoded, 'QA anchors need regeneration'
else:
    (root / 'qa-anchors.json').write_text(encoded)
print(f'Measured {len(frames)} head/hand anchors; source images and manifest unchanged.')
