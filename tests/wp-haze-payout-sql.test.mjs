// Pepe Guesser weekly payout through Haze (update_wheres_pepe_haze_payout.sql), on a disposable PostgreSQL.
// Runs with HAZE_SQL_DOCKER=<container> like haze-groups-sql.test.mjs; skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const container=process.env.HAZE_SQL_DOCKER||'',q=x=>"'"+String(x).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function address(n){const data=Buffer.from([0x38,...Array(20).fill(n)]),hash=x=>createHash('sha256').update(x).digest(),bytes=Buffer.concat([data,hash(hash(data)).subarray(0,4)]);let value=BigInt('0x'+bytes.toString('hex')),text='';while(value){text='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(value%58n)]+text;value/=58n;}return text;}
const file=name=>readFileSync(new URL('../games/supabase/'+name,import.meta.url),'utf8');
test('Pepe Guesser: a finished week becomes one fixed Haze payout and is marked paid on confirmation',{skip:!container},()=>{
  assert.match(container,/^haze-ph-qa-[a-z0-9-]+$/);const db='wp_haze_'+Date.now();
  const sql=(text,database=db)=>{try{return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(String(e.stderr));}};
  const as=(role,user,text)=>sql(`begin;set local role ${role};set local request.jwt.claim.sub=${q(uid(user))};${text};commit;`).split('\n').at(-1);
  const rpc=(user,name,args='')=>JSON.parse(as('authenticated',user,`select public.${name}(${args})`));
  sql('create database '+db,'postgres');
  try{
    sql(readFileSync(new URL('../scripts/haze-preview/bootstrap.sql',import.meta.url),'utf8').replace(/create role (\w+) nologin;/g,(_,role)=>`do $$begin create role ${role} nologin;exception when duplicate_object or unique_violation then null;end$$;`));
    for(const name of ['update_haze_tips.sql','update_haze_groups.sql','update_haze_group_visibility.sql','update_haze_long_airdrops.sql'])sql(file(name));
    // the Pepe Guesser pieces this file relies on (their real definitions live in update_wheres_pepe*.sql)
    sql(`create table games.wp_claims(id bigint generated always as identity primary key,user_id uuid not null,nick text not null,address text not null,pep numeric(14,2) not null check(pep>0),
      status text not null default 'open' check(status in ('open','held','paid')),txid text,created_at timestamptz not null default now(),paid_at timestamptz);
      create function games.wp_week_start() returns timestamptz language sql stable set search_path='' as $$select date_trunc('week',now() at time zone 'utc') at time zone 'utc'$$;
      create function games.is_host_user(u uuid) returns boolean language sql stable set search_path='' as $$select u='${uid(1)}'::uuid$$;`);
    const pay=file('update_wheres_pepe_haze_payout.sql');sql(pay);sql(pay);
    for(let n=1;n<=6;n++){sql(`insert into auth.users values(${q(uid(n))});insert into games.profiles values(${q(uid(n))},'Fren${n}');insert into auth.identities values(${q(uid(n))},'discord');`);}
    sql(`insert into games.haze_links(user_id,address) values(${q(uid(1))},${q(address(1))});update games.haze_settings set enabled=true,beta_only=false,groups_enabled=true;`);
    const claim=(user,pep,days,status='open',addr=address(user))=>sql(`insert into games.wp_claims(user_id,nick,address,pep,status,created_at) values(${q(uid(user))},'Fren${user}',${q(addr)},${pep},'${status}',games.wp_week_start()-interval '${days} days') returning id`);
    const last=[claim(2,30,3),claim(2,20.5,2),claim(3,100,6),claim(4,7,1,'held')],now=claim(5,40,-1),host=claim(1,10,2);
    const ids=[...last,now,host].map(Number);const arr=`array[${ids.join(',')}]::bigint[]`;
    assert.throws(()=>rpc(2,'gry_wp_host_haze_payout',arr),/Only the host/);
    const made=rpc(1,'gry_wp_host_haze_payout',arr);
    assert.equal(made.addresses,2,'Only open rewards of finished weeks; not held, not this week, not the host');assert.equal(Number(made.pep),150.5);assert.equal(made.claims,3);
    const manifest=rpc(1,'gry_haze_group_review',q(made.id)+'::uuid');
    assert.deepEqual(manifest.recipients.map(r=>[r.nick,r.address,r.amount]),[['Fren3',address(3),'10000000000'],['Fren2',address(2),'5050000000']],'One line per address, summed, oldest first');
    assert.equal(manifest.total_atomic,'15050000000');assert.equal(manifest.mode,'selected');assert.match(manifest.title,/^Pepe Guesser rewards · week of /);
    assert.ok(Date.parse(manifest.expires_at)-Date.now()<=31*60000,'Each review stays within Haze\'s window');
    assert.throws(()=>rpc(1,'gry_wp_host_haze_payout',arr),/already waiting/,'No second payout for the same rewards');
    // confirmation marks exactly those rewards as paid, with the transaction id
    const tx='ab'.repeat(32);sql(`update games.haze_groups set state='confirmed',txid='${tx}' where id=${q(made.id)};`);
    assert.equal(sql(`select string_agg(status||':'||coalesce(txid,''),',' order by id) from games.wp_claims`),[`paid:${tx}`,`paid:${tx}`,`paid:${tx}`,'held:','open:','open:'].join(','));
    // guards: under 1 PEP per address, one player with two addresses
    const tiny=Number(claim(6,0.5,2));assert.throws(()=>rpc(1,'gry_wp_host_haze_payout',`array[${tiny}]::bigint[]`),/at least 1 PEP/);
    const a=Number(claim(4,5,2)),b=Number(claim(4,5,3,'open',address(9)));assert.throws(()=>rpc(1,'gry_wp_host_haze_payout',`array[${a},${b}]::bigint[]`),/two addresses/);
    // a cancelled payout frees its rewards for a new one
    const second=rpc(1,'gry_wp_host_haze_payout',`array[${a}]::bigint[]`);rpc(1,'gry_haze_group_cancel',q(second.id)+'::uuid');
    const third=rpc(1,'gry_wp_host_haze_payout',`array[${a}]::bigint[]`);assert.equal(third.addresses,1);rpc(1,'gry_haze_group_cancel',q(third.id)+'::uuid');
    // the host confirms a player with two addresses: everything goes to that player's newest address
    assert.throws(()=>rpc(1,'gry_wp_host_haze_payout',`array[${a},${b}]::bigint[]`),/TWO_ADDRESSES.*Fren4/);
    const merged=rpc(1,'gry_wp_host_haze_payout',`array[${a},${b}]::bigint[],true`);assert.equal(merged.addresses,1);assert.equal(Number(merged.pep),10);
    assert.deepEqual(rpc(1,'gry_haze_group_review',q(merged.id)+'::uuid').recipients.map(r=>[r.address,r.amount]),[[address(4),'1000000000']],'Newest address, both rewards');
    assert.throws(()=>as('authenticated',1,'select * from games.wp_haze_payouts'));
  }finally{sql('drop database '+db+' with(force)','postgres');}
});
