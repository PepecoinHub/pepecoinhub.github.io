"""Audit v12 correction and compare all eight frames to the preserved v11 source."""
import hashlib,json,subprocess
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'docs/games/art/arsenal-polish'
qa=json.loads((ART/'v12/handoff/QA.json').read_text());patch=json.loads((ART/'v12/handoff/manifest_patch.json').read_text())
manifest=json.loads((ART/'manifest.json').read_text())
base=json.loads(subprocess.check_output(['git','show','b3f2d02087b59f5c7ec92e9463fda870fcce2843:docs/games/art/arsenal-polish/manifest.json'],cwd=ROOT))
assert manifest['weapons']['donkey']['flight']==patch['weapons']['donkey']['flight'],'v12 flight must stay intact'
old=ART/'v11/sprites/silver_donkey_atlas.png';new=ART/'v12/sprites/silver_donkey_atlas.png'
assert hashlib.sha256(old.read_bytes()).hexdigest()==qa['source_sha256']
assert hashlib.sha256(new.read_bytes()).hexdigest()==qa['corrected_sha256']
a=Image.open(old);b=Image.open(new);assert a.size==b.size==(1024,128) and a.mode==b.mode=='RGBA'
px=b.load();assert all(px[x,y]==px[x+1,y]==px[x,y+1]==px[x+1,y+1] for x in range(0,1024,2) for y in range(0,128,2))
rows=[]
for n,expected in enumerate(qa['frames']):
 before=a.crop((n*128,0,(n+1)*128,128));after=b.crop((n*128,0,(n+1)*128,128))
 assert list(before.getbbox())==expected['original_bbox'] and list(after.getbbox())==expected['corrected_bbox']
 assert 128-after.getbbox()[2]>=8
 # The full body below the repaired nose region stays pixel-identical after translating 12px.
 diff=ImageChops.difference(before.crop((12,0,128,128)),after.crop((0,0,116,128)))
 changed=diff.convert('RGB').getbbox()
 assert changed is None or changed[0]>=114,'Unexpected change away from the nose'
 rows.append({'frame':n,'originalBBox':before.getbbox(),'correctedBBox':after.getbbox(),'rightMargin':128-after.getbbox()[2],'changedOverlapBBox':changed,'leftWorld':(after.getbbox()[0]-52)*52/128,'bodyPositionShiftWorld':0})
print(json.dumps({'sha256':qa['corrected_sha256'],'v12FlightDescriptorPreserved':True,'atlas':[1024,128],'worldSize':[52,52],'anchor':[52,64],'frames':rows},indent=2))
