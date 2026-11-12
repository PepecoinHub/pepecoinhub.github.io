import test from 'node:test';
import assert from 'node:assert/strict';
import * as beta from '../docs/games/js/pondwars-beta-engine.mjs';
import * as classic from '../docs/games/js/pondwars-engine.mjs';
import { preview, compare } from '../scripts/pondwars-trajectory-audit.mjs';

test('PR266 free-flight integration matches both engines for powers, aim directions and winds', () => {
  for (const e of [beta, classic]) for (const type of ['rocket','grenade','cluster','gold','revolver','bow','drill'])
    for (const power of [.08,.25,.55,1]) for (const wind of [-1,0,1]) for (const angle of [-2.7,-.78,-.15]) {
      const f={id:0,x:480,y:260}, g={mask:new Uint8Array(e.W*e.H),wind,frogs:[]};
      const r=compare(g,f,type,angle,power,e);
      assert.ok(r.sharedError<1e-7, JSON.stringify({type,power,wind,angle,r}));
    }
});
test('PR266 skips a thin wall that the beta grenade sweep bounces off', () => {
  const f={id:0,x:480,y:260}, g={mask:new Uint8Array(beta.W*beta.H),wind:0,frogs:[]};
  for(let y=0;y<beta.H;y++)g.mask[y*beta.W+505]=1;
  const r=compare(g,f,'grenade',0,1);
  assert.ok(r.sharedError>100); assert.equal(r.actualStop,'splash'); assert.ok(r.actualSteps > 60);
});
test('preview ignores a frog in the real projectile path at short, medium and long distances', () => {
  for(const distance of [40,200,600]) {
    const f={id:0,x:200,y:300,alive:true};
    const g={mask:new Uint8Array(beta.W*beta.H),wind:0,frogs:[f,{id:1,x:200+distance,y:300,alive:true}]};
    const r=compare(g,f,'revolver',0,.25);
    assert.equal(r.actualStop,'boom'); assert.ok(r.actualSteps<r.previewSteps); assert.ok(r.endpointError>300);
  }
});
test('audit uses a private terrain copy even when the drill bores through a wall', () => {
  const f={id:0,x:480,y:260},g={mask:new Uint8Array(beta.W*beta.H),wind:0,frogs:[],dirty:[]};
  for(let y=0;y<beta.H;y++)for(let x=510;x<700;x++)g.mask[y*beta.W+x]=1;
  const before=g.mask.slice(); const r=compare(g,f,'drill',0,1);
  assert.equal(preview(g,f,'drill',0,1).reason,'terrain'); assert.equal(r.actualStop,'boom');
  assert.deepEqual(g.mask,before);assert.deepEqual(g.dirty,[]);assert.ok(r.endpointError>100);
});
