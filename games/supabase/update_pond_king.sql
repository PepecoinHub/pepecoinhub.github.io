-- POND KING: an asynchronous rock-paper-scissors "king of the hill" for the meme edition (PondOS 98).
-- Run once in the Supabase SQL editor after schema.sql and update_pond_bulletin.sql. Safe to run again
-- (nothing is deleted).
--
-- Rules
--   * One frog sits on the throne with three secret moves (r = rock, p = paper, s = scissors).
--   * A challenger picks three moves. For every duel the server shuffles the king's three moves into a
--     random order, then plays three rounds. The challenger needs MORE round wins than the king;
--     a tie (1:1, 0:0) keeps the king on the throne.
--   * A winning challenger becomes the new king; their three moves become their defence and they can
--     change them at any time while they reign. A lost duel adds one defence to the king's reign.
--   * ONE DUEL EVERY 4 HOURS: one duel per player (browser token or account) and per network (hashed IP)
--     in any 4 hours, whoever sits on the throne. The clock runs from the last duel.
--   * No limit per king: after the 4-hour wait a player may challenge the same king again (since 2026-11-14)
--     (and a new day). Nobody can challenge themselves.
--   * Fren Passport stamp "Long Live the King": hold one reign against 10 challengers, i.e. 10 duels won in a
--     row as king. Discord accounts only (games.passport_award checks), awarded once, from server records.
--   * The king's moves never leave the database, except to the king (who holds the token) and as the
--     shuffled rounds of a finished duel, which show the challenger only the king's set of moves.
--
-- No sign-in needed: a player is a random token the browser keeps in localStorage. The database keeps only its
-- SHA-256 (with the project salt), the nickname, the moves and a salted IP hash (for the limits).
-- A player who is logged on to the pond (Discord or guest) is also stored under their account: the throne
-- follows them to other devices, the name comes from games.valid_nick, and a Discord king gets a Fren
-- Passport link. New kings and long reigns go to the POND BULLETIN (games.bulletin_post).
-- The tables are reachable only through the functions below.

create table if not exists games.pk_kings (
  id          bigint generated always as identity primary key,
  token_hash  text,                                   -- null = the house frog that opens the pond
  ip_hash     text,
  nick        text not null,
  moves       text not null check (moves ~ '^[rps]{3}$'),
  crowned_at  timestamptz not null default now(),
  ended_at    timestamptz,
  defenses    int not null default 0,
  ended_by    text                                    -- nickname of the frog that took the throne
);
create unique index if not exists pk_kings_one_reigning on games.pk_kings ((true)) where ended_at is null;
create index if not exists pk_kings_best on games.pk_kings (defenses desc, crowned_at);
alter table games.pk_kings enable row level security;
revoke all on games.pk_kings from public, anon, authenticated;

create table if not exists games.pk_duels (
  id          bigint generated always as identity primary key,
  king_id     bigint not null references games.pk_kings(id) on delete cascade,
  token_hash  text not null,
  ip_hash     text,
  nick        text not null,
  moves       text not null check (moves ~ '^[rps]{3}$'),
  king_order  text not null check (king_order ~ '^[rps]{3}$'),
  won         boolean not null,
  created_at  timestamptz not null default now()
);
-- (2026-11-14) no more "one duel per king": a player may come back for the same king after the 4-hour wait
drop index if exists games.pk_duels_once;
create index if not exists pk_duels_player on games.pk_duels (king_id, token_hash);
create index if not exists pk_duels_ip on games.pk_duels (ip_hash, created_at);
create index if not exists pk_duels_king on games.pk_duels (king_id, created_at desc);
create index if not exists pk_duels_time on games.pk_duels (created_at);
alter table games.pk_duels enable row level security;
revoke all on games.pk_duels from public, anon, authenticated;

create table if not exists games.pk_meta (id int primary key check (id = 1), cleanup_at timestamptz);
insert into games.pk_meta (id) values (1) on conflict do nothing;
alter table games.pk_meta enable row level security;
revoke all on games.pk_meta from public, anon, authenticated;

