import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

test('generated press pages are staged with all other data before rebase', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pepecoin-prebake-'));
  const copy = file => { const target=path.join(dir,file); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(path.join(root,file),target); };
  const git = (...args) => execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  try {
    for (const file of ['scripts/prebake.mjs','docs/press.html','docs/pl/press.html','docs/sitemap.xml',
      'docs/data/network.json','docs/data/summary.json','docs/data/mining.json','docs/data/price.json','docs/data/market-prices.json']) copy(file);
    fs.mkdirSync(path.join(dir,'docs/data/snapshots'),{recursive:true});
    fs.writeFileSync(path.join(dir,'docs/data/snapshots/2026-10-30.json'),JSON.stringify({rows:[]}));
    git('init','-q'); git('-c','user.name=Test','-c','user.email=test@example.invalid','add','.');
    git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture');
    const file=path.join(dir,'docs/data/price.json'), price=JSON.parse(fs.readFileSync(file,'utf8'));
    price.price_usd=.0123; fs.writeFileSync(file,JSON.stringify(price));
    execFileSync(process.execPath,['scripts/prebake.mjs'],{cwd:dir,stdio:'pipe'});
    const changed=git('diff','--name-only');
    assert.match(changed,/docs\/press.html/); assert.match(changed,/docs\/pl\/press.html/);
    git('add','docs/data','docs/sitemap.xml',':(glob)docs/**/*.html');
    assert.equal(git('diff','--name-only','--','docs').trim(),'');
    git('diff','--exit-code','--','docs');
    const html=fs.readFileSync(path.join(dir,'docs/press.html'),'utf8');
    assert.match(html,/data-v="press-price">\$0\.0123/);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('pepecoin-prebake-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
