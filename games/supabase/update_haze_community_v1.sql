-- PH-owned limited community credentials. Run after the existing tip/group SQL.
-- Installation is repeatable and leaves the new integration OFF.
begin;
create table if not exists games.community_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 beta_only boolean not null default true
);
insert into games.community_settings(id) values(true) on conflict do nothing;
create table if not exists games.community_clients (
 id text primary key, label text not null, redirect_uri text not null,
 origins text[] not null, scopes text[] not null, enabled boolean not null default false
);
insert into games.community_clients(id,label,redirect_uri,origins,scopes) values
 ('haze-web','Haze Wallet web','https://hazewallet.com/community-auth.html',array['https://hazewallet.com'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write']),
 ('haze-native','Haze Wallet mobile','hazewallet://community-auth',array['capacitor://localhost','https://localhost'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write']),
 ('haze-chrome','Haze Wallet Chrome','https://nidammajcicbihnibjecaknikfblnhmb.chromiumapp.org/community-auth',array['chrome-extension://nidammajcicbihnibjecaknikfblnhmb'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write'])
on conflict do nothing;
create table if not exists games.community_codes (
 code_hash text primary key check(code_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references games.community_clients(id),
 redirect_uri text not null, challenge text not null check(challenge ~ '^[A-Za-z0-9_-]{43}$'), scopes text[] not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes', consumed_at timestamptz
);
create index if not exists community_codes_owner on games.community_codes(user_id,created_at);
create index if not exists community_codes_expiry on games.community_codes(expires_at);
create table if not exists games.community_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references games.community_clients(id), audience text not null default 'ph-community-v1' check(audience='ph-community-v1'),
 scopes text[] not null, access_hash text unique not null check(access_hash ~ '^[a-f0-9]{64}$'),
 refresh_hash text unique not null check(refresh_hash ~ '^[a-f0-9]{64}$'), previous_refresh_hash text,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '8 hours',
 access_expires_at timestamptz not null default clock_timestamp()+interval '15 minutes', revoked_at timestamptz
);
create index if not exists community_sessions_owner on games.community_sessions(user_id,client_id,expires_at);
create index if not exists community_sessions_expiry on games.community_sessions(expires_at);
create table if not exists games.community_budgets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null, requests integer not null check(requests>0)
);
alter table games.community_settings enable row level security;
alter table games.community_clients enable row level security;
alter table games.community_codes enable row level security;
alter table games.community_sessions enable row level security;
alter table games.community_budgets enable row level security;
revoke all on games.community_settings,games.community_clients,games.community_codes,games.community_sessions,games.community_budgets from public,anon,authenticated;

create or replace function games.community_v1_user(u uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select enabled from games.community_settings where id),false)
 or u is null or games.discord_identity(u) is null
 or not exists(select 1 from auth.users where id=u)
 or (coalesce((select beta_only from games.community_settings where id),true)
     and not exists(select 1 from games.haze_testers where user_id=u))
 then raise exception 'Community access is unavailable for this account.';end if;
end $$;
create or replace function games.community_v1_budget(u uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n integer;t timestamptz:=clock_timestamp();
begin
 insert into games.community_budgets(user_id,window_start,requests) values(u,t,1)
 on conflict(user_id) do update set
 requests=case when community_budgets.window_start<t-interval '1 minute' then 1 else community_budgets.requests+1 end,
 window_start=case when community_budgets.window_start<t-interval '1 minute' then t else community_budgets.window_start end
 returning requests into n;
 if n>180 then raise exception 'Community request limit reached. Try again shortly.';end if;
end $$;
create or replace function games.community_v1_keys(a jsonb,allowed text[]) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(a)='object' and not exists(select 1 from jsonb_object_keys(a) k where not(k=any(allowed)))
$$;
create or replace function games.community_v1_context(h text,o text,required text)
returns games.community_sessions language plpgsql security definer set search_path='' as $$
declare s games.community_sessions;c games.community_clients;
begin
 select * into s from games.community_sessions where access_hash=h for update;
 select * into c from games.community_clients where id=s.client_id;
 if s.id is null or s.revoked_at is not null or s.access_expires_at<=clock_timestamp()
 or s.expires_at<=clock_timestamp() or not coalesce(c.enabled,false)
 or not coalesce(o=any(c.origins),false) or not coalesce(required=any(s.scopes) and required=any(c.scopes),false)
 then raise exception 'Community token expired, revoked, or missing permission.';end if;
 perform games.community_v1_user(s.user_id);
 return s;
end $$;

create or replace function public.community_v1_describe(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c games.community_clients;
begin
 select * into c from games.community_clients where id=p_args->>'client_id';
 if not coalesce((select enabled from games.community_settings where id),false)
 or not coalesce(c.enabled,false) or c.redirect_uri is distinct from (p_args->>'redirect_uri')
 then raise exception 'This Community client is not enabled or its return address is invalid.';end if;
 return jsonb_build_object('version',1,'client_id',c.id,'label',c.label,'redirect_uri',c.redirect_uri,'scopes',to_jsonb(c.scopes));
end $$;
create or replace function public.community_v1_origin(p_args jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from games.community_settings where id),false)
 and exists(select 1 from games.community_clients c where c.enabled and p_args->>'origin'=any(c.origins))
$$;
create or replace function public.community_v1_authorize(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(p_args->>'user_id')::uuid;c games.community_clients;
begin
 perform games.community_v1_user(u);
 perform 1 from auth.users where id=u for no key update;
 perform games.community_v1_budget(u);
 perform pg_advisory_xact_lock(442198240);
 select * into c from games.community_clients where id=p_args->>'client_id';
 if not coalesce(c.enabled,false) or c.redirect_uri is distinct from (p_args->>'redirect_uri')
 or coalesce(p_args->>'challenge','') !~ '^[A-Za-z0-9_-]{43}$'
 or coalesce(p_args->>'code_hash','') !~ '^[a-f0-9]{64}$'
 or to_jsonb(c.scopes) is distinct from (p_args->'scopes') then raise exception 'Community permissions changed or the request is invalid. Review again.';end if;
 delete from games.community_codes where code_hash in(select code_hash from games.community_codes where expires_at<clock_timestamp()-interval '1 hour' order by expires_at limit 100);
 if (select count(*) from games.community_codes where user_id=u and created_at>clock_timestamp()-interval '10 minutes')>=6
 or (select count(*) from games.community_codes)>=5000
 then raise exception 'Community connection limit reached. Try again later.';end if;
 insert into games.community_codes(code_hash,user_id,client_id,redirect_uri,challenge,scopes)
 values(p_args->>'code_hash',u,c.id,c.redirect_uri,p_args->>'challenge',c.scopes);
 return jsonb_build_object('redirect_uri',c.redirect_uri,'expires_in',300);
end $$;
create or replace function public.community_v1_exchange(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g games.community_codes;c games.community_clients;s games.community_sessions;
begin
 select * into g from games.community_codes where code_hash=p_args->>'code_hash' for update;
 select * into c from games.community_clients where id=g.client_id;
 if g.code_hash is null or g.consumed_at is not null or g.expires_at<=clock_timestamp()
 or not coalesce(c.enabled,false) or g.client_id is distinct from (p_args->>'client_id') or g.redirect_uri is distinct from (p_args->>'redirect_uri')
 or c.redirect_uri is distinct from g.redirect_uri or not coalesce(p_args->>'origin'=any(c.origins),false)
 or g.challenge is distinct from (p_args->>'challenge') then raise exception 'Community code is invalid, expired, or already used.';end if;
 perform games.community_v1_user(g.user_id);
 perform 1 from auth.users where id=g.user_id for no key update;
 perform games.community_v1_budget(g.user_id);
 perform pg_advisory_xact_lock(442198241);
 delete from games.community_sessions where id in(select id from games.community_sessions where expires_at<clock_timestamp()-interval '1 day' or revoked_at<clock_timestamp()-interval '1 day' order by expires_at limit 100);
 if coalesce(p_args->>'access_hash','') !~ '^[a-f0-9]{64}$' or coalesce(p_args->>'refresh_hash','') !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid community credential hashes.';end if;
 if (select count(*) from games.community_sessions where user_id=g.user_id and revoked_at is null and expires_at>clock_timestamp())>=5
 or (select count(*) from games.community_sessions)>=5000
 then raise exception 'Too many connected community sessions. Disconnect an old session on PepecoinHub.';end if;
 update games.community_codes set consumed_at=clock_timestamp() where code_hash=g.code_hash;
 insert into games.community_sessions(user_id,client_id,scopes,access_hash,refresh_hash)
 values(g.user_id,c.id,array(select unnest(g.scopes) intersect select unnest(c.scopes)),p_args->>'access_hash',p_args->>'refresh_hash') returning * into s;
 return jsonb_build_object('user_id',s.user_id,'scopes',to_jsonb(s.scopes),'session_expires_at',s.expires_at,'expires_in',900);
end $$;
create or replace function public.community_v1_refresh(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s games.community_sessions;c games.community_clients;
begin
 select * into s from games.community_sessions where refresh_hash=p_args->>'refresh_hash' or previous_refresh_hash=p_args->>'refresh_hash' for update;
 select * into c from games.community_clients where id=s.client_id;
 if s.id is null or s.revoked_at is not null or s.expires_at<=clock_timestamp() or not coalesce(c.enabled,false)
 or not coalesce(p_args->>'origin'=any(c.origins),false) then return jsonb_build_object('invalid',true);end if;
 if s.previous_refresh_hash=p_args->>'refresh_hash' then
  update games.community_sessions set revoked_at=clock_timestamp() where id=s.id;
  return jsonb_build_object('invalid',true);
 end if;
 perform games.community_v1_user(s.user_id);perform games.community_v1_budget(s.user_id);
 if coalesce(p_args->>'access_hash','') !~ '^[a-f0-9]{64}$' or coalesce(p_args->>'next_refresh_hash','') !~ '^[a-f0-9]{64}$'
 then raise exception 'Invalid community credential hashes.';end if;
 update games.community_sessions set previous_refresh_hash=refresh_hash,refresh_hash=p_args->>'next_refresh_hash',access_hash=p_args->>'access_hash',access_expires_at=least(clock_timestamp()+interval '15 minutes',expires_at),scopes=array(select unnest(s.scopes) intersect select unnest(c.scopes)) where id=s.id returning * into s;
 return jsonb_build_object('user_id',s.user_id,'scopes',to_jsonb(s.scopes),'session_expires_at',s.expires_at,'expires_in',greatest(1,floor(extract(epoch from s.access_expires_at-clock_timestamp()))::integer));
end $$;
create or replace function public.community_v1_revoke(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 update games.community_sessions s set revoked_at=clock_timestamp() from games.community_clients c
 where s.client_id=c.id and p_args->>'origin'=any(c.origins)
 and (s.refresh_hash=p_args->>'refresh_hash' or s.previous_refresh_hash=p_args->>'refresh_hash');
 return jsonb_build_object('revoked',true);
end $$;
create or replace function public.community_v1_connections(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=(p_args->>'user_id')::uuid;
begin
 if games.discord_identity(u) is null then raise exception 'Discord account required.';end if;
 if p_args->>'revoke_id' is not null then
  update games.community_sessions set revoked_at=clock_timestamp() where user_id=u and id=(p_args->>'revoke_id')::uuid;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'client_id',s.client_id,'label',c.label,'scopes',s.scopes,'expires_at',s.expires_at))
 from games.community_sessions s join games.community_clients c on c.id=s.client_id where s.user_id=u and s.revoked_at is null and s.expires_at>clock_timestamp()),'[]'::jsonb);
end $$;

create or replace function public.community_v1_rpc(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text:=p_args->>'method';a jsonb:=coalesce(p_args->'args','{}'::jsonb);required text;fields text[];s games.community_sessions;r jsonb;
begin
 required:=case m when 'gry_me' then 'profile:read' when 'gry_lobby_chat' then 'chat:read' when 'gry_lobby_who' then 'chat:read' when 'gry_lobby_say' then 'chat:write'
 when 'gry_haze_status' then 'tips:read' when 'gry_haze_chat' then 'tips:read' when 'gry_haze_link_begin' then 'wallet:link' when 'gry_haze_tip_begin' then 'tips:write'
 when 'gry_haze_groups' then 'groups:read' when 'gry_haze_group_create' then 'groups:write' when 'gry_haze_group_join' then 'groups:write' when 'gry_haze_group_review' then 'groups:write' when 'gry_haze_group_cancel' then 'groups:write' else null end;
 if required is null then raise exception 'Method is outside community-v1.';end if;
 fields:=case m when 'gry_lobby_chat' then array['p_after','p_visitor'] when 'gry_lobby_who' then array['p_visitor'] when 'gry_lobby_say' then array['p_text','p_nick']
 when 'gry_haze_chat' then array['p_messages'] when 'gry_haze_tip_begin' then array['p_message','p_amount','p_reaction','p_note'] when 'gry_haze_group_create' then array['p_options']
 when 'gry_haze_group_join' then array['p_id'] when 'gry_haze_group_review' then array['p_id'] when 'gry_haze_group_cancel' then array['p_id'] else array[]::text[] end;
 if not games.community_v1_keys(a,fields) then raise exception 'Unsupported community arguments.';end if;
 s:=games.community_v1_context(p_args->>'access_hash',p_args->>'origin',required);perform games.community_v1_budget(s.user_id);
 begin
 -- Existing PH RPCs see only the verified token owner's identity, with no host
 -- or service-role claims supplied by the client. No arbitrary SQL/function name.
 -- No caller network: every community request reaches PostgREST from PH's Edge egress IP, shared by all Haze
 -- users. Without this, an IP-based chat mute (blocked words, host mute) of one user would silence all of them
 -- and every message would carry the same ip_hash. Moderation stays per account (lobby_mutes by user_id).
 perform set_config('request.headers','{}',true);
 perform set_config('request.jwt.claim.sub',s.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id::text,'role','authenticated')::text,true);
 case m
 when 'gry_me' then r:=public.gry_me();
 when 'gry_lobby_chat' then r:=public.gry_lobby_chat(coalesce((a->>'p_after')::bigint,0),a->>'p_visitor');
 when 'gry_lobby_who' then r:=public.gry_lobby_who(a->>'p_visitor');
 when 'gry_lobby_say' then r:=public.gry_lobby_say(a->>'p_text',a->>'p_nick');
 when 'gry_haze_status' then r:=public.gry_haze_status();
 when 'gry_haze_link_begin' then r:=public.gry_haze_link_begin();
 when 'gry_haze_chat' then r:=public.gry_haze_chat(array(select jsonb_array_elements_text(a->'p_messages')::bigint));
 when 'gry_haze_tip_begin' then r:=public.gry_haze_tip_begin((a->>'p_message')::bigint,a->>'p_amount',a->>'p_reaction',a->>'p_note');
 when 'gry_haze_groups' then r:=public.gry_haze_groups();
 when 'gry_haze_group_create' then r:=public.gry_haze_group_create(a->'p_options');
 when 'gry_haze_group_join' then r:=public.gry_haze_group_join((a->>'p_id')::uuid);
 when 'gry_haze_group_review' then r:=public.gry_haze_group_review((a->>'p_id')::uuid);
 when 'gry_haze_group_cancel' then r:=public.gry_haze_group_cancel((a->>'p_id')::uuid);
 end case;
 exception when others then return jsonb_build_object('__community_error',SQLERRM);
 end;
 return r;
end $$;
create or replace function public.community_v1_verify(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text:=p_args->>'method';a jsonb:=p_args->'args';required text;fields text[];s games.community_sessions;
begin
 required:=case m when 'haze_link_context' then 'wallet:link' when 'haze_link_finish' then 'wallet:link'
 when 'haze_tip_context' then 'tips:read' when 'haze_tip_confirm' then 'tips:read'
 when 'haze_group_context' then 'groups:read' when 'haze_group_confirm' then 'groups:read' else null end;
 fields:=case m when 'haze_link_context' then array['p_nonce'] when 'haze_link_finish' then array['p_nonce','p_address']
 when 'haze_tip_context' then array['p_intent','p_txid'] when 'haze_group_context' then array['p_intent','p_txid']
 when 'haze_tip_confirm' then array['p_intent','p_txid','p_vout','p_block','p_time'] when 'haze_group_confirm' then array['p_intent','p_txid','p_block','p_time'] else array[]::text[] end;
 if required is null or not games.community_v1_keys(a,fields) then raise exception 'Unsupported community verification.';end if;
 s:=games.community_v1_context(p_args->>'access_hash',p_args->>'origin',required);perform games.community_v1_budget(s.user_id);
 begin
 case m
 when 'haze_link_context' then return public.haze_link_context(s.user_id,a->>'p_nonce');
 when 'haze_link_finish' then return public.haze_link_finish(s.user_id,a->>'p_nonce',a->>'p_address');
 when 'haze_tip_context' then return public.haze_tip_context(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid');
 when 'haze_tip_confirm' then return public.haze_tip_confirm(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid',(a->>'p_vout')::integer,a->>'p_block',(a->>'p_time')::bigint);
 when 'haze_group_context' then return public.haze_group_context(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid');
 when 'haze_group_confirm' then return public.haze_group_confirm(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid',a->>'p_block',(a->>'p_time')::bigint);
 end case;
 exception when others then return jsonb_build_object('__community_error',SQLERRM);
 end;
end $$;
create or replace function public.community_v1_cleanup(p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 delete from games.community_codes where expires_at<clock_timestamp()-interval '1 hour';
 delete from games.community_sessions where expires_at<clock_timestamp()-interval '1 day' or revoked_at<clock_timestamp()-interval '1 day';
 delete from games.community_budgets where window_start<clock_timestamp()-interval '1 day';
 return jsonb_build_object('cleaned',true);
end $$;
-- All credential operations require PH's Edge service role. A public key or
-- ordinary PH user JWT cannot mint/inspect/use these database entry points.
do $$ declare f record;begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','games') and left(p.proname,13)='community_v1_'
 loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',f.nspname,f.proname,f.args);
  if f.nspname='public' then execute format('grant execute on function %I.%I(%s) to service_role',f.nspname,f.proname,f.args);end if;
 end loop;
end $$;
commit;