alter table games.pk_kings add column if not exists user_id uuid;   -- the account, if the player was logged on
alter table games.pk_duels add column if not exists user_id uuid;
create index if not exists pk_duels_user on games.pk_duels (king_id, user_id);
create index if not exists pk_kings_long on games.pk_kings ((coalesce(ended_at, crowned_at) - crowned_at) desc);

-- the record of every frog, kept apart from the duels (those go after 60 days): duels played, thrones taken,
-- duels lost, the most defences in one reign (the longest win streak as king) and the longest reign.
-- A player is their account when logged on ('u:<id>'), otherwise their browser token ('t:<hash>').
create table if not exists games.pk_stats (
  player           text primary key,
  nick             text not null,
  duels            int not null default 0,
  thrones          int not null default 0,
  losses           int not null default 0,
  best_defenses    int not null default 0,
  longest_reign_s  bigint not null default 0,
  updated_at       timestamptz not null default now()
);
alter table games.pk_stats enable row level security;
revoke all on games.pk_stats from public, anon, authenticated;

-- the pond opens with the house frog on the throne
insert into games.pk_kings (nick, moves)
select 'Pepe', (select string_agg(substr('rps', 1 + floor(random() * 3)::int, 1), '') from generate_series(1, 3))
where not exists (select 1 from games.pk_kings);

