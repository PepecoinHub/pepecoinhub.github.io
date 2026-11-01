-- Lobby chat (PEP Games and the PondOS "LAN Party"): writing without signing in.
-- Run once in the Supabase SQL editor after update_lobby_chat.sql. Safe to run again.
--
-- A visitor with no session can write with a nickname. Such a message has no user_id; it is tied to
-- a salted hash of the network address (games.client_ip_hash), which is deleted with the message after 24 h.
-- Protection for writers without an account:
--   * a network address is required (no address, no anonymous message);
--   * the same limits as signed-in players, counted per network: 3 s between messages, 20 per 5 min;
--   * all anonymous writers together: at most 120 messages per 10 min;
--   * the same nickname, link, seed-phrase and blocked-word filters; a nickname reserved by a
--     verified (Discord) player cannot be used;
--   * blocked words mute the network for 24 h; the host can mute a network from any message.

alter table games.lobby_chat alter column user_id drop not null;
alter table games.lobby_chat add column if not exists ip_hash text;
create index if not exists lobby_chat_ip on games.lobby_chat (ip_hash, created_at);

create table if not exists games.lobby_ip_mutes (          -- networks muted in the lobby chat
  ip_hash text primary key,
  until   timestamptz not null,
  reason  text
);
alter table games.lobby_ip_mutes enable row level security;
revoke all on games.lobby_ip_mutes from public, anon, authenticated;

create or replace function games.lobby_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update games.config set lobby_cleanup_at = now()
   where id = 1 and (lobby_cleanup_at is null or lobby_cleanup_at < now() - interval '60 seconds');
  if not found then return; end if;
  delete from games.lobby_chat where created_at < now() - interval '24 hours';
  delete from games.lobby_seen where seen_at < now() - interval '10 minutes';
  delete from games.lobby_mutes where until < now();
  delete from games.lobby_ip_mutes where until < now();
end $$;

-- Reading: unchanged, except that "muted_until" also covers a muted network
create or replace function public.gry_lobby_chat(p_after bigint default 0, p_visitor text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); v text := left(trim(coalesce(p_visitor, '')), 40); ip text := games.client_ip_hash();
begin
  perform games.lobby_cleanup();
  if v ~ '^[A-Za-z0-9-]{8,40}$' then
    insert into games.lobby_seen(visitor, user_id, seen_at) values (v, u, now())
    on conflict (visitor) do update set seen_at = now(), user_id = coalesce(excluded.user_id, games.lobby_seen.user_id)
     where games.lobby_seen.seen_at < now() - interval '15 seconds';
  end if;
  return jsonb_build_object(
    'now', now(),
    'online', (select count(*) from games.lobby_seen where seen_at > now() - interval '90 seconds'),
    'muted_until', (select max(t) from (
                      select until t from games.lobby_mutes where user_id = u and until > now()
                      union all select until from games.lobby_ip_mutes where ip is not null and ip_hash = ip and until > now()) x),
    'can_mod', u is not null and games.is_host_user(u),
    'hidden', coalesce((select jsonb_agg(id) from games.lobby_chat where hidden_at is not null and id <= coalesce(p_after, 0)
                          and created_at > now() - interval '24 hours'), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'user_id', q.user_id, 'nick', q.nick, 'verified', q.verified,
                                                              'body', q.body, 'at', q.created_at) order by q.id)
                          from (select * from games.lobby_chat
                                 where id > coalesce(p_after, 0) and hidden_at is null and created_at > now() - interval '24 hours'
                                 order by id desc limit 50) q), '[]'::jsonb));
end $$;

