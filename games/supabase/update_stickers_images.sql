-- PEP Games: naklejki w czacie + pełnej jakości obrazki w Guess the Picture (ponowne wysłanie brakujących kawałków).
-- Uruchom RAZ w Supabase → SQL Editor (New query → wklej całość → Run). Bezpieczne do powtórzenia, nie kasuje żadnych danych.
-- Jeśli Supabase pokaże ostrzeżenie „Potential issues detected”, wybierz „Run and enable RLS” (jak przy schema.sql).

create table if not exists games.stickers (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  label text not null default '',
  enabled boolean not null default true,
  sort int not null default 0
);
alter table games.stickers enable row level security;   -- brak polityk = brak bezpośredniego dostępu z API
insert into games.stickers(id, label, sort) values
  ('frog-chill', 'Chill frog', 1), ('frog-party', 'Party frog', 2), ('frog-winner', 'Winner frog', 3)
on conflict (id) do nothing;
alter table games.config add column if not exists sticker_cooldown_seconds int not null default 3;
alter table games.players add column if not exists last_sticker_at timestamptz;
alter table games.players add column if not exists img_need_at timestamptz;
alter table games.table_members add column if not exists last_sticker_at timestamptz;
alter table games.messages drop constraint if exists messages_kind_check;
alter table games.messages add constraint messages_kind_check check (kind in ('chat','system','correct','sticker'));
alter table games.table_messages drop constraint if exists table_messages_kind_check;
alter table games.table_messages add constraint table_messages_kind_check check (kind in ('chat','system','sticker'));

create or replace function games.sticker_ok(p_id text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(trim(coalesce(p_id, '')));
begin
  if not exists (select 1 from games.stickers s where s.id = v and s.enabled) then raise exception 'Unknown sticker'; end if;
  return v;
end $$;

-- Naklejka w pokoju (Draw & Guess / Guess the Picture). Rysujący / host obrazka nie może wysyłać naklejek w trakcie tury
-- (obrazek mógłby podpowiadać hasło); kto już zgadł, wysyła je tylko do tych, którzy też zgadli — jak zwykły czat.
create or replace function public.gry_room_sticker(p_code text, p_sticker text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; sid text := games.sticker_ok(p_sticker); m jsonb; v_scope text := 'all';
        cd int := greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0);
        scd int := greatest(coalesce((select sticker_cooldown_seconds from games.config where id = 1), 0), 0);
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if r.phase = 'turn' and ((r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host)) then
    raise exception 'No stickers during your turn 🤐'; end if;
  if scd > 0 and me.last_sticker_at is not null and me.last_sticker_at > now() - make_interval(secs => scd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_sticker_at + make_interval(secs => scd) - now()))::int); end if;
  if r.mode = 'kalambury' and cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int); end if;
  if me.last_msg_at is not null and me.last_msg_at > now() - interval '600 milliseconds' then raise exception 'Slow down a little 🙂'; end if;
  if me.msg_window_start is null or me.msg_window_start < now() - interval '10 seconds' then
    update games.players set msg_window_start = now(), msg_window_count = 1, last_msg_at = now(), last_sticker_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  else
    if me.msg_window_count >= 10 then raise exception 'Too many messages. Take a short break.'; end if;
    update games.players set msg_window_count = msg_window_count + 1, last_msg_at = now(), last_sticker_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  end if;
  if r.phase = 'turn' and me.guessed_turn = r.turn_id then v_scope := 'guessed'; end if;
  insert into games.messages(room_code, turn_id, user_id, nick, kind, scope, body)
  values (r.code, r.turn_id, u, me.nick, 'sticker', v_scope, sid)
  returning jsonb_build_object('id', messages.id, 'kind', messages.kind, 'scope', messages.scope, 'nick', messages.nick, 'user_id', messages.user_id, 'body', messages.body, 'at', messages.created_at) into m;
  if v_scope = 'all' then
    perform realtime.send(jsonb_build_object('code', r.code, 'msg', m), 'msg', 'room:' || r.code, true);
  else
    perform realtime.send(jsonb_build_object('code', r.code, 'private', true), 'msg', 'room:' || r.code, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Naklejka przy stole (szachy, warcaby, Connect Four, Sea Battle): ten sam limit co czat przy stole + odstęp naklejek.
create or replace function public.gry_table_sticker(p_code text, p_sticker text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; me games.table_members; sid text := games.sticker_ok(p_sticker); m jsonb;
        cd int := greatest(coalesce((select table_message_cooldown_seconds from games.config where id = 1), 0), 0);
        scd int := greatest(coalesce((select sticker_cooldown_seconds from games.config where id = 1), 0), 0);
begin
  select * into t from games.tables where code = upper(p_code);
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  select * into me from games.table_members where table_code = t.code and user_id = u for update;
  if me.user_id is null or me.left_at is not null then raise exception 'Join the table first'; end if;
  if scd > 0 and me.last_sticker_at is not null and me.last_sticker_at > now() - make_interval(secs => scd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_sticker_at + make_interval(secs => scd) - now()))::int); end if;
  if cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int); end if;
  update games.table_members set last_msg_at = now(), last_sticker_at = now(), last_seen = now() where table_code = t.code and user_id = u;
  insert into games.table_messages(table_code, user_id, nick, kind, body) values (t.code, u, me.nick, 'sticker', sid)
  returning jsonb_build_object('id', table_messages.id, 'kind', table_messages.kind, 'nick', table_messages.nick, 'user_id', table_messages.user_id,
                               'body', table_messages.body, 'at', table_messages.created_at) into m;
  perform realtime.send(jsonb_build_object('code', t.code, 'msg', m), 'msg', 'table:' || t.code, true);
  return jsonb_build_object('ok', true, 'msg', m);
end $$;

-- Guess the Picture: gracz, któremu brakuje kawałków pełnego obrazka, prosi hosta o ich ponowne wysłanie.
-- Kanał img: może pisać tylko host, więc prośba idzie przez serwer (kanał room:, na który klienci nie piszą).
-- Limit: 1 prośba / 2 s na gracza, max 64 numery kawałków.
create or replace function public.gry_img_need(p_code text, p_tid text, p_missing int[]) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; miss int[];
begin
  if p_tid is null or p_tid !~ '^[a-z0-9-]{1,80}$' then raise exception 'Bad request'; end if;
  select array_agg(distinct x order by x) into miss from unnest(coalesce(p_missing, '{}')) x where x between 0 and 63;
  if miss is null or cardinality(miss) = 0 then return; end if;
  select * into r from games.rooms where code = upper(p_code);
  if not found or r.mode <> 'obrazek' then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if me.img_need_at is not null and me.img_need_at > now() - interval '2 seconds' then raise exception 'Slow down a little 🙂'; end if;
  update games.players set img_need_at = now(), last_seen = now() where room_code = r.code and user_id = u;
  perform realtime.send(jsonb_build_object('code', r.code, 'tid', p_tid, 'miss', to_jsonb(miss)), 'imgneed', 'room:' || r.code, true);
end $$;

-- uprawnienia: funkcje pomocnicze nie są wywoływalne z API, nowe funkcje gry_* tylko dla zalogowanych (także gości)
revoke all on function games.sticker_ok(text) from public;
revoke all on function public.gry_room_sticker(text, text) from public, anon;
revoke all on function public.gry_table_sticker(text, text) from public, anon;
revoke all on function public.gry_img_need(text, text, int[]) from public, anon;
grant execute on function public.gry_room_sticker(text, text) to authenticated;
grant execute on function public.gry_table_sticker(text, text) to authenticated;
grant execute on function public.gry_img_need(text, text, int[]) to authenticated;
