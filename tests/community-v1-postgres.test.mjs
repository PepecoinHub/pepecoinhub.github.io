import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createCommunityHandler} from '../games/supabase/functions/haze-community/handler.mjs';
import {challenge,hash,secret} from '../games/supabase/functions/haze-community/contract.mjs';
import {chatFixture} from './fixtures/community-chat-fixture.mjs';
const source=path.resolve(process.env.PH_COMMUNITY_SOURCE||path.join(path.dirname(fileURLToPath(import.meta.url)),'..')),task=source;
const container='haze-community-scoped-unit-20261120',run=promisify(execFile),PH='https://pepecoinhub.com',HZ='https://hazewallet.com',redirect=HZ+'/community-auth.html',uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scopes=['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write'],quote=v=>"'"+String(v).replaceAll("'","''")+"'";
let owned=false,initial,authCalls=0,handler;
const psql=sql=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-XAtq','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
// Like production: every wrapped call reaches PostgREST from PH's one Edge egress IP (shared by all Haze users).
const EDGE_HEADERS=`set local "request.headers" to '{"cf-connecting-ip":"203.0.113.9"}';`;
const callSQL=(name,args,role='service_role')=>`begin;${EDGE_HEADERS}set local role ${role};select to_jsonb(public.${name}(${quote(JSON.stringify(args))}::jsonb));commit;`;
const rpc=async(name,args)=>JSON.parse(psql(callSQL(name,args)));
async function request(body,{origin=HZ,token}={}){
 const res=await handler(new Request('https://azbwciqfbsdpwubznncg.supabase.co/functions/v1/haze-community',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({version:1,...body})}));return {status:res.status,body:await res.json()};
}
async function code({user=1,permissions=scopes,verifier='v'.repeat(43)}={}){
 const result=await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:await challenge(verifier),code_challenge_method:'S256',scopes:permissions},{origin:PH,token:'fixture.PH_FULL_SESSION_'+user+'.signature'});assert.equal(result.status,200,result.body.error);return {code:result.body.code,verifier};
}
async function exchange(value,overrides={}){return request({action:'exchange',client_id:'haze-web',redirect_uri:redirect,code:value.code,code_verifier:value.verifier,...overrides});}
async function session(options){const res=await exchange(await code(options));assert.equal(res.status,200,res.body.error);return res.body;}
const read=token=>request({action:'rpc',method:'gry_me',args:{}},{token});
before(async()=>{
 execFileSync('docker',['run','--rm','--detach','--name',container,'--label','haze.scoped.unit=20261120','--network','none','--tmpfs','/var/lib/postgresql/data:rw','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'],{stdio:'pipe'});owned=true;
 let ready=false;for(let n=0;n<100;n++){try{if(execFileSync('docker',['exec',container,'cat','/proc/1/comm'],{encoding:'utf8',stdio:'pipe'}).trim()==='postgres'&&psql('select 1')==='1'){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,'Disposable database became ready');
 psql(fs.readFileSync(path.join(source,'scripts/haze-preview/bootstrap.sql'),'utf8'));
 psql(fs.readFileSync(path.join(source,'games/supabase/update_haze_tips.sql'),'utf8'));psql(fs.readFileSync(path.join(source,'games/supabase/update_haze_groups.sql'),'utf8'));
 psql(chatFixture(source));for(const file of ['update_haze_group_visibility.sql','update_haze_long_airdrops.sql']){const selected=path.join(source,'games/supabase',file);if(fs.existsSync(selected))psql(fs.readFileSync(selected,'utf8'));}const migration=fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../games/supabase/update_haze_community_v1.sql'),'utf8');psql(migration);psql(migration);const mobile=fs.readFileSync(path.join(source,'games/supabase/mobile-connections.sql'),'utf8');psql(mobile);psql(mobile);
 initial=JSON.parse(psql("select json_build_object('enabled',(select enabled from games.community_settings where id),'clients',(select count(*) from games.community_clients where enabled));"));
 psql(`insert into auth.users values(${quote(uid(1))}),(${quote(uid(2))});insert into auth.identities values(${quote(uid(1))},'discord'),(${quote(uid(2))},'discord');insert into games.profiles(user_id,nick) values(${quote(uid(1))},'Lew'),(${quote(uid(2))},'Byl');insert into games.haze_testers(user_id,label) values(${quote(uid(1))},'Lew'),(${quote(uid(2))},'Byl');update games.haze_settings set enabled=true,groups_enabled=true;`);
 psql(`alter table auth.identities add column identity_data jsonb;update auth.identities set identity_data=jsonb_build_object('user_name',case when user_id=${quote(uid(1))} then 'lewisbong' else 'Byl' end);`);
 handler=createCommunityHandler({rpc,authenticate:async token=>{authCalls++;const match=/^fixture\.PH_FULL_SESSION_([12])\.signature$/.exec(token);return match?{id:uid(Number(match[1])),is_anonymous:false,identities:[{provider:'discord'}]}:null;}});
});
beforeEach(()=>{
 psql('truncate games.community_codes,games.community_sessions,games.community_budgets;delete from games.lobby_chat;delete from games.lobby_mutes;update games.community_settings set enabled=true,beta_only=true;');
 psql(`update games.community_clients set enabled=(id='haze-web');update games.community_clients set scopes=ARRAY[${scopes.map(quote).join(',')}],redirect_uri=${quote(redirect)} where id='haze-web';insert into games.haze_testers(user_id,label) values(${quote(uid(1))},'Lew'),(${quote(uid(2))},'Byl') on conflict do nothing;`);authCalls=0;
});
after(()=>{if(owned)execFileSync('docker',['stop','--timeout','1',container],{stdio:'ignore'});});
test('installation is repeatable, defaults off, and grants no token-table/function access to PH users',()=>{
 assert.deepEqual(initial,{enabled:false,clients:0});
 assert.throws(()=>psql("set role authenticated;select * from games.community_sessions;"),/failed/);
 assert.throws(()=>psql(callSQL('community_v1_exchange',{},'authenticated')),/failed/);
 assert.throws(()=>psql(callSQL('community_v1_authorize',{user_id:uid(2)},'anon')),/failed/);
});
test('full PH JWTs are accepted only by the PH-origin consent route, never as community access',async()=>{
 assert.equal((await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:'c'.repeat(43),code_challenge_method:'S256',scopes},{token:'fixture.PH_FULL_SESSION_1.signature'})).status,403);assert.equal(authCalls,0);
 assert.equal((await read('fixture.PH_FULL_SESSION_1.signature')).status,401);assert.equal(authCalls,0);
 assert.equal((await request({action:'refresh',refresh_token:'fixture.PH_FULL_SESSION_1.signature'})).status,401);
});
test('PKCE, client, redirect, real origin, expiry and one-use code are all enforced',async()=>{
 const value=await code();assert.equal((await exchange(value,{code_verifier:'x'.repeat(43)})).status,400);
 assert.equal((await exchange(value,{redirect_uri:'https://evil.example/callback'})).status,400);
 assert.equal((await exchange(value,{client_id:'haze-native'})).status,400);
 assert.equal((await request({action:'exchange',client_id:'haze-web',redirect_uri:redirect,code:value.code,code_verifier:value.verifier},{origin:'https://evil.example'})).status,403);
 assert.equal((await exchange(value)).status,200);assert.equal((await exchange(value)).status,400);
 const expired=await code();psql("update games.community_codes set expires_at=clock_timestamp()-interval '1 second' where consumed_at is null;");assert.equal((await exchange(expired)).status,400);
});
test('two concurrent database exchanges cannot redeem the same code twice',async()=>{
 const value=await code(),params={client_id:'haze-web',redirect_uri:redirect,origin:HZ,code_hash:await hash(value.code),challenge:await challenge(value.verifier)};
 const sqls=await Promise.all([1,2].map(async()=>callSQL('community_v1_exchange',{...params,access_hash:await hash(secret('phc1_')),refresh_hash:await hash(secret('phr1_'))})));
 const results=await Promise.allSettled(sqls.map(input=>run('docker',['exec','-i',container,'psql','-U','postgres','-XAtq','-v','ON_ERROR_STOP=1','-c',input])));
 assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(psql('select count(*) from games.community_sessions;'),'1');
});
test('opaque tokens identify their owner; games, Passport, host and forged owner arguments fail',async()=>{
 const value=await session();const me=await read(value.access_token);assert.equal(me.status,200);assert.equal(me.body.user_id,uid(1));assert.ok(!value.access_token.includes('.'));
 for(const method of ['gry_host_login','gry_passport','haze_tip_confirm'])assert.equal((await request({action:'rpc',method,args:{}},{token:value.access_token})).status,403);
 assert.equal((await request({action:'rpc',method:'gry_me',args:{p_user:uid(2)}},{token:value.access_token})).status,403);
 await assert.rejects(async()=>rpc('community_v1_verify',{access_hash:await hash(value.access_token),origin:HZ,method:'haze_link_finish',args:{p_user:uid(2)}}));
});
test('read-only scopes cannot post or link; refresh cannot add permissions without new consent',async()=>{
 psql("update games.community_clients set scopes=ARRAY['profile:read','chat:read'] where id='haze-web';");
 const value=await session({permissions:['profile:read','chat:read']});assert.equal((await read(value.access_token)).status,200);
 assert.equal((await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'gm',p_nick:'Lew'}},{token:value.access_token})).status,401);
 assert.equal((await request({action:'rpc',method:'gry_haze_link_begin',args:{}},{token:value.access_token})).status,401);
 psql("update games.community_clients set scopes=scopes||ARRAY['chat:write'] where id='haze-web';");
 const fresh=await request({action:'refresh',refresh_token:value.refresh_token});assert.equal(fresh.status,200);assert.ok(!fresh.body.scope.includes('chat:write'));
 const staleConsent=await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:'c'.repeat(43),code_challenge_method:'S256',scopes:['profile:read','chat:read']},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});assert.equal(staleConsent.status,400);
});
test('refresh rotates both limited tokens; replay revokes the family and absolute expiry stays fixed',async()=>{
 const value=await session(),fresh=await request({action:'refresh',refresh_token:value.refresh_token});assert.equal(fresh.status,200);assert.notEqual(fresh.body.access_token,value.access_token);assert.equal(fresh.body.session_expires_at,value.session_expires_at);assert.equal((await read(value.access_token)).status,401);
 assert.equal((await request({action:'refresh',refresh_token:value.refresh_token})).status,401);assert.equal((await read(fresh.body.access_token)).status,401);
});
test('Haze disconnect and PH account management both revoke immediately and cannot revoke another owner',async()=>{
 const one=await session(),two=await session({user:2});const listing=await request({action:'connections'},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});assert.equal(listing.body.length,1);
 await request({action:'connections',revoke_id:listing.body[0].id},{origin:PH,token:'fixture.PH_FULL_SESSION_2.signature'});assert.equal((await read(one.access_token)).status,200);
 await request({action:'connections',revoke_id:listing.body[0].id},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});assert.equal((await read(one.access_token)).status,401);
 await request({action:'revoke',refresh_token:two.refresh_token});assert.equal((await read(two.access_token)).status,401);assert.equal((await request({action:'refresh',refresh_token:two.refresh_token})).status,401);
});
test('server-side removal, expiry, client disable and global kill switch invalidate an existing token',async()=>{
 const value=await session();psql("update games.community_sessions set access_expires_at=clock_timestamp()-interval '1 second';");assert.equal((await read(value.access_token)).status,401);
 const refreshed=await request({action:'refresh',refresh_token:value.refresh_token});assert.equal(refreshed.status,200);
 psql(`delete from games.haze_testers where user_id=${quote(uid(1))};`);assert.ok((await read(refreshed.body.access_token)).status>=400);
 psql(`insert into games.haze_testers(user_id,label) values(${quote(uid(1))},'Lew');update games.community_clients set enabled=false where id='haze-web';`);assert.equal((await read(refreshed.body.access_token)).status,403);
 psql("update games.community_clients set enabled=true where id='haze-web';update games.community_settings set enabled=false;");assert.ok((await read(refreshed.body.access_token)).status>=400);
});
test('actual PH chat RPCs preserve mutes and hidden messages through the scoped API',async()=>{
 const value=await session();const posted=await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'gm pond',p_nick:'spoof'}},{token:value.access_token});assert.equal(posted.status,200);assert.equal(posted.body.nick,'Lew');
 psql(`update games.lobby_chat set hidden_at=clock_timestamp();insert into games.lobby_mutes(user_id,until) values(${quote(uid(1))},clock_timestamp()+interval '1 hour');`);
 const chat=await request({action:'rpc',method:'gry_lobby_chat',args:{p_after:0}},{token:value.access_token});assert.equal(chat.status,200);assert.equal(chat.body.messages.length,0);
 const muted=await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'must not appear',p_nick:'Lew'}},{token:value.access_token});assert.equal(muted.status,400);assert.match(muted.body.error,/muted/);
});
test('credentials are hashed at rest, anonymous allocations are refused and per-owner limits are durable',async()=>{
 const value=await session(),dump=psql('select to_jsonb(s) from games.community_sessions s;');assert.ok(!dump.includes(value.access_token)&&!dump.includes(value.refresh_token));
 psql(`update games.community_budgets set requests=180,window_start=clock_timestamp() where user_id=${quote(uid(1))};`);assert.equal((await read(value.access_token)).status,400);
 assert.equal((await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:'c'.repeat(43),code_challenge_method:'S256',scopes},{origin:PH})).status,401);
 psql("update games.community_codes set expires_at=clock_timestamp()-interval '2 hours';update games.community_sessions set expires_at=clock_timestamp()-interval '2 days';");await rpc('community_v1_cleanup',{});assert.equal(psql('select count(*) from games.community_codes;'),'0');assert.equal(psql('select count(*) from games.community_sessions;'),'0');
});

