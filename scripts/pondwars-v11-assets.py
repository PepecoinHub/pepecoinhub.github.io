"""Validate unmodified source PNGs and report visible size at the actual world scale."""
import hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'docs/games/art/arsenal-polish'
source=json.loads((ART/'v11/handoff/asset_validation.json').read_text())
manifest=json.loads((ART/'manifest.json').read_text())
rows=[]
for name,expected in source.items():
 kind='effects' if name in ['doge_blast','donkey_impact'] else 'sprites'
 path=ART/'v11'/kind/(name+'_atlas.png');blob=path.read_bytes();im=Image.open(path)
 assert hashlib.sha256(blob).hexdigest()==expected['sha256'],name
 fw,fh=expected['frame_px'];n=expected['frames']
 assert im.mode=='RGBA' and im.size==(fw*n,fh),name
 boxes=[im.crop((i*fw,0,(i+1)*fw,fh)).getbbox() for i in range(n)]
 assert boxes==[tuple(b) for b in expected['alpha_bbox_per_frame']],name
 px=im.load()
 assert all(px[x,y]==px[x+1,y]==px[x,y+1]==px[x+1,y+1] for y in range(0,im.height,2) for x in range(0,im.width,2)),name
 clips=[(w,r,c) for w,rs in manifest['weapons'].items() for r,c in rs.items() if c and c['src']==path.relative_to(ROOT/'docs/games').as_posix()]
 row={'file':path.name,'sha256':expected['sha256'],'atlas':im.size,'frame':[fw,fh],'frames':n,'edgeFrames':[i for i,b in enumerate(boxes) if b[0]==0 or b[1]==0 or b[2]==fw or b[3]==fh],'bbox':boxes,'pixelGrid2x2':True,'registered':bool(clips)}
 if clips:
  w,role,c=clips[0];row.update(weapon=w,role=role,worldSize=c['size'],visibleMaxWorld=[round(max(b[2]-b[0] for b in boxes)*c['size'][0]/fw,2),round(max(b[3]-b[1] for b in boxes)*c['size'][1]/fh,2)],anchor=c['anchor'])
 rows.append(row)
print(json.dumps({'originalPNGs':7,'runtimeRoles':sum(c is not None for roles in manifest['weapons'].values() for c in roles.values()),'rows':rows},indent=2))
