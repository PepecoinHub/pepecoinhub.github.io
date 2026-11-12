#!/usr/bin/env python3
"""Copy verified original v11 art into PR #281 and merge only the new clip descriptors.
Dry run by default. Explicit --apply required. Does not commit, push or deploy.
"""
import argparse, pathlib, hashlib, json, shutil, sys
p=argparse.ArgumentParser(); p.add_argument('--repo',required=True); p.add_argument('--assets',required=True); p.add_argument('--apply',action='store_true'); a=p.parse_args()
repo=pathlib.Path(a.repo).resolve(); assets=pathlib.Path(a.assets).resolve()
expected=repo/'docs/games/js/pondwars-weapon-art.mjs'
manifest=repo/'docs/games/art/arsenal-polish/manifest.json'
if not expected.is_file() or not manifest.is_file():sys.exit('This does not look like the PR #281 working tree (adapter/manifest missing).')
patch=json.loads((assets/'codex/manifest_patch.json').read_text(encoding='utf-8'))
source=assets/'docs/games/art/arsenal-polish/v11';dest=repo/'docs/games/art/arsenal-polish/v11'
if not source.is_dir():sys.exit(f'Asset folder not found: {source}')
files=list(source.rglob('*.png'))
if len(files)!=7:sys.exit(f'Expected seven PNG atlases, found {len(files)}')
for s in files:
 dst=dest/s.relative_to(source)
 if dst.exists() and hashlib.sha256(dst.read_bytes()).digest()!=hashlib.sha256(s.read_bytes()).digest():
  sys.exit(f'Refusing to overwrite changed file: {dst}')
obj=json.loads(manifest.read_text(encoding='utf-8'))
if not isinstance(obj.get('weapons'),dict):sys.exit('Missing weapons dictionary in art manifest')
for weapon,roles in patch.items():
 if weapon not in obj['weapons']:sys.exit(f'Unknown weapon in current manifest: {weapon}')
 for role,clip in roles.items():
  if role not in ('flight','activation','explosion') or not clip['src'].endswith('.png') or len(clip['frame'])!=2:sys.exit(f'Invalid patch {weapon}/{role}')
  obj['weapons'][weapon][role]=clip
obj['status']='Phase2 v11 art clips attached for QA; not production approved'
print(('APPLY' if a.apply else 'DRY RUN')+': '+str(len(files))+' atlases and '+str(sum(map(len,patch.values())))+' clip roles')
for s in files:print('  COPY',s.relative_to(source))
for w,roles in patch.items():print('  PATCH',w,','.join(roles))
if a.apply:
 for s in files:
  dst=dest/s.relative_to(source);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,dst)
 manifest.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Copied. Review git diff, run tests, do not merge/deploy.')