test('global code allocation has a strict durable ceiling, including consumed codes',async()=>{
 psql(`insert into games.community_codes(code_hash,user_id,client_id,redirect_uri,challenge,scopes,created_at,expires_at,consumed_at) select encode(sha256(convert_to('fixture-code-'||n,'UTF8')),'hex'),${quote(uid(2))},'haze-web',${quote(redirect)},repeat('c',43),ARRAY['chat:read'],clock_timestamp()-interval '20 minutes',clock_timestamp()+interval '1 minute',clock_timestamp() from generate_series(1,5000)n;`);
 const res=await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:'c'.repeat(43),code_challenge_method:'S256',scopes},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});assert.equal(res.status,400);assert.equal(psql('select count(*) from games.community_codes;'),'5000');
});

test('PH moderation error replies are surfaced and failed authorized posts still consume the budget',async()=>{
 const value=await session();
 const blocked=await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'blockedword',p_nick:'Lew'}},{token:value.access_token});assert.equal(blocked.status,400);assert.match(blocked.body.error,/not allowed/);assert.equal(psql('select count(*) from games.lobby_mutes;'),'1');
 // The shared Edge IP must never be muted or stored: one user's blocked word would silence every Haze user.
 assert.equal(psql('select count(*) from games.lobby_ip_mutes;'),'0');
 const other=await session({user:2});const ok=await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'gm from another Haze user',p_nick:'Byl'}},{token:other.access_token});
 assert.equal(ok.status,200,ok.body.error);assert.equal(psql("select count(*) from games.lobby_chat where body='gm from another Haze user' and ip_hash is null;"),'1');
 psql(`update games.community_budgets set requests=179,window_start=clock_timestamp() where user_id=${quote(uid(1))};`);
 const muted=await request({action:'rpc',method:'gry_lobby_say',args:{p_text:'nope',p_nick:'Lew'}},{token:value.access_token});assert.equal(muted.status,400);assert.match(muted.body.error,/muted/);assert.equal((await read(value.access_token)).status,400);assert.equal(psql(`select requests from games.community_budgets where user_id=${quote(uid(1))};`),'180');
});