-- the player's random browser token, hashed with the project salt (null if the token looks wrong)
create or replace function games.pk_token_hash(p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select case when coalesce(p_token, '') ~ '^[A-Za-z0-9-]{20,64}$'
    then encode(sha256(convert_to((select host_code_salt from games.config where id = 1) || '|pk|' || p_token, 'UTF8')), 'hex') end
$$;

-- is this row (a king or a duel) the player? By browser token, or by account when logged on
create or replace function games.pk_is(row_token text, row_user uuid, th text, u uuid) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(th is not null and row_token = th, false) or coalesce(u is not null and row_user = u, false)
$$;

-- how long a player (and a network) waits between two duels
create or replace function games.pk_cooldown() returns interval language sql immutable set search_path = '' as $$
  select interval '4 hours'
$$;

-- the latest duel of this player (by token or account) or of this network within the cooldown, if any
-- The network rule (the 4-hour wait also per network) is for players the pond
-- cannot tell apart otherwise: no account, or a guest account (cheap to make). A Discord account is checked by
-- the account itself, so frens behind one shared address (a home, a mobile network) do not block each other.
create or replace function games.pk_by_net(u uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select u is null or games.discord_identity(u) is null
$$;

create or replace function games.pk_last(th text, u uuid, ip text) returns games.pk_duels
language sql stable security definer set search_path = '' as $$
  select d.* from games.pk_duels d
   where d.created_at > now() - games.pk_cooldown()
     and (games.pk_is(d.token_hash, d.user_id, th, u) or (ip is not null and games.pk_by_net(u) and d.ip_hash = ip))
   order by d.created_at desc limit 1
$$;

create or replace function games.pk_player(th text, u uuid) returns text language sql immutable set search_path = '' as $$
  select case when u is not null then 'u:' || u::text when th is not null then 't:' || th end
$$;

-- add to a player's record (nothing for the house frog, which has neither token nor account)
create or replace function games.pk_stat_add(p_player text, p_nick text, p_duels int, p_thrones int, p_losses int, p_defenses int, p_reign_s bigint)
returns void language sql security definer set search_path = '' as $$
  insert into games.pk_stats as s (player, nick, duels, thrones, losses, best_defenses, longest_reign_s)
  select p_player, p_nick, p_duels, p_thrones, p_losses, p_defenses, p_reign_s where p_player is not null
  on conflict (player) do update set nick = excluded.nick, duels = s.duels + excluded.duels, thrones = s.thrones + excluded.thrones,
    losses = s.losses + excluded.losses, best_defenses = greatest(s.best_defenses, excluded.best_defenses),
    longest_reign_s = greatest(s.longest_reign_s, excluded.longest_reign_s), updated_at = now()
$$;

-- duels and reigns from before this table count too (once: only while the table is still empty)
do $$
begin
  if not exists (select 1 from games.pk_stats) then
    perform games.pk_stat_add(games.pk_player(d.token_hash, d.user_id), d.nick, 1, d.won::int, (not d.won)::int, 0, 0)
       from games.pk_duels d order by d.created_at;
    perform games.pk_stat_add(games.pk_player(k.token_hash, k.user_id), k.nick, 0, 0, 0, k.defenses,
                              case when k.ended_at is null then 0 else extract(epoch from k.ended_at - k.crowned_at)::bigint end)
       from games.pk_kings k order by k.crowned_at;
  end if;
end $$;

-- the saved Fren avatar of a Discord player (games.passport_avatars, update_fren_avatar.sql), or null;
-- null too while the Fren Passport is not installed
create or replace function games.pk_avatar(u uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare look jsonb;
begin
  if u is null or to_regclass('games.passport_avatars') is null or games.discord_identity(u) is null then return null; end if;
  execute 'select jsonb_build_object(''bg'', a.bg, ''clothing'', a.clothing, ''mouth'', a.mouth, ''eyes'', a.eyes, ''hat'', a.hat,
             ''accessory'', a.accessory, ''special'', a.special) from games.passport_avatars a where a.user_id = $1' into look using u;
  return look;
end $$;

-- 1 = a beats b, -1 = b beats a, 0 = the same move
create or replace function games.pk_beats(a text, b text) returns int
language sql immutable set search_path = '' as $$
  select case when a = b then 0 when (a, b) in (('r', 's'), ('s', 'p'), ('p', 'r')) then 1 else -1 end
$$;

-- What a visitor sees: the reigning king (and their moves, if it is you), whether you may challenge,
-- the longest reigns and the latest duels (names and results only, never moves).
create or replace function public.gry_pk_state(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  th text := games.pk_token_hash(p_token);
  u uuid := auth.uid();
  ip text := games.client_ip_hash();
  k games.pk_kings;
  mine games.pk_duels;   -- your last duel with this king (shown, never a block)
  last games.pk_duels;
  you boolean;
begin
  select * into k from games.pk_kings where ended_at is null;
  if k.id is null then return jsonb_build_object('king', null); end if;
  you := games.pk_is(k.token_hash, k.user_id, th, u);
  select * into mine from games.pk_duels d where d.king_id = k.id and games.pk_is(d.token_hash, d.user_id, th, u) limit 1;
  last := games.pk_last(th, u, ip);
  return jsonb_build_object(
    'king', jsonb_build_object('id', k.id, 'nick', k.nick, 'defenses', k.defenses, 'since', k.crowned_at,
                               'house', k.token_hash is null and k.user_id is null, 'you', you,
                               'passport', games.passport_id(k.user_id), 'avatar', games.pk_avatar(k.user_id),
                               'moves', case when you then k.moves end),
    'can_challenge', not you and last.id is null,
    -- one duel every 4 hours: the duel that started the wait (yours, or one from your network) and when it ends
    'cooldown', case when last.id is not null then jsonb_build_object(
                    'won', last.won, 'at', last.created_at,
                    'network', not games.pk_is(last.token_hash, last.user_id, th, u),
                    'next_at', last.created_at + games.pk_cooldown()) end,
    'tried', case when mine.id is not null then jsonb_build_object('won', mine.won, 'at', mine.created_at) end,
    'duels_today', (select count(*) from games.pk_duels where created_at > now() - interval '24 hours'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('nick', t.nick, 'defenses', t.defenses, 'reigning', t.ended_at is null,
                                                         'since', t.crowned_at, 'until', t.ended_at, 'you', games.pk_is(t.token_hash, t.user_id, th, u),
                                                         'passport', games.passport_id(t.user_id))
                                      order by t.defenses desc, t.crowned_at)
                     from (select * from games.pk_kings where defenses > 0 or ended_at is null
                            order by defenses desc, crowned_at limit 10) t), '[]'::jsonb),
    -- the longest time on the throne (the house frog does not count); a reign still going counts up to now
    'longest', coalesce((select jsonb_agg(jsonb_build_object('nick', t.nick, 'seconds', t.secs, 'defenses', t.defenses, 'reigning', t.ended_at is null,
                                                             'you', games.pk_is(t.token_hash, t.user_id, th, u), 'passport', games.passport_id(t.user_id))
                                          order by t.secs desc, t.crowned_at)
                         from (select x.*, extract(epoch from coalesce(x.ended_at, now()) - x.crowned_at)::bigint secs from games.pk_kings x
                                where x.token_hash is not null or x.user_id is not null
                                order by coalesce(x.ended_at, now()) - x.crowned_at desc, x.crowned_at limit 10) t), '[]'::jsonb),
    -- your record (on this browser and, when logged on, your account), with a reign still going counted up to now
    'stats', (select jsonb_build_object('duels', coalesce(sum(st.duels), 0), 'thrones', coalesce(sum(st.thrones), 0), 'losses', coalesce(sum(st.losses), 0),
                                        'best_defenses', greatest(coalesce(max(st.best_defenses), 0), case when you then k.defenses else 0 end),
                                        'longest_reign_s', greatest(coalesce(max(st.longest_reign_s), 0),
                                                                    case when you then extract(epoch from now() - k.crowned_at)::bigint else 0 end))
                from games.pk_stats st where st.player in (games.pk_player(th, null), games.pk_player(null, u))),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('nick', d.nick, 'won', d.won, 'at', d.created_at, 'king', kk.nick)
                                         order by d.created_at desc)
                        from (select * from games.pk_duels order by created_at desc limit 8) d
                        join games.pk_kings kk on kk.id = d.king_id), '[]'::jsonb),
    -- the king sees who came for the throne during this reign
    'challengers', case when you then coalesce((select jsonb_agg(jsonb_build_object('nick', d.nick, 'moves', d.moves, 'order', d.king_order, 'at', d.created_at)
                                                                 order by d.created_at desc)
                                                from (select * from games.pk_duels where king_id = k.id order by created_at desc limit 10) d), '[]'::jsonb) end);
