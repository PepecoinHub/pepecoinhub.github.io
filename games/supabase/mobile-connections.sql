begin;

alter table games.community_sessions add column if not exists installation_id uuid;
create unique index if not exists community_active_installation
  on games.community_sessions(user_id,client_id,installation_id)
  where installation_id is not null and revoked_at is null;

-- Called only by the PH Edge function on an explicit native device exchange.
create or replace function public.community_v1_exchange_device(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  g games.community_codes;
  device uuid := (p_args->>'installation_id')::uuid;
  result jsonb;
  deadline timestamptz;
begin
  select * into g from games.community_codes where code_hash=p_args->>'code_hash' for update;
  if device is null or g.client_id is distinct from 'haze-native' or
     g.consumed_at is not null or g.expires_at<=clock_timestamp() then
    raise exception 'Invalid mobile authorization.';
  end if;
  -- Use the lock order of the original exchange. All changes roll back if its
  -- PKCE, tester, client, origin, scope, budget or capacity checks fail.
  perform 1 from auth.users where id=g.user_id for no key update;
  perform pg_advisory_xact_lock(442198241);
  update games.community_sessions set revoked_at=clock_timestamp()
    where user_id=g.user_id and client_id=g.client_id and installation_id=device and revoked_at is null;
  if (select count(*) from games.community_sessions where user_id=g.user_id
      and revoked_at is null and expires_at>clock_timestamp())>=5 then
    -- Make space for an upgrade at the existing cap, using one old mobile grant.
    update games.community_sessions set revoked_at=clock_timestamp() where id=(
      select id from games.community_sessions where user_id=g.user_id and client_id=g.client_id
      and installation_id is null and revoked_at is null and expires_at>clock_timestamp()
      order by created_at,id limit 1);
  end if;
  result:=public.community_v1_exchange(p_args-'installation_id');
  update games.community_sessions set installation_id=device, expires_at=created_at+interval '30 days'
    where access_hash=p_args->>'access_hash' and user_id=g.user_id and client_id=g.client_id
    returning expires_at into strict deadline;
  return result || jsonb_build_object('session_expires_at',deadline);
end $$;

create or replace function public.community_v1_app_connections(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := (p_args->>'user_id')::uuid;
  revoke_id uuid := (p_args->>'revoke_id')::uuid;
  entries jsonb;
begin
  if revoke_id is not null then
    perform 1 from auth.users where id=owner_id for no key update;
  end if;
  -- The original management RPC verifies the Discord identity and handles
  -- single-session revocation for every other client.
  entries:=public.community_v1_connections(p_args);
  if revoke_id is not null and exists(select 1 from games.community_sessions
     where id=revoke_id and user_id=owner_id and client_id='haze-native') then
    update games.community_sessions set revoked_at=clock_timestamp()
      where user_id=owner_id and client_id='haze-native' and revoked_at is null;
    entries:=public.community_v1_connections(p_args-'revoke_id');
  end if;
  return (select coalesce(jsonb_agg(entry order by entry->>'label',entry->>'id'),'[]'::jsonb)
    from (select distinct on (app_key) entry from
      (select entry,case when entry->>'client_id'='haze-native' then 'haze-native'
        else entry->>'id' end as app_key from jsonb_array_elements(entries) as e(entry)) keyed
      order by app_key,(entry->>'expires_at')::timestamptz desc,entry->>'id') apps);
end $$;

revoke all on function public.community_v1_exchange_device(jsonb), public.community_v1_app_connections(jsonb)
  from public,anon,authenticated;
grant execute on function public.community_v1_exchange_device(jsonb), public.community_v1_app_connections(jsonb)
  to service_role;
commit;
