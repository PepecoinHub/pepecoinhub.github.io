import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const container=process.env.HAZE_SQL_DOCKER||'',q=x=>"'"+String(x).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function address(n){const data=Buffer.from([0x38,...Array(20).fill(n)]),hash=x=>createHash('sha256').update(x).digest(),bytes=Buffer.concat([data,hash(hash(data)).subarray(0,4)]);let value=BigInt('0x'+bytes.toString('hex')),text='';while(value){text='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Number(value%58n)]+text;value/=58n;}return text;}
test('group SQL: all audiences, exact splits, frozen recipients, timed chat rounds, permissions and global credit-once',{skip:!container},()=>{
  assert.match(container,/^haze-ph-qa-[a-z0-9-]+$/);const db='haze_groups_'+Date.now();
  const sql=(text,database=db)=>{try{return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(String(e.stderr));}};
  const as=(role,user,text)=>sql(`begin;set local role ${role};set local request.jwt.claim.sub=${q(uid(user))};${text};commit;`).split('\n').at(-1);
  const rpc=(user,name,args='')=>JSON.parse(as('authenticated',user,`select public.${name}(${args})`));
  const service=(name,args)=>JSON.parse(as('service_role',1,`select public.${name}(${args})`));
  sql('create database '+db,'postgres');
  try{
    let bootstrap=readFileSync(new URL('../scripts/haze-preview/bootstrap.sql',import.meta.url),'utf8').replace(/create role (\w+) nologin;/g,(_,role)=>`do $$begin create role ${role} nologin;exception when duplicate_object or unique_violation then null;end$$;`);
    sql(bootstrap);const base=readFileSync(new URL('../games/supabase/update_haze_tips.sql',import.meta.url),'utf8'),groups=readFileSync(new URL('../games/supabase/update_haze_groups.sql',import.meta.url),'utf8');sql(base);sql(groups);sql(base);sql(groups);const visibility=readFileSync(new URL('../games/supabase/update_haze_group_visibility.sql',import.meta.url),'utf8');sql(visibility);sql(visibility);const long=readFileSync(new URL('../games/supabase/update_haze_long_airdrops.sql',import.meta.url),'utf8');sql(long);sql(long);
    for(let n=1;n<=8;n++){sql(`insert into auth.users values(${q(uid(n))});insert into games.profiles values(${q(uid(n))},'Fren${n}');`);if(n!==8)sql(`insert into auth.identities values(${q(uid(n))},'discord');`);if(n!==3)sql(`insert into games.haze_links(user_id,address)values(${q(uid(n))},${q(address(n))});`);}
    sql(`update games.haze_settings set enabled=true,beta_only=false;`);assert.throws(()=>rpc(1,'gry_haze_groups'),'Community flag is independent from direct tips');
    sql(`update games.haze_settings set groups_enabled=true;insert into games.lobby_seen values('two',${q(uid(2))},clock_timestamp()),('four',${q(uid(4))},clock_timestamp());insert into games.lobby_mutes values(${q(uid(7))},clock_timestamp()+interval '1 hour');`);
    const hub=rpc(1,'gry_haze_groups');assert.deepEqual(hub.members.map(x=>x.id).sort(),[2,4,5,6].map(uid));assert.equal(JSON.stringify(hub).includes(address(2)),false);
    for(const table of ['haze_groups','haze_group_entries','haze_group_recipients','haze_group_eligible','haze_transactions'])assert.throws(()=>as('authenticated',1,'select * from games.'+table));
    assert.throws(()=>as('anon',1,'select public.gry_haze_groups()'));assert.throws(()=>as('authenticated',1,`select games.haze_group_manifest(gen_random_uuid())`));
    const rewind=()=>sql(`update games.haze_groups set created_at=clock_timestamp()-interval '11 seconds' where owner=${q(uid(1))} and created_at>clock_timestamp()-interval '11 seconds';`);
    const create=(options,user=1)=>{rewind();return rpc(user,'gry_haze_group_create',q(JSON.stringify({mode:'all',audience:'all',total_atomic:'1000000000',...options}))+'::jsonb');};
    const review=id=>rpc(1,'gry_haze_group_review',q(id)+'::uuid');
    const all=create({total_atomic:'400000003',audience:'offline'}),manifest=review(all.id);assert.equal(manifest.recipients.length,4,'Whole pond ignores stale hidden audience controls');assert.equal(manifest.recipients.reduce((sum,r)=>sum+BigInt(r.amount),0n),400000003n);
    assert.deepEqual(manifest.recipients.map(r=>r.amount),['100000001','100000001','100000001','100000000']);
    sql(`update games.haze_links set address=${q(address(15))} where user_id=${q(uid(5))};`);assert.equal(review(all.id).recipients.find(r=>r.nick==='Fren5').address,address(5),'Payout addresses remain frozen');
    assert.deepEqual(review(create({mode:'online'}).id).recipients.map(r=>r.nick),['Fren2','Fren4']);
    assert.deepEqual(review(create({mode:'offline'}).id).recipients.map(r=>r.nick),['Fren5','Fren6']);
    const random=review(create({mode:'random',count:2}).id);assert.equal(random.recipients.length,2);assert.equal(new Set(random.recipients.map(r=>r.address)).size,2);
    const chosen=create({mode:'selected',selected:[uid(2),uid(5)]});assert.equal(review(chosen.id).recipients.length,2);
    for(const options of [{mode:'selected',selected:[uid(3)]},{mode:'selected',selected:[uid(2),uid(2)]},{mode:'selected',selected:[uid(1)]},{mode:'random',count:200},{mode:'all',total_atomic:'100000000'},{mode:'all',addresses:[address(2)]}])assert.throws(()=>create(options));
    assert.throws(()=>rpc(2,'gry_haze_group_review',q(chosen.id)+'::uuid'));
    assert.throws(()=>as('authenticated',1,`select public.haze_group_context(${q(uid(1))},${q(chosen.id)},${q('ab'.repeat(32))})`));
    const air=create({mode:'airdrop',audience:'offline',seconds:10,total_atomic:'400000000'});
    sql(`insert into games.lobby_seen values('five',${q(uid(5))},clock_timestamp());`);
    assert.equal(rpc(5,'gry_haze_group_join',q(air.id)+'::uuid').joined,true,'Eligibility is snapshotted before an offline fren comes online');
    assert.equal(rpc(5,'gry_haze_group_join',q(air.id)+'::uuid').joined,true);assert.throws(()=>rpc(3,'gry_haze_group_join',q(air.id)+'::uuid'));
    rpc(6,'gry_haze_group_join',q(air.id)+'::uuid');const airManifest=review(air.id);assert.equal(airManifest.recipients.length,2);assert.equal(sql(`select count(*) from games.haze_group_entries where group_id=${q(air.id)}`),'2');
    const question=create({mode:'trivia',title:'What is the native ticker?',answer:'PEP',seconds:10,winners:1});
    const say=(user,text)=>sql(`insert into games.lobby_chat(user_id,nick,body,verified)values(${q(uid(user))},'Fren${user}',${q(text)},true);`);
    say(2,'/answer nope');say(2,'/answer PEP');assert.equal(sql(`select count(*) from games.haze_group_entries where group_id=${q(question.id)} and qualified`),'0','Only one trivia attempt per person');
    say(4,'/answer  pep  ');assert.equal(review(question.id).recipients[0].nick,'Fren4');
    const word=create({mode:'word',answer:'gm',seconds:10,winners:2,total_atomic:'500000000'});say(5,'GM');say(5,'gm');say(6,' gm ');const wordManifest=review(word.id);assert.equal(wordManifest.recipients.length,2);assert.deepEqual(wordManifest.recipients.map(r=>r.amount),['250000000','250000000']);
    const empty=create({mode:'airdrop',seconds:10});sql(`update games.haze_groups set closes_at=clock_timestamp()-interval '1 second' where id=${q(empty.id)};`);rpc(1,'gry_haze_groups');assert.equal(sql(`select state from games.haze_groups where id=${q(empty.id)}`),'empty');assert.throws(()=>review(empty.id));
    const publicFeed=rpc(2,'gry_haze_groups');assert.ok(publicFeed.drops.find(d=>d.id===empty.id).ended_at,'Empty rounds have a server completion time');for(const secret of ['answer_hash','answer_salt',address(2),address(4)])assert.equal(JSON.stringify(publicFeed).includes(secret),false);
    const hash='ab'.repeat(32),other='bc'.repeat(32),block='cd'.repeat(32),time=Math.floor(Date.now()/1000);
    sql(`insert into games.lobby_chat(user_id,nick,body,verified)values(${q(uid(2))},'Fren2','hello',true);`);
    const single=rpc(1,'gry_haze_tip_begin',`${sql('select max(id) from games.lobby_chat')},'100000000','heart',''`);
    service('haze_tip_confirm',`${q(uid(1))},${q(single.id)},${q(hash)},0,${q(block)},${time}`);
    assert.throws(()=>service('haze_group_confirm',`${q(uid(1))},${q(chosen.id)},${q(hash)},${q(block)},${time}`),'Single/group transaction replay is globally rejected');
    service('haze_group_context',`${q(uid(1))},${q(chosen.id)},${q(other)}`);assert.equal(sql(`select txid is null from games.haze_groups where id=${q(chosen.id)}`),'t');
    assert.throws(()=>rpc(1,'gry_haze_group_cancel',q(chosen.id)+'::uuid'));
    const commit=`${q(uid(1))},${q(chosen.id)},${q(other)},${q(block)},${time}`;service('haze_group_confirm',commit);service('haze_group_confirm',commit);
    assert.equal(rpc(1,'gry_haze_groups').drops.find(d=>d.id===chosen.id).submitted_txid,null,'Confirmed payouts no longer advertise a recovery candidate');
    assert.ok(rpc(2,'gry_haze_groups').drops.find(d=>d.id===chosen.id).ended_at,'Recipients receive confirmation time');
    sql(`update games.haze_groups set expires_at=clock_timestamp()-interval '1 hour' where id=${q(all.id)};`);assert.ok(rpc(2,'gry_haze_groups').drops.find(d=>d.id===all.id).ended_at,'Unsigned expiry is terminal');
    assert.equal(sql("select count(*) from games.haze_transactions"),'2');assert.equal(sql("select count(*) from games.passport_badges where badge_id='haze_first_tip'"),'1');assert.equal(sql("select count(*) from realtime.test_rings where event='tip'"),'2');
    // long airdrops (update_haze_long_airdrops.sql): 10 s to 600 min; trivia and word rounds stay at 300 s
    assert.throws(()=>create({mode:'airdrop',seconds:36001}));assert.throws(()=>create({mode:'trivia',title:'Long question?',answer:'x',seconds:600,winners:1}));
    const longDrop=create({mode:'airdrop',seconds:36000,total_atomic:'500000000'});
    assert.ok(Math.abs(Number(sql(`select extract(epoch from closes_at-created_at) from games.haze_groups where id=${q(longDrop.id)}`))-36000)<2,'600 minutes');
    rpc(2,'gry_haze_group_join',q(longDrop.id)+'::uuid');sql(`update games.haze_groups set closes_at=clock_timestamp()-interval '1 second',created_at=clock_timestamp()-interval '10 hours' where id=${q(longDrop.id)};`);rpc(1,'gry_haze_groups');
    assert.equal(sql(`select state||' '||(expires_at>clock_timestamp()+interval '11 hours') from games.haze_groups where id=${q(longDrop.id)}`),'ready true','The host gets 12 hours to review a long airdrop');
    assert.equal(sql(`select expires_at<clock_timestamp()+interval '31 minutes' from games.haze_groups where id=${q(word.id)}`),'t','Short rounds keep the 30-minute review');
    assert.equal(rpc(2,'gry_haze_groups').drops.find(d=>d.id===longDrop.id).won,'500000000','A recipient sees their own payout');
    assert.equal(rpc(4,'gry_haze_groups').drops.find(d=>d.id===longDrop.id).won,null,'Other frens see no payout');
    // guests: a read-only public feed, no owner IDs, addresses or answers
    const guestFeed=JSON.parse(as('anon',9,'select public.gry_haze_groups_public()'));assert.ok(guestFeed.drops.some(d=>d.id===longDrop.id));
    for(const secret of ['owner','won','joined','eligible','submitted_txid','answer_hash',uid(1),address(2)])assert.equal(JSON.stringify(guestFeed).includes(secret),false,secret);
    sql('update games.haze_settings set enabled=false;');assert.throws(()=>create({mode:'all'}));
  }finally{sql('drop database '+db+' with(force)','postgres');}
});
