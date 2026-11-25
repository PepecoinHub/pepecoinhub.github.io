// PEP Drop for guests (update_guest_drops.sql), on a disposable PostgreSQL.
// Runs with HAZE_SQL_DOCKER=<container> like haze-groups-sql.test.mjs, or GDROP_SQL_LOCAL=1 with a local PostgreSQL
// reachable as the postgres user (su postgres). Skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const container=process.env.HAZE_SQL_DOCKER||'',local=process.env.GDROP_SQL_LOCAL==='1';
const q=x=>"'"+String(x).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function address(n){const data=Buffer.from([0x38,...Array(20).fill(n)]),hash=x=>createHash('sha256').update(x).digest(),bytes=Buffer.concat([data,hash(hash(data)).subarray(0,4)]);let value=BigInt('0x'+bytes.toString('hex')),text='';while(value){text='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(value%58n)]+text;value/=58n;}return text;}
const file=name=>readFileSync(new URL('../games/supabase/'+name,import.meta.url),'utf8');
test('PEP Drop: guests join with an address, the pool splits equally, one Haze payout, paid on confirmation',{skip:!container&&!local},()=>{
  const db='gdrop_'+Date.now();
  const run=(text,database)=>container
    ?execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']})
    :execFileSync('su',['postgres','-c',`psql -d ${database} -XAtq -v ON_ERROR_STOP=1`],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe'],cwd:'/tmp'});
  const sql=(text,database=db)=>{try{return run(text,database).trim();}catch(e){throw Error(String(e.stderr));}};
  // ip: the network the request comes from (games.client_ip_hash reads it, like the real one reads request headers)
  const as=(role,user,text,ip='net'+user)=>sql(`begin;set local role ${role};set local request.jwt.claim.sub=${q(user?uid(user):'')};set local test.ip=${q(ip)};${text};commit;`).split('\n').at(-1);
  const rpc=(user,name,args='',ip)=>JSON.parse(as(user?'authenticated':'anon',user,`select public.${name}(${args})`,ip));
  sql('create database '+db,'postgres');
  try{
    sql(readFileSync(new URL('../scripts/haze-preview/bootstrap.sql',import.meta.url),'utf8').replace(/create role (\w+) nologin;/g,(_,role)=>`do $$begin create role ${role} nologin;exception when duplicate_object or unique_violation then null;end$$;`));
    for(const name of ['update_haze_tips.sql','update_haze_groups.sql','update_haze_group_visibility.sql','update_haze_long_airdrops.sql'])sql(file(name));
    sql(`create table games.wp_claims(id bigint generated always as identity primary key,user_id uuid not null,address text not null);
      create function games.is_host_user(u uuid) returns boolean language sql stable set search_path='' as $$select u='${uid(1)}'::uuid$$;
      create function games.client_ip_hash() returns text language sql stable set search_path='' as $$select nullif(current_setting('test.ip',true),'')$$;`);
    const drops=file('update_guest_drops.sql');sql(drops);sql(drops);
    for(let n=1;n<=9;n++){sql(`insert into auth.users values(${q(uid(n))});`);if(n<=3)sql(`insert into games.profiles values(${q(uid(n))},'Fren${n}');insert into auth.identities values(${q(uid(n))},'discord');`);}
    sql(`insert into games.haze_links(user_id,address) values(${q(uid(1))},${q(address(1))});update games.haze_settings set enabled=true,beta_only=false,groups_enabled=true;`);
    for(const t of ['gdrop_settings','gdrops','gdrop_entries'])assert.throws(()=>as('authenticated',2,'select * from games.'+t));
    // off by default: nothing opens, anyone can read the state
    let st=rpc(0,'gry_gdrop_state');assert.equal(st.enabled,false);assert.equal(st.drop,null);assert.equal(st.signed_in,false);
    assert.throws(()=>rpc(2,'gry_gdrop_host'),/Only the host/);assert.throws(()=>rpc(2,'gry_gdrop_host_start','300,60'),/Only the host/);
    // a daily drop that started 10 minutes ago opens by itself on the first visit
    const hm=sql(`select to_char((now() at time zone 'Europe/Warsaw')-interval '10 minutes','HH24:MI')`);
    assert.equal(rpc(1,'gry_gdrop_host_settings',q(JSON.stringify({enabled:true,daily:true,daily_at:hm,pool:10,minutes:60,max_entries:200}))+'::jsonb').saved,true);
    st=rpc(0,'gry_gdrop_state');
    if(hm<'23:00'&&hm>'00:10'){ // skip the midnight edge
      assert.equal(st.drop.phase,'open');assert.equal(Number(st.drop.pool),10);assert.equal(st.drop.max,10,'At least 1 PEP each');assert.ok(st.next_at);
      rpc(0,'gry_gdrop_state');assert.equal(sql('select count(*) from games.gdrops'),'1','One daily drop per day');
      // joining: guests and frens, one per account / network / address; the host does not join
      assert.throws(()=>rpc(0,'gry_gdrop_join',q(address(4))),/Sign in/);
      assert.throws(()=>rpc(1,'gry_gdrop_join',q(address(5))),/host/);
      assert.throws(()=>rpc(4,'gry_gdrop_join',q('Pnope')),/not a PEP address/);
      assert.equal(rpc(4,'gry_gdrop_join',`${q(address(4))},'Kermit'`).joined,true);
      assert.throws(()=>rpc(4,'gry_gdrop_join',q(address(14))),/already in/);
      assert.throws(()=>rpc(5,'gry_gdrop_join',q(address(5)),'net4'),/network/);
      assert.throws(()=>rpc(5,'gry_gdrop_join',q(address(4))),/already in this drop/);
      assert.throws(()=>rpc(5,'gry_gdrop_join',q(address(1))),/host/);
      assert.throws(()=>rpc(5,'gry_gdrop_join',q(address(5)),''),/normal connection/);
      rpc(5,'gry_gdrop_join',q(address(5)));rpc(2,'gry_gdrop_join',q(address(2)));rpc(6,'gry_gdrop_join',q(address(6)));
      st=rpc(4,'gry_gdrop_state');assert.equal(st.drop.entries,4);assert.equal(st.drop.mine.address,address(4));
      assert.equal(rpc(5,'gry_gdrop_state').drop.mine.address,address(5));assert.equal(rpc(0,'gry_gdrop_state').drop.mine,null);
      assert.equal(sql(`select nick||verified from games.gdrop_entries where user_id=${q(uid(4))}`),'Kermitfalse');
      assert.equal(sql(`select nick||verified from games.gdrop_entries where user_id=${q(uid(2))}`),'Fren2true');
      const host=rpc(1,'gry_gdrop_host');const id=host.drops[0].id;assert.equal(host.drops[0].list.length,4);assert.equal(host.haze_linked,true);
      assert.throws(()=>rpc(1,'gry_gdrop_host_payout',String(id)),/still open/);
      assert.throws(()=>rpc(1,'gry_gdrop_host_start','50,30'),/already open/);
      // the host removes a rule breaker; the timer ends
      rpc(1,'gry_gdrop_host_remove',`${id},${q(uid(6))}::uuid`);
      sql(`update games.gdrops set opens_at=now()-interval '2 hours',closes_at=now()-interval '1 second' where id=${id};`);
      assert.throws(()=>rpc(7,'gry_gdrop_join',q(address(7))),/No PEP Drop is open/);
      st=rpc(0,'gry_gdrop_state');assert.equal(st.drop,null);assert.equal(st.last.phase,'waiting');assert.equal(st.last.entries,3);
      // payout: 10 PEP over 3 = 3.33333334 + 3.33333333 + 3.33333333, oldest first
      const made=rpc(1,'gry_gdrop_host_payout',String(id));assert.equal(made.addresses,3);
      const manifest=rpc(1,'gry_haze_group_review',q(made.id)+'::uuid');
      assert.deepEqual(manifest.recipients.map(r=>[r.address,r.amount]),[[address(4),'333333334'],[address(5),'333333333'],[address(2),'333333333']]);
      assert.equal(manifest.total_atomic,'1000000000');assert.equal(manifest.mode,'selected');
      assert.equal(rpc(0,'gry_gdrop_state').last.phase,'paying');
      assert.throws(()=>rpc(1,'gry_gdrop_host_payout',String(id)),/already waiting/);
      assert.throws(()=>rpc(1,'gry_gdrop_host_remove',`${id},${q(uid(5))}::uuid`),/before the payout/);
      // a cancelled Haze payout lets the host prepare it again
      rpc(1,'gry_haze_group_cancel',q(made.id)+'::uuid');assert.equal(rpc(0,'gry_gdrop_state').last.phase,'waiting');
      const again=rpc(1,'gry_gdrop_host_payout',String(id));
      const tx='ab'.repeat(32);sql(`update games.haze_groups set state='confirmed',txid='${tx}' where id=${q(again.id)};`);
      st=rpc(4,'gry_gdrop_state');assert.equal(st.last.phase,'paid');assert.equal(st.last.txid,tx);
      assert.throws(()=>rpc(1,'gry_gdrop_host_cancel',String(id)),/cannot be cancelled/);
      // an address used by another player in an earlier drop is refused for 30 days
      const two=rpc(1,'gry_gdrop_host_start',"5,10,'Test drop'").id;
      assert.throws(()=>rpc(7,'gry_gdrop_join',q(address(4))),/another player/);
      rpc(7,'gry_gdrop_join',q(address(7)));
      for(let n=8;n<=9;n++)rpc(n,'gry_gdrop_join',q(address(n)));
      // under 1 PEP each is refused: pool 5, max 5 entries, but shrink the pool to force it
      sql(`update games.gdrops set pool_pep=2,opens_at=now()-interval '1 hour',closes_at=now()-interval '1 second' where id=${two};`);
      assert.throws(()=>rpc(1,'gry_gdrop_host_payout',String(two)),/under 1 PEP/);
      // cancel works before payment; a drop with nobody in it has nothing to pay
      rpc(1,'gry_gdrop_host_cancel',String(two));assert.equal(sql(`select state from games.gdrops where id=${two}`),'cancelled');
      const three=rpc(1,'gry_gdrop_host_start','3,5').id;sql(`update games.gdrops set opens_at=now()-interval '1 hour',closes_at=now()-interval '1 second' where id=${three};`);
      assert.throws(()=>rpc(1,'gry_gdrop_host_payout',String(three)),/nothing to pay/);
      // a full drop refuses more people
      const four=rpc(1,'gry_gdrop_host_start','2,5').id;rpc(2,'gry_gdrop_join',q(address(2)));rpc(3,'gry_gdrop_join',q(address(3)));
      assert.throws(()=>rpc(5,'gry_gdrop_join',q(address(5))),/full/);
      assert.ok(four);
    }
    // settings guard
    assert.throws(()=>rpc(1,'gry_gdrop_host_settings',q(JSON.stringify({daily_at:'25:00',pool:10,minutes:60,max_entries:10}))+'::jsonb'));
  }finally{sql('drop database '+db+' with(force)','postgres');}
});
