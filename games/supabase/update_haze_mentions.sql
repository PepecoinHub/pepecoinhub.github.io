-- HazeWallet phone alerts for @mentions (Haze package 2026-11-21). Run after update_haze_community_v1.sql,
-- update_lobby_mentions.sql and update_push.sql. Off until a phone registers; the payload carries no message text.
begin;
create table if not exists games.haze_mention_devices (
 install text primary key, owner uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null, platform text not null check (platform in ('ios','android')), token text not null unique,
 updated timestamptz not null default now()
);
create index if not exists haze_mention_owner on games.haze_mention_devices(owner);
create table if not exists games.haze_mention_queue (
 event bigint not null, install text not null references games.haze_mention_devices on delete cascade,
 created timestamptz not null default now(), available timestamptz not null default now(),
 attempt int not null default 0, lease uuid, primary key(event,install)
);
create index if not exists haze_mention_due on games.haze_mention_queue(available);
create table if not exists games.haze_mention_sender(platform text primary key, seen timestamptz not null);
alter table games.haze_mention_devices enable row level security;
alter table games.haze_mention_queue enable row level security;
alter table games.haze_mention_sender enable row level security;
revoke all on games.haze_mention_devices,games.haze_mention_queue,games.haze_mention_sender from public,anon,authenticated;

create or replace function public.community_v1_mentions(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 s games.community_sessions;
 a jsonb:=p_args->'args';
 k text:=encode(sha256(convert_to(a->>'p_install','UTF8')),'hex');
 platform_name text:=a->>'p_platform';
 t text:=a->>'p_token';
 ready boolean;
begin
 s:=games.community_v1_context(p_args->>'access_hash',p_args->>'origin','chat:read');
 if s.client_id<>'haze-native' or not games.community_v1_keys(a,array['p_install','p_platform','p_token'])
 or not (a ?& array['p_install','p_platform','p_token']) or jsonb_typeof(a->'p_token') not in ('null','string')
 or coalesce(a->>'p_install','') !~ '^[0-9a-f]{64}$'
 or platform_name is distinct from (case p_args->>'origin' when 'capacitor://localhost' then 'ios' when 'https://localhost' then 'android' else 'invalid' end)
 then raise exception 'Invalid Haze device.'; end if;
 perform games.community_v1_budget(s.user_id);
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 select exists(select 1 from games.haze_mention_sender where platform=platform_name and seen>now()-interval '3 minutes') into ready;
 if t='' then return jsonb_build_object('available',ready,'enabled',exists(select 1 from games.haze_mention_devices where install=k and owner=s.user_id)); end if;
 if t is null then delete from games.haze_mention_devices where install=k;return '{"enabled":false}'::jsonb;end if;
 if not ready or (platform_name='ios' and t !~ '^[0-9A-Fa-f]{64,200}$')
 or (platform_name='android' and t !~ '^[A-Za-z0-9_:-]{24,512}$') then raise exception 'Phone delivery is unavailable.';end if;
 perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,1));
 -- A changed account discards queued notifications for the previous identity.
 delete from games.haze_mention_devices where install=k and owner<>s.user_id;
 if not exists(select 1 from games.haze_mention_devices where install=k)
 and (select count(*) from games.haze_mention_devices where owner=s.user_id)>=8 then raise exception 'Device limit reached.';end if;
 insert into games.haze_mention_devices(install,owner,session_id,platform,token) values(k,s.user_id,s.id,platform_name,t)
 on conflict(install) do update set token=excluded.token,session_id=excluded.session_id,platform=excluded.platform,updated=now();
 return '{"enabled":true}'::jsonb;
end $$;

create or replace function games.haze_revoke_device_mentions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from games.haze_mention_devices where session_id=new.id;
 return new;
end $$;
revoke all on function games.haze_revoke_device_mentions() from public,anon,authenticated;
drop trigger if exists haze_mention_grant_revoked on games.community_sessions;
create trigger haze_mention_grant_revoked after update of revoked_at on games.community_sessions
 for each row when (old.revoked_at is null and new.revoked_at is not null)
 execute function games.haze_revoke_device_mentions();

create or replace function games.haze_queue_mention() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Never let phone alerts break the chat: this runs inside the insert of a PondOS push row, which is part of
 -- posting an @mention. Any failure here only skips the Haze alert.
 begin
  if new.kind='mention' and new.to_user is not null and new.to_user is distinct from new.not_user
  and not exists(select 1 from games.mention_optout where user_id=new.to_user) then
   insert into games.haze_mention_queue(event,install)
   select new.id,d.install from games.haze_mention_devices d where d.owner=new.to_user
     and d.updated>now()-interval '60 days'
     and (select count(*) from games.haze_mention_queue q where q.install=d.install)<128
   on conflict do nothing;
  end if;
 exception when others then null;
 end;
 return new;
end $$;
drop trigger if exists haze_phone_mention on games.push_outbox;
create trigger haze_phone_mention after insert on games.push_outbox for each row
when (new.kind='mention') execute function games.haze_queue_mention();

-- Only the separately authenticated delivery function may call this RPC.
create or replace function public.haze_mention_delivery(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item games.haze_mention_queue; result jsonb; platform_name text;
begin
 if p_args->>'action'='finish' then
  select * into item from games.haze_mention_queue where event=(p_args->>'event')::bigint
   and install=p_args->>'install' and lease=(p_args->>'lease')::uuid for update;
  if not found then return '{}'::jsonb;end if;
  if p_args->>'result'='gone' then delete from games.haze_mention_devices where install=item.install and token=p_args->>'token';end if;
  if p_args->>'result' in ('sent','gone') then delete from games.haze_mention_queue where event=item.event and install=item.install;
  else update games.haze_mention_queue set available=now()+least(900,15*(2^least(attempt,6))::int)*interval '1 second',lease=null where event=item.event and install=item.install; end if;
  return '{}'::jsonb;
 end if;
 if p_args->>'action'<>'take' then raise exception 'Invalid operation';end if;
 for platform_name in select value from jsonb_array_elements_text(p_args->'platforms') where value in ('ios','android') loop
  insert into games.haze_mention_sender values(platform_name,now()) on conflict(platform) do update set seen=excluded.seen;
 end loop;
 delete from games.haze_mention_devices where updated<now()-interval '60 days';
 delete from games.haze_mention_queue where created<now()-interval '1 day' or attempt>=8;
 with batch as (
  select q.event,q.install,d.platform,d.token from games.haze_mention_queue q join games.haze_mention_devices d using(install)
  where q.available<=now() and (p_args->'platforms') ? d.platform
  and exists(select 1 from games.community_clients c where c.id='haze-native' and c.enabled and 'chat:read'=any(c.scopes)
    and (c.allowed_users is null or d.owner=any(c.allowed_users)))
  and exists(select 1 from games.community_settings where id and enabled and (not beta_only or exists(select 1 from games.haze_testers where user_id=d.owner)))
  and not exists(select 1 from games.mention_optout o where o.user_id=d.owner)
  order by q.available limit 10 for update of q skip locked
 ), claimed as (
  update games.haze_mention_queue q set attempt=q.attempt+1,lease=gen_random_uuid(),available=now()+interval '2 minutes'
   from batch b where (b.event,b.install)=(q.event,q.install) returning q.event::text,q.install,q.lease,b.platform,b.token
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end $$;
revoke all on function public.community_v1_mentions(jsonb),public.haze_mention_delivery(jsonb),games.haze_queue_mention() from public,anon,authenticated;
grant execute on function public.community_v1_mentions(jsonb),public.haze_mention_delivery(jsonb) to service_role;
commit;
