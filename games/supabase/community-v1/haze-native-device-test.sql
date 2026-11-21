-- Haze mobile device test: haze-native ONLY for lewisbong, with exactly profile:read + chat:read.
-- The web client (haze-web) stays open to everyone. Run once in the SQL editor; repeatable.
-- 1) per-client allowlist support (same code as games/supabase/update_haze_community_v1.sql)
alter table games.community_clients add column if not exists allowed_users uuid[];
create or replace function games.community_v1_context(h text,o text,required text)
returns games.community_sessions language plpgsql security definer set search_path='' as $$
declare s games.community_sessions;c games.community_clients;
begin
 select * into s from games.community_sessions where access_hash=h for update;
 select * into c from games.community_clients where id=s.client_id;
 if s.id is null or s.revoked_at is not null or s.access_expires_at<=clock_timestamp()
 or s.expires_at<=clock_timestamp() or not coalesce(c.enabled,false)
 or not coalesce(o=any(c.origins),false) or not coalesce(required=any(s.scopes) and required=any(c.scopes),false)
 or (c.allowed_users is not null and not s.user_id=any(c.allowed_users))
 then raise exception 'Community token expired, revoked, or missing permission.';end if;
 perform games.community_v1_user(s.user_id);
 return s;
end $$;
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
 or (c.allowed_users is not null and not u=any(c.allowed_users))
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
 or (c.allowed_users is not null and not g.user_id=any(c.allowed_users))
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
 or not coalesce(p_args->>'origin'=any(c.origins),false)
 or (c.allowed_users is not null and not s.user_id=any(c.allowed_users)) then return jsonb_build_object('invalid',true);end if;
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
revoke all on function games.community_v1_context(text,text,text) from public,anon,authenticated;
revoke all on function public.community_v1_authorize(jsonb),public.community_v1_exchange(jsonb),public.community_v1_refresh(jsonb) from public,anon,authenticated;
grant execute on function public.community_v1_authorize(jsonb),public.community_v1_exchange(jsonb),public.community_v1_refresh(jsonb) to service_role;

-- 2) haze-native: lewisbong only, two read scopes, enabled; earlier native codes and grants revoked.
do $$
declare hits int; uid uuid;
begin
  select count(distinct i.user_id), min(i.user_id::text)::uuid into hits, uid from auth.identities i
   where i.provider='discord' and 'lewisbong' in (lower(regexp_replace(coalesce(i.identity_data->>'name',''),'#0$','')),
     lower(coalesce(i.identity_data->>'full_name','')), lower(coalesce(i.identity_data->>'user_name','')),
     lower(coalesce(i.identity_data->>'preferred_username','')), lower(coalesce(i.identity_data->'custom_claims'->>'global_name','')));
  if hits<>1 then raise exception 'Discord name lewisbong matches % accounts (needs exactly 1).', hits; end if;
  update games.community_clients set allowed_users=array[uid], scopes=array['profile:read','chat:read'], redirect_uri='https://hazewallet.com/app/community-auth', enabled=true where id='haze-native';
  delete from games.community_codes where client_id='haze-native';
  update games.community_sessions set revoked_at=clock_timestamp() where client_id='haze-native' and revoked_at is null;
end $$;
select id, enabled, scopes, allowed_users, redirect_uri from games.community_clients order by id;
-- Undo the test: update games.community_clients set enabled=false where id='haze-native';
-- Open mobile to everyone later (after Haze confirms the release):
--   update games.community_clients set allowed_users=null, scopes=(select scopes from games.community_clients where id='haze-web') where id='haze-native';
