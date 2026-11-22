// Bug reports from the chat (update_bug_reports.sql + community-v1/reports-triage-add.sql) on a disposable PostgreSQL.
// Runs with HAZE_SQL_DOCKER=<container> like haze-groups-sql.test.mjs; skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container=process.env.HAZE_SQL_DOCKER||'',q=x=>"'"+String(x).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const file=name=>readFileSync(new URL('../games/supabase/'+name,import.meta.url),'utf8');
test('bug reports: signed-in frens report, owner sees all, Haze triage sees Haze only, limits and notifications',{skip:!container},()=>{
  assert.match(container,/^haze-ph-qa-[a-z0-9-]+$/);const db='bug_reports_'+Date.now();
  const sql=(text,database=db)=>{try{return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(String(e.stderr));}};
  const as=(user,text)=>sql(`begin;set local role authenticated;${user?`set local request.jwt.claim.sub=${q(uid(user))};`:''}${text};commit;`).split('\n').at(-1);
  const rpc=(user,name,args='')=>{const out=as(user,`select to_jsonb(public.${name}(${args}))`);return out===''?null:JSON.parse(out);};
  sql('create database '+db,'postgres');
  try{
    sql(readFileSync(new URL('../scripts/haze-preview/bootstrap.sql',import.meta.url),'utf8').replace(/create role (\w+) nologin;/g,(_,role)=>`do $$begin create role ${role} nologin;exception when duplicate_object or unique_violation then null;end$$;`));
    // 1 owner (Byl), 2 Lew (Haze triage), 3 a fren, 4 a guest (no Discord)
    sql(`alter table auth.identities add column identity_data jsonb;alter table auth.identities add column provider_id text;
      create table games.owners(discord_id text primary key,note text);insert into games.owners values('d1','owner');
      create function games.is_owner(u uuid) returns boolean language sql stable security definer set search_path='' as $$select u is not null and exists(select 1 from auth.identities i join games.owners o on o.discord_id=i.provider_id where i.user_id=u and i.provider='discord')$$;
      create function games.client_ip_hash() returns text language sql stable as $$select 'net1'::text$$;
      create function games.norm(t text) returns text language sql as $$select lower(regexp_replace(t,'[^a-zA-Z0-9]','','g'))$$;
      create table games.push_outbox(id bigint generated always as identity,kind text,to_user uuid,not_user uuid,title text,body text,url text,tag text);
      create function games.push_enqueue(p_kind text,p_to uuid,p_not uuid,p_title text,p_body text,p_url text,p_tag text) returns boolean language sql security definer set search_path='' as $$insert into games.push_outbox(kind,to_user,not_user,title,body,url,tag) values(p_kind,p_to,p_not,p_title,p_body,p_url,p_tag) returning true$$;`);
    [['Byl','d1','byl'],['lewisbong','d2','lewisbong'],['Fren3','d3','fren3']].forEach(([nick,d,un],i)=>sql(`insert into auth.users values(${q(uid(i+1))});insert into games.profiles values(${q(uid(i+1))},${q(nick)});insert into auth.identities(user_id,provider,provider_id,identity_data) values(${q(uid(i+1))},'discord',${q(d)},'{"user_name":"${un}"}');`));
    sql(`insert into auth.users values(${q(uid(4))});insert into games.profiles values(${q(uid(4))},'Guesty');`);
    const install=file('update_bug_reports.sql');sql(install);sql(install);sql(file('community-v1/reports-triage-add.sql'));
    assert.throws(()=>rpc(0,'gry_report_bug',`'chat','The chat froze on my phone','',''`),/Sign in/);
    assert.throws(()=>rpc(3,'gry_report_bug',`'chat','short','',''`),/a bit more/);
    assert.throws(()=>rpc(3,'gry_report_bug',`'haze','here is my seed phrase: frog frog','',''`),/Never send seed/);
    const chat=rpc(3,'gry_report_bug',`'chat','Messages vanish after I send them','/meme/#lan','Android Chrome'`);
    const haze=rpc(4,'gry_report_bug',`'haze','Password field types backwards in Haze','/meme/#lan','Android Chrome'`);
    assert.ok(chat.id&&haze.id);
    assert.equal(sql(`select string_agg(p.nick||':'||o.title,'|' order by o.id) from games.push_outbox o join games.profiles p on p.user_id=o.to_user`),'Byl:🐞 Report · chat|Byl:🐞 Report · haze|lewisbong:🐞 Report · haze','Owner hears every report, Lew only Haze');
    assert.equal(rpc(1,'gry_reports_new'),2);assert.equal(rpc(2,'gry_reports_new'),1);assert.equal(rpc(3,'gry_reports_new'),null,'No inbox for frens');
    const lew=rpc(2,'gry_reports','true');assert.deepEqual(lew.reports.map(r=>r.area),['haze']);assert.equal(lew.reports[0].nick,'Guesty');assert.equal(lew.reports[0].verified,false);
    assert.throws(()=>rpc(3,'gry_reports','true'),/inbox team/);assert.throws(()=>rpc(2,'gry_report_set',`${chat.id},'fixed'`),/not found/,'Lew cannot touch chat reports');
    rpc(1,'gry_report_set',`${chat.id},'fixed'`);assert.equal(rpc(1,'gry_reports_new'),1);
    assert.deepEqual(rpc(1,'gry_reports','true').reports.map(r=>r.id),[haze.id],'Fixed reports leave the open list');assert.equal(rpc(1,'gry_reports','false').reports.length,2);
    assert.equal(rpc(1,'gry_reports','false').reports.find(r=>r.id===chat.id).handled_by,'Byl');
    rpc(3,'gry_report_bug',`'games','Second report from the same fren','',''`);rpc(3,'gry_report_bug',`'games','Third report from the same fren','',''`);
    assert.throws(()=>rpc(3,'gry_report_bug',`'games','Fourth report within ten minutes','',''`),/plenty/);
    for(const t of ['bug_reports','report_triage'])assert.throws(()=>as(3,`select * from games.${t}`));
  }finally{sql('drop database '+db+' with(force)','postgres');}
});