test('Byl activation validates both names atomically and rollback leaves legacy PH tips enabled',async()=>{
 const directory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../games/supabase/community-v1'),enable=fs.readFileSync(path.join(directory,'enable-web-beta.sql'),'utf8');
 psql(`update games.community_settings set enabled=false;update games.community_clients set enabled=false;delete from games.haze_testers where user_id=${quote(uid(1))};`);
 assert.throws(()=>psql(enable),/failed/);assert.equal(psql('select enabled from games.community_settings;'),'f');assert.equal(psql(`select count(*) from games.haze_testers where user_id=${quote(uid(1))};`),'0');
 psql(enable.replaceAll('BYL_DISCORD_USERNAME','Byl'));assert.equal(psql('select enabled from games.community_settings;'),'t');const value=await session();
 psql(fs.readFileSync(path.join(directory,'disable-beta.sql'),'utf8'));assert.ok((await read(value.access_token)).status>=400);assert.equal(psql('select enabled and groups_enabled from games.haze_settings;'),'t');
});

test('community dispatch preserves the current PH long-airdrop rules without replacing its migrations',async()=>{
 const latest=path.join(source,'games/supabase/update_haze_long_airdrops.sql');if(!fs.existsSync(latest))return;
 psql(`insert into games.haze_links(user_id,address) values(${quote(uid(1))},'PprqR9iJCymdgyU7MhGYEJEYTFiF3LLBA3'),(${quote(uid(2))},'PfTEAYTbZwnCq1apnyUERLQV6effdNfmwX') on conflict(user_id) do nothing;`);
 const owner=await session(),recipient=await session({user:2});const created=await request({action:'rpc',method:'gry_haze_group_create',args:{p_options:{mode:'airdrop',total_atomic:'100000000',seconds:36000,winners:1}}},{token:owner.access_token});assert.equal(created.status,200,created.body.error);
 const joined=await request({action:'rpc',method:'gry_haze_group_join',args:{p_id:created.body.id}},{token:recipient.access_token});assert.equal(joined.status,200,joined.body.error);
 const review=await request({action:'rpc',method:'gry_haze_group_review',args:{p_id:created.body.id}},{token:owner.access_token});assert.equal(review.status,200,review.body.error);assert.ok(Date.parse(review.body.expires_at)-Date.now()>11*3600000);assert.equal(review.body.recipients.length,1);
});

