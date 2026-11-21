-- Haze community install, part 3 of 5. Run IN ORDER after the tip/group SQL. Repeatable; everything stays OFF.
begin;
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
commit;
