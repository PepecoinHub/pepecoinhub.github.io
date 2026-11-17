-- Haze install, part 2 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
create or replace function public.gry_haze_link_begin() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_require_user(); c games.haze_challenges; at timestamptz:=date_trunc('milliseconds',clock_timestamp());
begin
  -- Lock the user, including the first challenge, so parallel calls share the limit.
  perform 1 from auth.users where id=u for no key update;
  -- A retry within 30 s (e.g. after creating or unlocking the wallet in the Haze window) reuses the still-unused
  -- challenge instead of failing: no new row, same 5-minute expiry. Only a new challenge is rate-limited.
  select * into c from games.haze_challenges where user_id=u and issued_at>clock_timestamp()-interval '30 seconds';
  if found then
    if c.used_at is not null or c.expires_at<=clock_timestamp() or c.checks>=5 then raise exception 'Wait 30 seconds before linking again.'; end if;
  else
  insert into games.haze_challenges(user_id,nonce,issued_at,expires_at)
    values(u,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),at,at+interval '5 minutes')
    on conflict(user_id) do update set nonce=excluded.nonce,issued_at=excluded.issued_at,expires_at=excluded.expires_at,used_at=null,checks=0,last_checked_at=null
    returning * into c;
  end if;
  return jsonb_build_object('version','haze-auth-v1','audience','https://pepecoinhub.com',
    'network','pepecoin-mainnet','purpose','Link Haze Wallet to PepecoinHub','nonce',c.nonce,
    'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create or replace function public.haze_link_context(p_user uuid,p_nonce text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c games.haze_challenges;
begin
  if not games.haze_open(p_user) or games.discord_identity(p_user) is null then raise exception 'Haze linking unavailable.'; end if;
  select * into c from games.haze_challenges where user_id=p_user and nonce=p_nonce and used_at is null and expires_at>clock_timestamp() for update;
  if not found then raise exception 'This wallet-link request expired or was already used.'; end if;
  if c.checks>=5 or c.last_checked_at>clock_timestamp()-interval '1 second' then raise exception 'Too many ownership checks. Start a fresh connection later.'; end if;
  update games.haze_challenges set checks=checks+1,last_checked_at=clock_timestamp() where user_id=p_user;
  return jsonb_build_object('version','haze-auth-v1','audience','https://pepecoinhub.com','network','pepecoin-mainnet',
    'purpose','Link Haze Wallet to PepecoinHub','nonce',c.nonce,
    'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create or replace function public.haze_link_finish(p_user uuid,p_nonce text,p_address text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not games.haze_open(p_user) or games.discord_identity(p_user) is null then raise exception 'Haze linking unavailable.'; end if;
  -- The edge verifier calls this only after checking the exact signature and checksum.
  update games.haze_challenges set used_at=clock_timestamp()
    where user_id=p_user and nonce=p_nonce and used_at is null and expires_at>clock_timestamp();
  if not found then raise exception 'This wallet-link request was already used.'; end if;
  insert into games.haze_links(user_id,address) values(p_user,p_address)
    on conflict(user_id) do update set address=excluded.address,linked_at=clock_timestamp();
  insert into games.passport_badges(user_id,badge_id) values(p_user,'haze_linked') on conflict do nothing;
  return jsonb_build_object('address',p_address,'badge','haze_linked');
end $$;
create or replace function public.gry_haze_unlink() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'Sign in first.'; end if;
  delete from games.haze_links where user_id=u;
  delete from games.haze_challenges where user_id=u;
  delete from games.passport_badges where user_id=u and badge_id='haze_linked';
  return jsonb_build_object('unlinked',true);
end $$;
commit;