test('a per-client allowlist limits one client to named accounts while other clients stay open',async()=>{
 const before=await session({user:1});assert.equal((await read(before.access_token)).status,200);
 psql(`update games.community_clients set allowed_users=array[${quote(uid(2))}]::uuid[] where id='haze-web';`);
 try{
  assert.equal((await read(before.access_token)).status,401,'existing token of a non-listed account stops at once');
  const denied=await request({action:'authorize',client_id:'haze-web',redirect_uri:redirect,code_challenge:await challenge('v'.repeat(43)),code_challenge_method:'S256',scopes},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});
  assert.equal(denied.status,400,'a non-listed account cannot get a code');
  assert.equal((await request({action:'refresh',refresh_token:before.refresh_token})).status,401,'nor refresh');
  const listed=await session({user:2});assert.equal((await read(listed.access_token)).status,200,'the listed account works');
 }finally{psql(`update games.community_clients set allowed_users=null where id='haze-web';`);}
});

test('five existing mobile approvals show once and allow a remembered device to join at capacity',async()=>{
 const origin='capacitor://localhost',mobileReturn='https://hazewallet.com/app/community-auth';
 psql(`update games.community_clients set enabled=true,origins=array[${quote(origin)}],redirect_uri=${quote(mobileReturn)},scopes=array['profile:read','chat:read'] where id='haze-native';`);
 async function mobileCode(){
  const verifier='m'.repeat(43);
  const result=await request({action:'authorize',client_id:'haze-native',redirect_uri:mobileReturn,code_challenge:await challenge(verifier),code_challenge_method:'S256',scopes:['profile:read','chat:read']},{origin:PH,token:'fixture.PH_FULL_SESSION_1.signature'});
  assert.equal(result.status,200,result.body.error);
  return {action:'exchange',client_id:'haze-native',redirect_uri:mobileReturn,code:result.body.code,code_verifier:verifier};
 }
 const grant=async device=>{const res=await request({...await mobileCode(),...(device?{installation_id:device}:{})},{origin});assert.equal(res.status,200,res.body.error);return res.body;};
 const sessions=(user,fields={})=>request({action:'connections',...fields},{origin:PH,token:'fixture.PH_FULL_SESSION_'+user+'.signature'});
 const refresh=async token=>request({action:'refresh',refresh_token:token},{origin});
 for(let i=0;i<5;i++){const record=await grant();assert.ok(Date.parse(record.session_expires_at)-Date.now()<8.1*3600000);}
 // These legacy approvals accumulated across earlier logins outside the code issuance window.
 psql("update games.community_codes set created_at=created_at-interval '20 minutes' where consumed_at is not null");
 assert.equal((await sessions(1)).body.length,1);
 const device=crypto.randomUUID(),first=await grant(device);
 assert.ok(Date.parse(first.session_expires_at)-Date.now()>29.9*86400000);
 const pending=await mobileCode();
 const invalid=await request({...pending,code_verifier:'x'.repeat(43),installation_id:device},{origin});
 assert.equal(invalid.status,400);
 assert.equal((await refresh(first.refresh_token)).status,200);
 const renewed=await request({...pending,installation_id:device},{origin});assert.equal(renewed.status,200,renewed.body.error);
 const second=await grant(crypto.randomUUID());
 assert.equal(psql("select count(*) from games.community_sessions where installation_id is not null and revoked_at is null"),'2');
 const entries=(await sessions(1)).body;assert.equal(entries.length,1);
 assert.deepEqual((await sessions(2,{revoke_id:entries[0].id})).body,[]);
 assert.equal((await sessions(1)).body.length,1);
 assert.deepEqual((await sessions(1,{revoke_id:entries[0].id})).body,[]);
 assert.equal((await refresh(renewed.body.refresh_token)).status,401);
 assert.equal((await refresh(second.refresh_token)).status,401);
 assert.throws(()=>psql(callSQL('community_v1_exchange_device',{},'authenticated')),/failed/);
 assert.throws(()=>psql(callSQL('community_v1_app_connections',{},'anon')),/failed/);
});
