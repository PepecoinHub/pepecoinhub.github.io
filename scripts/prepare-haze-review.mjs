// Builds a separate review candidate. Never overwrites Haze runtime sources.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(!process.argv[2])throw Error('Usage: node scripts/prepare-haze-review.mjs /path/to/matching-haze-runtime [candidate-directory-within-runtime]');
const root=fs.realpathSync(process.argv[2]),candidate=path.resolve(process.argv[3]||path.join(root,'outputs/pepecoinhub-pr-review'));
const relative=path.relative(root,candidate);
if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('The separate candidate directory must be inside the named Haze runtime.');
if(fs.existsSync(candidate))throw Error('Candidate directory already exists. Choose a new output directory; nothing was overwritten.');
const bundle=fileURLToPath(new URL('../games/haze-review/2026-11-15/',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'manifest.json'),'utf8'));
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const baseline=new Map(),dependencies=new Map();
const originals=manifest.files.filter(f=>f.baselineSHA256),matches=field=>originals.every(f=>sha(read(path.join(root,f.path)))===f[field]);
const alreadyUpdated=matches('candidateSHA256');if(!alreadyUpdated&&!matches('baselineSHA256'))throw Error('Haze runtime matches neither the recorded baseline nor the complete tipping candidate. Do not force-apply.');
for(const file of manifest.files){
  if(file.baselineSHA256||(alreadyUpdated&&file.candidateSHA256)){const body=read(path.join(root,file.path));if(sha(body)!==(alreadyUpdated?file.candidateSHA256:file.baselineSHA256))throw Error('Haze runtime does not match '+file.path+'. Obtain the matching reviewed runtime.');baseline.set(file.path,body);}
  if(file.dependencySHA256){const body=read(path.join(bundle,'files',file.path));if(sha(body)!==file.dependencySHA256)throw Error('Review dependency hash mismatch: '+file.path);dependencies.set(file.path,body);}
}
// All source and dependency hashes are checked before creating any files.
const write=(name,body)=>{const file=path.join(candidate,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
fs.mkdirSync(candidate,{recursive:true});for(const [name,body]of baseline)write(name,body);
const patch=path.join(bundle,'haze-wallet-tipping.patch'),prefix=relative.replaceAll('\\','/');
if(!alreadyUpdated)for(const args of [['--check'],[]])execFileSync('git',['-c','core.autocrlf=false','apply',...args,'--directory='+prefix,patch],{cwd:root,stdio:'pipe'});
for(const [name,body]of dependencies)write(name,body);
for(const file of manifest.files)if(sha(read(path.join(candidate,file.path)))!==(file.candidateSHA256||file.dependencySHA256))throw Error('Candidate validation failed: '+file.path);
console.log(JSON.stringify({candidate,HAZE_WALLET_ROOT:root,HAZE_TIP_CANDIDATE:candidate,productionChanged:false},null,2));
