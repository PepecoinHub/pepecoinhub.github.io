-- A guest who connects Discord keeps the same auth user (linkIdentity). Pepe Guesser points already
-- follow that user_id. The nick text and verified flag on the old rows do not: they still say Frog8415
-- and verified = false, so the boards skip them.
--
-- Run once in the Supabase SQL editor, after update_wheres_pepe_guests.sql. Safe to run again.
-- The browser calls public.gry_adopt_guest_rows() (PostgREST exposes public). That only runs
-- games.adopt_my_guest_rows(). It never reads a user id from the client and never touches another user's rows.
--
-- Supabase Auth "Allow manual linking" (GOTRUE_SECURITY_MANUAL_LINKING_ENABLED) must be ON, or the
-- browser cannot link Discord and falls back to a new account. This function does not merge two accounts.

create or replace function games.adopt_my_guest_rows() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb;
  prof games.profiles;
  nick text;
  k text;
  base text;
  try text;
  n int := 0;
  n_plays int := 0;
  n_claims int := 0;
  made boolean := false;
begin
  if u is null then
    raise exception 'Log on with Discord first';
  end if;
  -- auth.users is the source of truth: after a successful link, is_anonymous is false.
  if coalesce((select au.is_anonymous from auth.users au where au.id = u), true) then
    raise exception 'Connect Discord on this guest before keeping its scores';
  end if;
  d := games.discord_identity(u);
  if d is null then
    raise exception 'Discord is not linked to this account';
  end if;

  select * into prof from games.profiles where user_id = u;
  if prof.user_id is null then
    -- Discord display name, stripped to the characters the games already allow in a nickname.
    nick := btrim(regexp_replace(regexp_replace(coalesce(d->>'name', ''),
      '[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż ._-]', '', 'g'), '[[:space:]]+', ' ', 'g'));
    nick := btrim(left(nick, 20));
    if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż ._-]{2,20}$' or games.is_profane(nick) then
      nick := 'Fren';
    end if;
    base := nick;
    loop
      try := case when n = 0 then base
                  else btrim(left(base, greatest(1, 20 - char_length(n::text) - 1))) || '-' || n::text end;
      if try !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż ._-]{2,20}$' then
        try := 'Fren-' || n::text;
      end if;
      k := games.nick_key(try);
      exit when char_length(k) >= 2
        and not exists (select 1 from games.profiles p where p.nick_key = k and p.user_id <> u);
      n := n + 1;
      if n > 99 then
        raise exception 'Could not reserve a nickname';
      end if;
    end loop;
    insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
    values (u, try, k, d->>'id', d->>'name');
    made := true;
    select * into prof from games.profiles where user_id = u;
  end if;

  -- Own rows only. Claims keep address, status, pep, txid and paid_at.
  update games.wp_plays w
     set nick = prof.nick, verified = true
   where w.user_id = u;
  get diagnostics n_plays = row_count;

  update games.wp_claims c
     set nick = prof.nick, verified = true
   where c.user_id = u;
  get diagnostics n_claims = row_count;

  return jsonb_build_object(
    'nick', prof.nick,
    'plays', n_plays,
    'claims', n_claims,
    'profile', case when made then 'created' else 'kept' end);
end
$$;

revoke all on function games.adopt_my_guest_rows() from public, anon, authenticated;

create or replace function public.gry_adopt_guest_rows() returns jsonb
language sql security definer set search_path = '' as $$
  select games.adopt_my_guest_rows()
$$;

revoke all on function public.gry_adopt_guest_rows() from public, anon;
grant execute on function public.gry_adopt_guest_rows() to authenticated;