end $$;

-- One duel against the king the player saw (p_king_id). If the throne changed hands in the meantime,
-- nothing is played and the answer says so ("changed"), so the player can look at the new king first.
create or replace function public.gry_pk_challenge(p_token text, p_king_id bigint, p_nick text, p_moves text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  th text := games.pk_token_hash(p_token);
  u uuid := auth.uid();
  ip text := games.client_ip_hash();
  nm jsonb;
  v_nick text;
  v_moves text := lower(coalesce(p_moves, ''));
  k games.pk_kings;
  ord text; me int := 0; them int := 0; r int; won boolean; new_id bigint;
  rounds jsonb := '[]'::jsonb;
begin
  if th is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if v_moves !~ '^[rps]{3}$' then return jsonb_build_object('ok', false, 'error', 'moves'); end if;
  nm := games.pond_name(u, p_nick);
  if nm ? 'error' then return jsonb_build_object('ok', false, 'error', 'nick', 'message', nm->>'message'); end if;
  v_nick := nm->>'nick';

  -- the throne row lock makes duels happen one after another
  select * into k from games.pk_kings where ended_at is null for update;
  if k.id is null or k.id is distinct from p_king_id then return jsonb_build_object('ok', false, 'error', 'changed'); end if;
  if games.pk_is(k.token_hash, k.user_id, th, u) then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  -- one duel every 4 hours per player and per network
  if (games.pk_last(th, u, ip)).id is not null then
    return jsonb_build_object('ok', false, 'error', 'wait', 'next_at', (games.pk_last(th, u, ip)).created_at + games.pk_cooldown()); end if;

  -- and a ceiling for the whole pond: 300 duels an hour
  if (select count(*) from games.pk_duels where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'busy'); end if;

  -- the king's three moves in a fresh random order
  select string_agg(m, '' order by random()) into ord from regexp_split_to_table(k.moves, '') m;
  for i in 1..3 loop
    r := games.pk_beats(substr(v_moves, i, 1), substr(ord, i, 1));
    if r > 0 then me := me + 1; elsif r < 0 then them := them + 1; end if;
    rounds := rounds || jsonb_build_object('you', substr(v_moves, i, 1), 'king', substr(ord, i, 1), 'result', r);
  end loop;
  won := me > them;

  insert into games.pk_duels (king_id, token_hash, user_id, ip_hash, nick, moves, king_order, won)
  values (k.id, th, u, ip, v_nick, v_moves, ord, won);

  perform games.pk_stat_add(games.pk_player(th, u), v_nick, 1, won::int, (not won)::int, 0, 0);
  if won then
    update games.pk_kings set ended_at = now(), ended_by = v_nick where id = k.id;
    perform games.pk_stat_add(games.pk_player(k.token_hash, k.user_id), k.nick, 0, 0, 0, k.defenses, extract(epoch from now() - k.crowned_at)::bigint);
    insert into games.pk_kings (token_hash, user_id, ip_hash, nick, moves) values (th, u, ip, v_nick, v_moves) returning id into new_id;
    perform games.bulletin_post('pk:crown:' || new_id, 'pond_king', 'king_crowned', v_nick, u, k.nick, k.user_id, null,
                                jsonb_build_object('old_reign', k.defenses));
  else
    update games.pk_kings set defenses = defenses + 1 where id = k.id;
    perform games.pk_stat_add(games.pk_player(k.token_hash, k.user_id), k.nick, 0, 0, 0, k.defenses + 1, 0);
    -- 10 duels won in a row as king: the "Long Live the King" stamp (a Passport without this stamp yet only warns)
    if k.defenses + 1 >= 10 and k.user_id is not null and to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is not null then
      begin perform games.passport_award(k.user_id, 'long_live_the_king');
      exception when others then raise warning 'pond king: long_live_the_king: %', sqlerrm; end;
    end if;
    -- long reigns make the news
    if k.defenses + 1 in (5, 10, 25, 50, 100, 250, 500, 1000) then
      perform games.bulletin_post('pk:def:' || k.id || ':' || (k.defenses + 1), 'pond_king', 'king_defended', k.nick, k.user_id, v_nick, u, null,
                                  jsonb_build_object('defenses', k.defenses + 1));
    end if;
  end if;

  -- tidy up at most once an hour: duels older than 60 days, and old reigns outside the all-time top 50
  update games.pk_meta set cleanup_at = now() where id = 1 and (cleanup_at is null or cleanup_at < now() - interval '1 hour');
  if found then
    delete from games.pk_duels where created_at < now() - interval '60 days';
    delete from games.pk_kings x where x.ended_at < now() - interval '60 days'
      and x.id not in (select id from games.pk_kings order by defenses desc, crowned_at limit 50)
      and x.id not in (select id from games.pk_kings order by coalesce(ended_at, crowned_at) - crowned_at desc limit 50);
  end if;

  return jsonb_build_object('ok', true, 'won', won, 'score', jsonb_build_array(me, them), 'rounds', rounds,
                            'king', jsonb_build_object('nick', k.nick, 'defenses', k.defenses + case when won then 0 else 1 end),
                            'new_king_id', new_id);
end $$;

-- The reigning king changes their three moves (only with the token that won the throne).
create or replace function public.gry_pk_set_moves(p_token text, p_moves text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare th text := games.pk_token_hash(p_token); u uuid := auth.uid(); v_moves text := lower(coalesce(p_moves, '')); k games.pk_kings;
begin
  if th is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if v_moves !~ '^[rps]{3}$' then return jsonb_build_object('ok', false, 'error', 'moves'); end if;
  select * into k from games.pk_kings where ended_at is null for update;
  if k.id is null or not games.pk_is(k.token_hash, k.user_id, th, u) then return jsonb_build_object('ok', false, 'error', 'not_king'); end if;
  update games.pk_kings set moves = v_moves where id = k.id;
  return jsonb_build_object('ok', true, 'moves', v_moves);
end $$;

revoke all on function games.pk_by_net(uuid) from public, anon, authenticated;
revoke all on function games.pk_player(text, uuid), games.pk_stat_add(text, text, int, int, int, int, bigint) from public, anon, authenticated;
revoke all on function games.pk_token_hash(text), games.pk_beats(text, text), games.pk_is(text, uuid, text, uuid), games.pk_cooldown(), games.pk_last(text, uuid, text), games.pk_avatar(uuid) from public, anon, authenticated;
revoke all on function public.gry_pk_state(text), public.gry_pk_challenge(text, bigint, text, text), public.gry_pk_set_moves(text, text) from public;
grant execute on function public.gry_pk_state(text), public.gry_pk_challenge(text, bigint, text, text), public.gry_pk_set_moves(text, text) to anon, authenticated;
