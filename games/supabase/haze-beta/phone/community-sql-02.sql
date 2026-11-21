-- Haze community install, part 2 of 5. Run IN ORDER after the tip/group SQL. Repeatable; everything stays OFF.
begin;
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
commit;
