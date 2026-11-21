import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {sourcesHash} from '../scripts/bundle-haze-community.mjs';
test('haze-community dashboard bundle and phone parts match the current sources',()=>{
  const bundle=fs.readFileSync(new URL('../games/supabase/haze-beta/haze-wallet-dashboard.ts'.replace('wallet','community'),import.meta.url),'utf8');
  assert.match(bundle,new RegExp('// sources-sha256: '+sourcesHash()+'\\n'),'stale: run node scripts/bundle-haze-community.mjs');
  const dir=new URL('../games/supabase/haze-beta/phone/',import.meta.url),parts=fs.readdirSync(dir).filter(f=>/^community-\d+\.txt$/.test(f)).sort();
  const joined=parts.map(f=>fs.readFileSync(new URL(f,dir),'utf8')).join('').split('\n').filter(l=>!l.startsWith('// ==== END OF PART')).join('\n');
  assert.equal(joined,bundle+'\n');assert.match(bundle,/from "npm:@noble\/curves@2\.4\.0\/secp256k1\.js"/);assert.doesNotMatch(bundle,/from "\.\.?\//);
});
