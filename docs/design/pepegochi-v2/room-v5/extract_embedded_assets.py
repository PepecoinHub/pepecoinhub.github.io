"""Recover exact candidate PNGs from the self-contained GitHub HTML.

Requires Python standard library only. No network, no cloud dependency.
"""
from pathlib import Path
import json,re,base64
root=Path(__file__).resolve().parent
html=(root/'room_v5_standalone.html').read_text(encoding='utf8')
m=re.search(r'const imageData=(\{[^\n]*\});',html)
if not m:raise ValueError('Missing embedded imageData manifest')
assets=json.loads(m.group(1));output=root/'assets';output.mkdir(exist_ok=True)
for name,data_url in assets.items():
    prefix='data:image/png;base64,'
    if not data_url.startswith(prefix):raise ValueError(f'Invalid asset {name}')
    (output/(name+'.png')).write_bytes(base64.b64decode(data_url[len(prefix):],validate=True))
print(f'Extracted {len(assets)} exact PNGs into {output}')