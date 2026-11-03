-- Pepecoin Hub: @mentions in the lobby chat (PEP Games lobby and LAN Party in PondOS).
-- Run ONCE in Supabase → SQL Editor (New query → paste all → Run). Safe to run again.
--  • only verified (Discord) players can mention, and only verified players can be mentioned
--  • "@Nick" in a message from a verified player creates a mention for the player with that reserved nickname
--  • up to 3 people per message and 15 mentions per 10 minutes per sender; nobody mentions themselves
--  • a player can switch mentions off (gry_mention_optout); mentions disappear with their message after 24 h

create table if not exists games.lobby_mentions (
  id bigint generated always as identity primary key,
  msg_id bigint not null references games.lobby_chat(id) on delete cascade,
  to_user uuid not null,
  from_user uuid not null,
  from_nick text not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists lobby_mentions_to on games.lobby_mentions (to_user, created_at);
create index if not exists lobby_mentions_from on games.lobby_mentions (from_user, created_at);
alter table games.lobby_mentions enable row level security;

create table if not exists games.mention_optout (user_id uuid primary key, at timestamptz not null default now());
alter table games.mention_optout enable row level security;

-- After a message is saved: find "@Nick" for reserved (Discord) nicknames. Longest nicknames first, so
-- "@Big Frog" is Big Frog and not also "Big".
create or replace function games.lobby_mentions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rest text; p record; n int := 0; recent int; d jsonb;
begin
  if not new.verified then return new; end if;
  d := games.discord_identity(new.user_id);
  if d is null then return new; end if;
  -- a Discord player who only chats (never joined a room) gets the chat nickname reserved here,
  -- so others can @mention them (the chat already checked the name is free)
  insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
  values (new.user_id, new.nick, games.nick_key(new.nick), d->>'id', d->>'name')
  on conflict do nothing;
  if position('@' in new.body) = 0 then return new; end if;
  select count(*) into recent from games.lobby_mentions where from_user = new.user_id and created_at > now() - interval '10 minutes';
  if recent >= 15 then return new; end if;
  rest := lower(new.body);
  for p in
    select pr.user_id, pr.nick from games.profiles pr
     where pr.user_id <> new.user_id
       and position('@' || lower(pr.nick) in rest) > 0
       and not exists (select 1 from games.mention_optout o where o.user_id = pr.user_id)
     order by char_length(pr.nick) desc
     limit 20
  loop
    exit when n >= 3 or recent + n >= 15;
    -- the nickname must end there: "@Bob" does not mention "Bobby"
    if rest ~ ('@' || regexp_replace(lower(p.nick), '([.\-])', '\\\1', 'g') || '($|[^a-z0-9ąćęłńóśźż_.\-])') then
      insert into games.lobby_mentions(msg_id, to_user, from_user, from_nick) values (new.id, p.user_id, new.user_id, new.nick);
      n := n + 1;
      rest := replace(rest, '@' || lower(p.nick), ' ');
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists lobby_mentions_ai on games.lobby_chat;
-- (trigger is created again just below)
create trigger lobby_mentions_ai after insert on games.lobby_chat
  for each row execute function games.lobby_mentions_after_insert();

-- My mentions from the last 24 hours that I have not seen yet (and my reserved nickname, so the page can
-- highlight messages for me). Guests and visitors get an empty list.
create or replace function public.gry_my_mentions() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then
    return jsonb_build_object('verified', false, 'nick', null, 'optout', false, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'verified', true,
    'nick', (select nick from games.profiles where user_id = u),
    'optout', exists (select 1 from games.mention_optout where user_id = u),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'msg_id', m.msg_id, 'from', m.from_nick, 'body', c.body, 'at', m.created_at) order by m.id)
                         from (select * from games.lobby_mentions where to_user = u and seen_at is null and created_at > now() - interval '24 hours'
                                order by id desc limit 20) m
                         join games.lobby_chat c on c.id = m.msg_id and c.hidden_at is null), '[]'::jsonb));
end $$;

-- Mark my mentions up to p_upto as seen (null = all)
create or replace function public.gry_mentions_seen(p_upto bigint default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  update games.lobby_mentions set seen_at = now()
   where to_user = auth.uid() and seen_at is null and (p_upto is null or id <= p_upto);
end $$;

-- Switch mentions of me off (true) or on again (false)
create or replace function public.gry_mention_optout(p_off boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Log in with Discord first'; end if;
  if p_off then insert into games.mention_optout(user_id) values (u) on conflict (user_id) do nothing;
  else delete from games.mention_optout where user_id = u; end if;
  return p_off;
end $$;

-- Name suggestions after "@" (verified players only). People who wrote in the chat today come first.
create or replace function public.gry_mention_names(p_q text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); q text := lower(left(trim(coalesce(p_q, '')), 20));
begin
  if u is null or games.discord_identity(u) is null then return '[]'::jsonb; end if;
  q := replace(replace(replace(q, '\', ''), '%', ''), '_', '\_');
  return coalesce((select jsonb_agg(x.nick order by x.active desc, x.nick) from (
    select pr.nick, exists (select 1 from games.lobby_chat c where c.user_id = pr.user_id and c.created_at > now() - interval '24 hours') active
      from games.profiles pr
     where pr.user_id <> u and lower(pr.nick) like q || '%'
       and not exists (select 1 from games.mention_optout o where o.user_id = pr.user_id)
     order by 2 desc, pr.nick limit 8) x), '[]'::jsonb);
end $$;

revoke all on function games.lobby_mentions_after_insert() from public;
revoke all on function public.gry_my_mentions(), public.gry_mentions_seen(bigint), public.gry_mention_optout(boolean),
  public.gry_mention_names(text) from public, anon;
grant execute on function public.gry_my_mentions(), public.gry_mentions_seen(bigint), public.gry_mention_optout(boolean),
  public.gry_mention_names(text) to authenticated;

-- Discord players who wrote in the chat in the last 24 hours but never joined a room: reserve their latest chat
-- nickname now, so they can be mentioned right away.
insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
select distinct on (c.user_id) c.user_id, c.nick, games.nick_key(c.nick), x.d->>'id', x.d->>'name'
  from games.lobby_chat c
  cross join lateral (select games.discord_identity(c.user_id) d) x
 where c.verified and x.d is not null
   and not exists (select 1 from games.profiles pr where pr.user_id = c.user_id)
 order by c.user_id, c.id desc
on conflict do nothing;
