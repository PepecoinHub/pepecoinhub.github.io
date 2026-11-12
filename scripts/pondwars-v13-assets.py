"""Check original source art, safe margins and a non-destructive role merge."""
from pathlib import Path
from PIL import Image
import json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'docs/games/art/arsenal-polish';HAND=ART/'v13/handoff'
manifest=json.loads((ART/'manifest.json').read_text());patch=json.loads((HAND/'manifest_patch.json').read_text());qa=json.loads((HAND/'validation.json').read_text());hashes=json.loads((HAND/'sha256.json').read_text())
base=json.loads(subprocess.check_output(['git','show','8cf0004ff50ba96dddc4f84e39398b0131d1b21d:docs/games/art/arsenal-polish/manifest.json'],cwd=ROOT))
base['version']=patch['version'];base['status']=manifest['status']
for w,roles in patch['weapons'].items():base['weapons'][w].update(roles)
assert base==manifest,'Unrelated manifest entry changed'
rows=[]
for w,roles in patch['weapons'].items():
 for role,c in roles.items():
  p=ROOT/'docs/games'/c['src'];im=Image.open(p);assert hashlib.sha256(p.read_bytes()).hexdigest()==hashes[p.name];assert im.mode=='RGBA' and im.size==(c['frames']*128,128)
  px=im.load();assert all(px[x,y]==px[x+1,y]==px[x,y+1]==px[x+1,y+1] for x in range(0,im.width,2) for y in range(0,128,2))
  for n in range(c['frames']):
   bbox=im.crop((n*128,0,(n+1)*128,128)).getbbox();expected=next(r for r in qa['frames'] if r['asset']==p.name and r['frame']==n);assert list(bbox)==expected['alpha_bbox'];margin=min(bbox[0],bbox[1],128-bbox[2],128-bbox[3]);assert margin>=8
   rows.append({'weapon':w,'role':role,'frame':n,'bbox':bbox,'margin':margin,'worldSize':c['size']})
print(json.dumps({'atlases':len(hashes),'frames':len(rows),'minimumMargin':min(r['margin'] for r in rows),'originalHashes':hashes,'otherManifestEntriesPreserved':True,'rows':rows},indent=2))
