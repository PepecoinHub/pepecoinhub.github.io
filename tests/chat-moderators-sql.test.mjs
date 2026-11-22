// Chat moderators (update_chat_moderators.sql + community-v1/chat-mods-add.sql) on a disposable PostgreSQL.
// Runs with HAZE_SQL_DOCKER=<container> like haze-groups-sql.test.mjs; skipped otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container=process.env.HAZE_SQL_DOCKER||'',q=x=>"'"+String(x).replaceAll("'","''")+"'",uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const file=name=>readFileSync(new URL('../games/supabase/'+name,import.meta.url),'utf8');
const pick=(name,fn)=>{const text=file(name),start=text.indexOf('create or replace function public.'+fn+'('),end=text.indexOf('end $$;',start);if(start<0||end<0)throw Error('missing '+fn);return text.slice(start,end+7);};
test('chat moderators delete and mute within limits, cannot touch hosts or each other, and are logged',{skip:!container},()=>{
  assert.match(container,/^haze-ph-qa-[a-z0-9-]+$/);const db='chat_mods_'+Date.now();
  const sql=(text,database=db)=>{try{return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XAtq','-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(String(e.stderr));}};
  const as=(user,text)=>sql(`begin;set local role authenticated;set local request.jwt.claim.sub=${q(uid(user))};${text};commit;`).split('\n').at(-1);
  sql('create database '+db,'postgres');
  try{
    sql(readFileSync(new URL('../scripts/haze-preview/bootstrap.sql',import.meta.url),'utf8').replace(/create role (\w+) nologin;/g,(_,role)=>`do $$begin create role ${role} nologin;exception when duplicate_object or unique_violation then null;end$$;`));
    // host 1, moderator 2 (Lemon), players 3 and 4, second moderator 5
    sql(`alter table games.lobby_chat add column ip_hash text;alter table games.lobby_chat add column broadcast boolean not null default false;alter table games.lobby_mutes add column reason text;
      create table games.lobby_ip_mutes(ip_hash text primary key,until timestamptz,reason text);
      create function games.client_ip_hash() returns text language sql stable as $$select null::text$$;
      create function games.lobby_cleanup() returns void language sql as $$select$$;
      create function games.is_host_user(u uuid) returns boolean language sql stable as $$select u='${uid(1)}'::uuid$$;
      alter table auth.identities add column identity_data jsonb;`);
    for(const fn of ['gry_lobby_hide'])sql(pick('schema.sql',fn));sql(pick('update_open_chat.sql','gry_lobby_mute_msg'));sql(pick('update_lobby_everyone.sql','gry_lobby_chat'));
    const install=file('update_chat_moderators.sql');sql(install);sql(install);
    const nicks=['Byl','Lemon','Fren3','Fren4','Naux'];
    nicks.forEach((nick,i)=>sql(`insert into auth.users values(${q(uid(i+1))});insert into games.profiles values(${q(uid(i+1))},${q(nick)});insert into auth.identities(user_id,provider,identity_data) values(${q(uid(i+1))},'discord','{"user_name":"${nick.toLowerCase()}_dc"}');`));
    const add=names=>file('community-v1/chat-mods-add.sql').replace("array['Lemon']",'array['+names.map(q).join(',')+']');
    assert.throws(()=>sql(add(['Lemon','nobody'])),/matches 0/);assert.equal(sql('select count(*) from games.chat_mods'),'0','All names or nothing');
    sql(add(['lemon','naux_dc']));assert.equal(sql('select count(*) from games.chat_mods'),'2','Site nick or Discord name, any case');
    const say=(user,body)=>sql(`insert into games.lobby_chat(user_id,nick,body,verified) values(${q(uid(user))},${q(nicks[user-1])},${q(body)},true) returning id`);
    const feed=user=>JSON.parse(as(user,`select public.gry_lobby_chat(0,null)`));
    assert.equal(feed(2).can_mod,true);assert.equal(feed(1).can_mod,true);assert.equal(feed(3).can_mod,false);
    const spam=say(3,'spam spam'),hostMsg=say(1,'gm from the host'),modMsg=say(5,'gm from Naux');
    assert.throws(()=>as(3,`select public.gry_lobby_hide(${spam})`),/Only hosts and chat moderators/);
    as(2,`select public.gry_lobby_hide(${spam})`);assert.equal(sql(`select hidden_at is not null from games.lobby_chat where id=${spam}`),'t');
    assert.throws(()=>as(2,`select public.gry_lobby_hide(${hostMsg})`),/cannot delete/);assert.throws(()=>as(2,`select public.gry_lobby_hide(${modMsg})`),/cannot delete/);
    assert.throws(()=>as(2,`select public.gry_lobby_mute_msg(${hostMsg},24)`),/cannot mute/);assert.throws(()=>as(2,`select public.gry_lobby_mute_msg(${modMsg},24)`),/cannot mute/);
    const rude=say(4,'rude');as(2,`select public.gry_lobby_mute_msg(${rude},720)`);
    const hours=Number(sql(`select round(extract(epoch from until-now())/3600) from games.lobby_mutes where user_id=${q(uid(4))}`));assert.equal(hours,72,'Moderator mutes are capped at 72 h');
    as(1,`select public.gry_lobby_mute_msg(${modMsg},24)`);assert.equal(sql(`select reason from games.lobby_mutes where user_id=${q(uid(5))}`),'host','Hosts keep full powers');
    assert.equal(sql(`select string_agg(mod_nick||' '||action||' '||target_nick,'|' order by id) from games.mod_log`),'Lemon delete Fren3|Lemon mute 72 h Fren4','Moderator actions are logged; host actions are not');
    for(const t of ['chat_mods','mod_log'])assert.throws(()=>as(2,`select * from games.${t}`));
    sql(file('community-v1/chat-mods-remove.sql'));assert.equal(feed(2).can_mod,false,'Removing ends the powers');
  }finally{sql('drop database '+db+' with(force)','postgres');}
});
