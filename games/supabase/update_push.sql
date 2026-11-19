-- PondOS push notifications (phone / computer notifications even when PondOS is closed).
-- Run ONCE in Supabase > SQL Editor (New query > paste all > Run). Safe to run again.
-- Run it AFTER update_lobby_everyone.sql, update_gazette_newsroom.sql, update_lilies.sql and update_pond_king.sql
-- (a part whose table is not installed yet is skipped; run this file again after installing it).
--
-- How it works
--   * The browser asks the fren, then saves its push address here (games.push_subs) together with the fren's
--     choices: which kinds of news they want. Nothing is ever sent without that choice, and "Off" deletes the row.
--   * Server events (a mention, Byl's @everyone, a new Gazette issue, a challenge) put ONE row in games.push_outbox.
--     The browser can never write there: only the triggers below can.
--   * Each new row rings the Edge Function "push-send" (pg_net). The function holds the PRIVATE push key
--     (Supabase secret VAPID_PRIVATE_KEY, never in this database or on the site), takes the waiting rows,
--     encrypts each note for each subscribed device and hands it to Google / Apple / Mozilla / Microsoft.
--   * Limits: @everyone at most once per hour as a push (the chat ping itself is not limited), "new challenge on
--     the board" at most once per 30 minutes. Mentions respect "Mentions off" (games.mention_optout).
--
-- After running: fill games.push_config (see the end of this file).

create table if not exists games.push_config (
  id            int primary key default 1 check (id = 1),
  fn_url        text,          -- https://<project>.supabase.co/functions/v1/push-send
  fn_secret     text,          -- the same long random text as the Edge Function secret PUSH_SECRET
  vapid_public  text,          -- the PUBLIC push key (the private one lives only in the Edge Function)
  everyone_gap  interval not null default interval '1 hour',
  challenge_gap interval not null default interval '30 minutes'
);
insert into games.push_config (id) values (1) on conflict do nothing;
alter table games.push_config enable row level security;
revoke all on games.push_config from public, anon, authenticated;

-- one row per device (browser / installed app) that said yes
create table if not exists games.push_subs (
  endpoint   text primary key,           -- the push service address of that device
  p256dh     text not null,              -- the device's public key (encrypts the note so only it can read it)
  auth       text not null,              -- the device's secret for the same encryption
  user_id    uuid,                       -- signed in (Discord or guest) when it last saved; null = not signed in
  prefs      jsonb not null default '{}'::jsonb,
  ip_hash    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fails      int not null default 0
);
create index if not exists push_subs_user on games.push_subs (user_id);
alter table games.push_subs enable row level security;
revoke all on games.push_subs from public, anon, authenticated;

create table if not exists games.push_outbox (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('mention', 'everyone', 'gazette', 'challenge_new', 'challenge_mine')),
  to_user    uuid,                       -- set: only this fren's devices; null: everyone who wants this kind
  not_user   uuid,                       -- never this fren (the sender)
  title      text not null,
  body       text not null default '',
  url        text not null default '/meme/',
  tag        text not null default 'pondos',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists push_outbox_wait on games.push_outbox (id) where claimed_at is null;
create index if not exists push_outbox_kind on games.push_outbox (kind, created_at desc);
alter table games.push_outbox enable row level security;
revoke all on games.push_outbox from public, anon, authenticated;

-- the kinds a fren can choose; anything else in prefs is dropped
create or replace function games.push_clean_prefs(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'mention',        coalesce((p ->> 'mention')::boolean, true),
    'everyone',       coalesce((p ->> 'everyone')::boolean, true),
    'gazette',        coalesce((p ->> 'gazette')::boolean, true),
    'challenge_mine', coalesce((p ->> 'challenge_mine')::boolean, true),
    'challenge_new',  coalesce((p ->> 'challenge_new')::boolean, false))
$$;

-- The one way into the outbox (server only). Throttles the "for everyone" kinds and rings the Edge Function.
create or replace function games.push_enqueue(p_kind text, p_to uuid, p_not uuid, p_title text, p_body text, p_url text, p_tag text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c games.push_config;
begin
  select * into c from games.push_config where id = 1;
  if p_kind = 'everyone' and exists (select 1 from games.push_outbox where kind = 'everyone'
       and created_at > now() - coalesce(c.everyone_gap, interval '1 hour')) then return false; end if;
  if p_kind = 'challenge_new' and exists (select 1 from games.push_outbox where kind = 'challenge_new'
       and created_at > now() - coalesce(c.challenge_gap, interval '30 minutes')) then return false; end if;
  insert into games.push_outbox (kind, to_user, not_user, title, body, url, tag)
  values (p_kind, p_to, p_not, left(coalesce(p_title, 'PondOS 98'), 80), left(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'), 160),
          coalesce(p_url, '/meme/'), coalesce(p_tag, 'pondos'));
  delete from games.push_outbox where created_at < now() - interval '7 days';
  -- ring the sender; if pg_net or the settings are missing, the note just waits for the next ring
  if c.fn_url like 'https://%' and coalesce(length(c.fn_secret), 0) >= 24
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    begin
      execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2, timeout_milliseconds := 5000)'
        using c.fn_url, jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.fn_secret);
    exception when others then null;
    end;
  end if;
  return true;
end $$;
revoke all on function games.push_enqueue(text, uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- the browser's side (anyone may call)

-- the public key the browser needs to subscribe; null = not set up yet
create or replace function public.gry_push_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('key', (select vapid_public from games.push_config where id = 1))
$$;

-- Save (or update) this device. Only real push services are accepted, so the sender can never be pointed
-- at another address. Returns the saved choices.
create or replace function public.gry_push_save(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ip text := games.client_ip_hash(); pr jsonb := games.push_clean_prefs(coalesce(p_prefs, '{}'::jsonb));
begin
  if p_endpoint is null or length(p_endpoint) > 600 or p_endpoint !~ ('^https://(fcm\.googleapis\.com|android\.googleapis\.com|'
       || 'updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|'
       || '[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.push\.apple\.com)/[A-Za-z0-9_./:%~+=-]+$') then
    raise exception 'This browser''s push address is not supported';
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}={0,2}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,32}={0,2}$' then
    raise exception 'Bad push keys';
  end if;
  if not exists (select 1 from games.push_subs where endpoint = p_endpoint)
     and ip is not null and (select count(*) from games.push_subs where ip_hash = ip and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many devices from this network today, try tomorrow';
  end if;
  insert into games.push_subs as s (endpoint, p256dh, auth, user_id, prefs, ip_hash)
  values (p_endpoint, p_p256dh, p_auth, u, pr, ip)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
    user_id = coalesce(excluded.user_id, s.user_id), prefs = excluded.prefs, updated_at = now(), fails = 0;
  return pr;
end $$;

-- the saved choices of this device (null = this device is not subscribed)
create or replace function public.gry_push_get(p_endpoint text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select prefs from games.push_subs where endpoint = p_endpoint
$$;

-- Off: forget this device
create or replace function public.gry_push_delete(p_endpoint text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  delete from games.push_subs where endpoint = p_endpoint;
  return found;
end $$;

-- after logging out on this device: notes meant for that fren stop coming here
create or replace function public.gry_push_forget_user(p_endpoint text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update games.push_subs set user_id = null where endpoint = p_endpoint;
  return found;
end $$;

revoke all on function public.gry_push_info(), public.gry_push_save(text, text, text, jsonb), public.gry_push_get(text),
  public.gry_push_delete(text), public.gry_push_forget_user(text) from public;
grant execute on function public.gry_push_info(), public.gry_push_save(text, text, text, jsonb), public.gry_push_get(text),
  public.gry_push_delete(text), public.gry_push_forget_user(text) to anon, authenticated;

-- ---------------------------------------------------------------- the Edge Function's side (service role only)

-- Take up to p_limit waiting notes (each is taken once) with the devices that want each one.
create or replace function public.push_take(p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  with taken as (
    update games.push_outbox o set claimed_at = now()
     where o.id in (select id from games.push_outbox where claimed_at is null and created_at > now() - interval '1 day'
                     order by id limit least(greatest(coalesce(p_limit, 20), 1), 100) for update skip locked)
    returning o.*)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'kind', t.kind,
           'note', jsonb_build_object('title', t.title, 'body', t.body, 'url', t.url, 'tag', t.tag, 'kind', t.kind),
           'to', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                             from games.push_subs s
                            where coalesce((s.prefs ->> t.kind)::boolean, false)
                              and (t.to_user is null or s.user_id = t.to_user)
                              and (t.not_user is null or s.user_id is distinct from t.not_user)
                              and (t.kind not in ('mention', 'everyone') or s.user_id is null
                                   or not exists (select 1 from games.mention_optout m where m.user_id = s.user_id))), '[]'::jsonb)) order by t.id), '[]'::jsonb)
    into res from taken t;
  return res;
end $$;

-- the push service said this device is gone (404/410): forget it. Other errors: count, and forget after 20.
create or replace function public.push_report(p_gone text[], p_failed text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from games.push_subs where endpoint = any(coalesce(p_gone, '{}'));
  update games.push_subs set fails = fails + 1 where endpoint = any(coalesce(p_failed, '{}'));
  delete from games.push_subs where fails >= 20;
end $$;

revoke all on function public.push_take(int), public.push_report(text[], text[]) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.push_take(int), public.push_report(text[], text[]) to service_role;
  end if;
end $$;

-- ---------------------------------------------------------------- what makes a note

-- a mention in the LAN Party / lobby chat (the server already decided who is really mentioned)
create or replace function games.push_on_mention() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  select body, coalesce(broadcast, false) as broadcast into m from games.lobby_chat where id = new.msg_id;
  if not found or m.broadcast then return new; end if;   -- @everyone has its own single note below
  perform games.push_enqueue('mention', new.to_user, new.from_user, new.from_nick || ' mentioned you in the pond chat',
                             m.body, '/meme/#lan', 'mention');
  return new;
end $$;

-- Byl's @everyone: one note for every device with "@everyone" switched on (and mentions not switched off)
create or replace function games.push_on_broadcast() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.broadcast, false) then
    perform games.push_enqueue('everyone', null, new.user_id, new.nick || ' to everyone in the pond chat', new.body, '/meme/#lan', 'everyone');
  end if;
  return new;
end $$;

-- a new Pond Gazette issue goes out (published now, not a draft)
create or replace function games.push_on_gazette() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.published_at is not null and new.published_at <= now() + interval '5 minutes'
     and (tg_op = 'INSERT' or old.published_at is null) then
    perform games.push_enqueue('gazette', null, null, 'The Pond Gazette No. ' || new.num || ' is out',
                               coalesce(nullif(btrim(new.title), ''), 'Fresh news from the pond'), '/meme/#gazette=' || new.num, 'gazette');
  end if;
  return new;
end $$;

-- THREE LILIES: a new open challenge (for everyone who wants those) and "your challenge was played" (for its creator)
create or replace function games.push_on_lily() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    perform games.push_enqueue('challenge_new', null, new.creator, new.creator_nick || ' threw down a challenge',
                               'Battle of Three Lilies: 10 flies, 3 lily pads. Who takes it?', '/meme/#lilies=' || new.id, 'lily-new');
  elsif tg_op = 'UPDATE' and old.status = 'open' and new.status = 'completed' then
    perform games.push_enqueue('challenge_mine', new.creator, null,
      coalesce(new.opponent_nick, 'A fren') || ' took your challenge',
      case new.result when 'creator_win' then 'You won. See how the lily pads fell.'
                      when 'opponent_win' then 'You lost this one. Rematch?' else 'It''s a draw.' end,
      '/meme/#lilies=' || new.id, 'lily-' || new.id);
  end if;
  return new;
end $$;

-- POND KING: the king hears when the crown is lost or defended
create or replace function games.push_on_bulletin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'king_crowned' and new.other_user is not null then
    perform games.push_enqueue('challenge_mine', new.other_user, null, 'You lost the Pond King crown',
                               new.actor_nick || ' took the throne. Take it back?', '/meme/#king', 'king');
  elsif new.kind = 'king_defended' and new.actor_user is not null then
    perform games.push_enqueue('challenge_mine', new.actor_user, null, 'You defended the crown',
                               coalesce(new.other_nick, 'A fren') || ' challenged you and lost.', '/meme/#king', 'king');
  end if;
  return new;
end $$;

revoke all on function games.push_clean_prefs(jsonb), games.push_on_mention(), games.push_on_broadcast(), games.push_on_gazette(),
  games.push_on_lily(), games.push_on_bulletin() from public, anon, authenticated;

-- hook them up where the tables exist
do $$ begin
  if to_regclass('games.lobby_mentions') is not null then
    drop trigger if exists push_mention_ai on games.lobby_mentions;
    create trigger push_mention_ai after insert on games.lobby_mentions for each row execute function games.push_on_mention();
  end if;
  if to_regclass('games.lobby_chat') is not null and exists (select 1 from information_schema.columns
       where table_schema = 'games' and table_name = 'lobby_chat' and column_name = 'broadcast') then
    drop trigger if exists push_broadcast_ai on games.lobby_chat;
    create trigger push_broadcast_ai after insert on games.lobby_chat for each row execute function games.push_on_broadcast();
  end if;
  if to_regclass('games.gazette_issues') is not null then
    drop trigger if exists push_gazette_aiu on games.gazette_issues;
    create trigger push_gazette_aiu after insert or update of published_at on games.gazette_issues
      for each row execute function games.push_on_gazette();
  end if;
  if to_regclass('games.lily_challenges') is not null then
    drop trigger if exists push_lily_aiu on games.lily_challenges;
    create trigger push_lily_aiu after insert or update of status on games.lily_challenges
      for each row execute function games.push_on_lily();
  end if;
  if to_regclass('games.bulletin_events') is not null then
    drop trigger if exists push_bulletin_ai on games.bulletin_events;
    create trigger push_bulletin_ai after insert on games.bulletin_events for each row execute function games.push_on_bulletin();
  end if;
end $$;

-- pg_net rings the Edge Function. On Supabase this switches it on (Database > Extensions shows it as pg_net).
do $$ begin
  create extension if not exists pg_net;
exception when others then raise notice 'pg_net is not available here; notes wait in games.push_outbox';
end $$;

-- ---------------------------------------------------------------- settings (fill once, then run only this part)
-- update games.push_config set
--   fn_url       = 'https://azbwciqfbsdpwubznncg.supabase.co/functions/v1/push-send',
--   fn_secret    = '<the same PUSH_SECRET as in the Edge Function>',
--   vapid_public = '<the PUBLIC key from klucze.html>'
-- where id = 1;