-- Writing: signed in (guest or Discord) as before, or with no session at all (a nickname, limited per network)
create or replace function public.gry_lobby_say(p_text text, p_nick text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ip text := games.client_ip_hash();
        txt text := trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
        nick text := trim(coalesce(p_nick, '')); d jsonb; prof games.profiles; is_ver boolean := false; k text;
        last_at timestamptz; n5 int; mu timestamptz; m games.lobby_chat;
begin
  if u is null and ip is null then raise exception 'Pick a nickname or log in with Discord to chat'; end if;
  select until into mu from games.lobby_mutes where u is not null and user_id = u and until > now();
  if mu is null then select until into mu from games.lobby_ip_mutes where ip is not null and ip_hash = ip and until > now(); end if;
  if mu is not null then raise exception 'You are muted in the lobby chat for now'; end if;
  if txt = '' then return null; end if;
  if char_length(txt) > 200 then raise exception 'Messages can be up to 200 characters'; end if;

  if u is not null then
    d := games.discord_identity(u);
    is_ver := d is not null;
    if is_ver then
      select * into prof from games.profiles where user_id = u;
      if prof.user_id is not null then nick := prof.nick; end if;
    end if;
  end if;
  if nick = '' then raise exception 'Pick a nickname first'; end if;
  if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]{2,20}$' then
    raise exception 'Nickname: 2–20 characters, letters, digits, space, _ . -'; end if;
  if games.is_profane(nick) or games.is_blocked(nick) then raise exception 'That nickname did not pass the filter. Pick another one.'; end if;
  k := games.nick_key(nick);
  if char_length(k) < 2 then raise exception 'Nickname is too short'; end if;
  if exists (select 1 from games.profiles where nick_key = k and (u is null or user_id <> u)) then
    raise exception 'That nickname is reserved by a verified (Discord) player'; end if;

  -- parallel sends from one player (or one network, without an account) are counted one after another
  perform pg_advisory_xact_lock(hashtext('lobbychat:' || coalesce(u::text, 'ip:' || ip)));
  if u is not null then
    select max(created_at), count(*) into last_at, n5 from games.lobby_chat where user_id = u and created_at > now() - interval '5 minutes';
  else
    select max(created_at), count(*) into last_at, n5 from games.lobby_chat where user_id is null and ip_hash = ip and created_at > now() - interval '5 minutes';
    if (select count(*) from games.lobby_chat where user_id is null and created_at > now() - interval '10 minutes') >= 120 then
      raise exception 'The chat is very busy right now. Log on (guest or Discord) to keep writing'; end if;
  end if;
  if last_at is not null and last_at > now() - interval '3 seconds' then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from last_at + interval '3 seconds' - now()))::int); end if;
  if n5 >= 20 then raise exception 'Slow down: up to 20 messages in 5 minutes'; end if;

  if txt ~* '(https?://|www\.|discord\.gg|t\.me/|\m[a-z0-9-]+\.(com|net|org|io|xyz|gg|me|ly|co|ru|app|link|site|top|info|biz|online|live|fun|finance|exchange|money|pro|vip|cc|to)\M)' then
    raise exception 'Links are not allowed in the lobby chat'; end if;
  if games.norm(txt) ~ '(seedphrase|seedwords|recoveryphrase|secretphrase|privatekey|mnemonic|walletpassword|frazaseed|kluczprywatny|haslodoportfela)' then
    raise exception 'For your safety, messages about seed phrases, private keys or wallet passwords are blocked. Never share them with anyone.'; end if;
  if games.is_blocked(txt) then
    if u is not null then
      insert into games.lobby_mutes(user_id, until, reason) values (u, now() + interval '24 hours', 'blocked words')
      on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
    end if;
    if ip is not null then
      insert into games.lobby_ip_mutes(ip_hash, until, reason) values (ip, now() + interval '24 hours', 'blocked words')
      on conflict (ip_hash) do update set until = excluded.until, reason = excluded.reason;
    end if;
    -- no exception here: it would undo the mute. The page shows "error" like any other refusal.
    return jsonb_build_object('error', 'That message is not allowed here. You are muted in the lobby chat for 24 hours.');
  end if;

  insert into games.lobby_chat(user_id, nick, verified, body, ip_hash) values (u, nick, is_ver, games.clean_text(txt), ip) returning * into m;
  return jsonb_build_object('id', m.id, 'user_id', m.user_id, 'nick', m.nick, 'verified', m.verified, 'body', m.body, 'at', m.created_at);
end $$;

-- Host: mute whoever wrote this message (the account, and the network it came from) and hide their messages from today
create or replace function public.gry_lobby_mute_msg(p_id bigint, p_hours int default 24) returns void
language plpgsql security definer set search_path = '' as $$
declare m games.lobby_chat; t timestamptz;
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  select * into m from games.lobby_chat where id = p_id;
  if m.id is null then raise exception 'That message is gone already'; end if;
  t := now() + make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720));
  if m.user_id is not null then
    insert into games.lobby_mutes(user_id, until, reason) values (m.user_id, t, 'host')
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
  end if;
  if m.ip_hash is not null then
    insert into games.lobby_ip_mutes(ip_hash, until, reason) values (m.ip_hash, t, 'host')
    on conflict (ip_hash) do update set until = excluded.until, reason = excluded.reason;
  end if;
  update games.lobby_chat set hidden_at = now()
   where hidden_at is null and created_at > now() - interval '24 hours'
     and ((m.user_id is not null and user_id = m.user_id) or (m.ip_hash is not null and ip_hash = m.ip_hash));
end $$;

revoke all on function public.gry_lobby_chat(bigint, text), public.gry_lobby_say(text, text), public.gry_lobby_mute_msg(bigint, int) from public, anon;
grant execute on function public.gry_lobby_chat(bigint, text), public.gry_lobby_say(text, text) to anon, authenticated;
grant execute on function public.gry_lobby_mute_msg(bigint, int) to authenticated;
