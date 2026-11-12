# Measures the supplied art, without rewriting any PNG or artist manifest.
import json
import sys
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1] / 'docs/games/img/pondwars/players/pixel-v06'
manifest = json.loads((root/'manifest.json').read_text())
body, helmet = [Image.open(root/name).convert('RGBA') for name in ['atlas.png','helmet_pose_atlas.png']]
# Observed centers of the visible raised fist, following the actual rotated art.
# Supplied jump/backflip points fall on the sleeve; aim/charge/fire points are retained.
flying_hands = {'jump': [(97,51)]*4, 'backflip': [(97,51),(78,31),(51,31),(31,50),(31,77),(50,97),(77,97),(97,78)]}
frames=[]
for state, clip in manifest['clips'].items():
    for index, frame in enumerate(clip['frames']):
        x,y,w,h=frame['rect']
        left,top,right,bottom=helmet.crop((x,y,x+w,y+h)).getbbox()
        hand=list(flying_hands[state][index]) if state in flying_hands else frame['hand']
        assert body.getpixel((x+hand[0],y+hand[1]))[:3] == (101,168,61), (state,index,hand)
        frames.append({'state':state,'index':index,'rect':frame['rect'],
                       'head':[(left+right)/2,(top+bottom)/2],
                       'helmetRect':[x+left,y+top,right-left,bottom-top],
                       'hand':hand,'sourceHand':frame['hand']})
result={'version':1,'status':'v06 QA registration, not final art approval',
        'headMeaning':'center of the supplied per-frame helmet alpha bounds',
        'handMeaning':'artist hand retained, except sleeve points in jump/backflip corrected to visible fist', 'frames':frames}
header=json.dumps({k:v for k,v in result.items() if k!='frames'},indent=2).removesuffix('\n}')
encoded=header+',\n  "frames": [\n'+',\n'.join('    '+json.dumps(f) for f in frames)+'\n  ]\n}\n'
if '--check' in sys.argv: assert (root/'qa-anchors.json').read_text()==encoded
else: (root/'qa-anchors.json').write_text(encoded)
print('Validated 53 head/hand registrations; source art unchanged.')
