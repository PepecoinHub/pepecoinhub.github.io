-- Chat moderators (owner, 2026-11-22): trusted frens who may delete messages and mute players in the lobby chat
-- (PondOS LAN Party and the Games lobby). Nothing else: no host tools, no Pepe Guesser payouts or settings, no games.
-- Hosts keep every power they had. A moderator cannot delete a host's or another moderator's message, cannot mute
-- them, and mutes for at most 72 hours. Every moderator action is written to games.mod_log for the owner.
-- Add or remove moderators with games/supabase/community-v1/chat-mods-add.sql and chat-mods-remove.sql.
-- Run once in the Supabase SQL editor, after update_open_chat.sql and update_lobby_everyone.sql. Safe to run again.
begin;
create table if not exists games.chat_mods(
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text not null default '',
  added_at timestamptz not null default now()
);
create table if not exists games.mod_log(
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  mod_id uuid,
  mod_nick text,
  action text not null,
  target_id uuid,
  target_nick text,
  body text
);
alter table games.chat_mods enable row level security;
alter table games.mod_log enable row level security;
revoke all on games.chat_mods, games.mod_log from public, anon, authenticated;

create or replace function games.is_chat_mod(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and (games.is_host_user(u) or exists (select 1 from games.chat_mods m where m.user_id = u))
$$;
revoke all on function games.is_chat_mod(uuid) from public, anon, authenticated;

-- Delete (hide) one message.
create or replace function public.gry_lobby_hide(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); m games.lobby_chat; host boolean := games.is_host_user(auth.uid());
begin
  if not games.is_chat_mod(u) then raise exception 'Only hosts and chat moderators can do this'; end if;
  select * into m from games.lobby_chat where id = p_id;
  if m.id is null then return; end if;
  if not host and m.user_id is not null and m.user_id <> u and games.is_chat_mod(m.user_id) then
    raise exception 'Moderators cannot delete a host''s or another moderator''s message'; end if;
  update games.lobby_chat set hidden_at = now() where id = p_id and hidden_at is null;
  if found and not host then
    insert into games.mod_log(mod_id, mod_nick, action, target_id, target_nick, body)
    values (u, (select nick from games.profiles where user_id = u), 'delete', m.user_id, m.nick, left(m.body, 200));
  end if;
end $$;

-- Mute the author of a message (account and network) and hide their messages from the last 24 hours.
create or replace function public.gry_lobby_mute_msg(p_id bigint, p_hours int default 24) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); m games.lobby_chat; t timestamptz; host boolean := games.is_host_user(auth.uid()); hrs int;
begin
  if not games.is_chat_mod(u) then raise exception 'Only hosts and chat moderators can do this'; end if;
  select * into m from games.lobby_chat where id = p_id;
  if m.id is null then raise exception 'That message is gone already'; end if;
  if m.user_id is not null and games.is_chat_mod(m.user_id) and not host then
    raise exception 'Moderators cannot mute a host or another moderator'; end if;
  if m.user_id = u then raise exception 'You cannot mute yourself'; end if;
  hrs := least(greatest(coalesce(p_hours, 24), 1), case when host then 720 else 72 end);
  t := now() + make_interval(hours => hrs);
  if m.user_id is not null then
    insert into games.lobby_mutes(user_id, until, reason) values (m.user_id, t, case when host then 'host' else 'moderator' end)
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
  end if;
  if m.ip_hash is not null then
    insert into games.lobby_ip_mutes(ip_hash, until, reason) values (m.ip_hash, t, case when host then 'host' else 'moderator' end)
    on conflict (ip_hash) do update set until = excluded.until, reason = excluded.reason;
  end if;
  update games.lobby_chat set hidden_at = now()
   where hidden_at is null and created_at > now() - interval '24 hours'
     and ((m.user_id is not null and user_id = m.user_id) or (m.ip_hash is not null and ip_hash = m.ip_hash));
  if not host then
    insert into games.mod_log(mod_id, mod_nick, action, target_id, target_nick, body)
    values (u, (select nick from games.profiles where user_id = u), 'mute ' || hrs || ' h', m.user_id, m.nick, left(m.body, 200));
  end if;
end $$;

-- The chat feed: same as update_lobby_everyone.sql, but moderators also get the Delete / Mute buttons (can_mod).
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
    'can_mod', u is not null and games.is_chat_mod(u),
    'hidden', coalesce((select jsonb_agg(id) from games.lobby_chat where hidden_at is not null and id <= coalesce(p_after, 0)
                          and created_at > now() - interval '24 hours'), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'user_id', q.user_id, 'nick', q.nick, 'verified', q.verified,
                                                              'body', q.body, 'at', q.created_at, 'broadcast', q.broadcast) order by q.id)
                          from (select * from games.lobby_chat
                                 where id > coalesce(p_after, 0) and hidden_at is null and created_at > now() - interval '24 hours'
                                 order by id desc limit 50) q), '[]'::jsonb));
end $$;

revoke all on function public.gry_lobby_chat(bigint, text), public.gry_lobby_hide(bigint), public.gry_lobby_mute_msg(bigint, int) from public, anon;
grant execute on function public.gry_lobby_chat(bigint, text) to anon, authenticated;
grant execute on function public.gry_lobby_hide(bigint), public.gry_lobby_mute_msg(bigint, int) to authenticated;
commit;
