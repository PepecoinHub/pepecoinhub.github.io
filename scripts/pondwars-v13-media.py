"""Export short full-resolution MP4 clips from the browser's real-time recordings."""
from pathlib import Path
import json,subprocess
OUT=Path('/tmp/frogageddon-v13');meta=json.loads((OUT/'recordings.json').read_text())
length={'doge':3.0,'donkey':3.8,'moon':3.0,'rain':3.3,'ban':2.2}
for r in meta:
 r['duration']=float(subprocess.check_output(['ffprobe','-v','quiet','-show_entries','format=duration','-of','csv=p=0',r['path']]))
 r['trimStart']=round(max(0,r['duration']-length[r['weapon']]),3);r['shortDuration']=length[r['weapon']];r['mp4']=str(OUT/(r['weapon']+'.mp4'))
 subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(r['trimStart']),'-i',r['path'],'-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',r['mp4']],check=True)
(OUT/'recordings.json').write_text(json.dumps(meta,indent=2)+'\n')
listing=OUT/'concat.txt';listing.write_text(''.join("file '"+r['mp4']+"'\n" for r in meta))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(OUT/'fx-v13-demo.mp4')],check=True)
