-- Fren Passport: stamps the server can verify, awarded by the games themselves.
-- DRAFT. Apply to PH-games only after review, in this order:
--   update_fren_passport.sql -> update_fren_avatar.sql -> this file.
-- It also needs the game migrations it hooks into (already on production):
--   update_yeet.sql, update_wheres_pepe.sql (+ _guests), update_lobby_chat.sql, update_open_chat.sql,
--   update_lobby_mentions.sql, update_frog_letters.sql, update_letters_community.sql, update_miner_cloud.sql.
-- Safe to run twice.
--
-- RUN IT ON LAUNCH DAY. The first run takes the Pond Pioneer snapshot: every account that has Discord
-- linked at that moment gets the stamp. Later runs never add anyone (games.passport_meta remembers the run).
--
-- Trust rules (games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md):
--   * Only events the server itself records can award a stamp. Nothing here takes a badge id, a count,
--     a score or a time from the browser. Stamps that only the browser could see (opening a folder,
--     starting a game) are deliberately not built.
--   * Discord accounts only: games.passport_award() checks games.discord_identity() on every award.
--   * Each stamp is one row in games.passport_badges (primary key user_id + badge_id), so it is awarded
--     once. Stamps never unlock PEP, points or anything transferable.
--   * The hooks are triggers on the existing game tables (plus one line in gry_yeet_submit). A failure
--     inside a hook is caught and logged as a warning, so a stamp bug can never break a game.
--   * YEET distances are still client-reported with plausibility checks only (update_yeet.sql), so the
--     YEET stamps are cosmetic, like the leaderboard.
--
-- Stamps awarded here (the ids must match docs/meme/passport-catalog.json; tests check it):
--   pond_pioneer    Discord linked when this file first runs (one-time snapshot)
--   moonwalker      a YEET flight of 6000 m (the maximum); old records are backfilled
--   nasa_is_hiring  three accepted YEET flights over 5000 m; the first three are kept in passport_yeet_5k
--   pepe_guesser    first Pepe Guesser guess with a pin on the map (Discord-verified play)
--   sharp_eye       first perfect 5000
--   detective_fren  5000 on five different puzzle days
--   week_scout      a guess on 7 puzzle days in a row (UTC)
--   scout_fren      a guess on 14 puzzle days in a row (UTC)
--   welcome_back    back in PondOS on the day after the first visit (gry_passport_checkin)
--   streak_14       PondOS opened signed in on 14 UTC days in a row (gry_passport_checkin)
--   like_it_here    PondOS opened signed in on 30 UTC days in a row (gry_passport_checkin)
--   first_words     first lobby chat message
--   community_fren  lobby chat on five different UTC days
--   hey_fren        first @mention of another fren (games.lobby_mentions)
--   dear_editor     first letter to the editor
--   rookie_miner    "Happy Mining!": the first Pepe Miner cloud save (unlocks the hard hat)
-- Junior Editor and Senior Editor (first and five letters printed in the Gazette) wait for the owner's
-- "Printed" mark on letters; they are not awarded from the number of letters sent (owner, 2026-11-08).
-- Pepe Guesser, letters and Moonwalker are backfilled from existing records. Chat history is kept only
-- 24 h and YEET keeps only the best flight, so those stamps count from the day this file runs.
--
-- Stamps added later: everything a future stamp might count is kept from today on (PondOS days, chat
-- days, letters, Miner seconds, every accepted YEET flight and every one over 5000 m, and all Pepe Guesser
-- plays). A later migration can add a stamp with its own backfill from these records, so players keep
-- the progress they already have.
begin;

-- ---------- storage ----------
alter table games.passport_badges add column if not exists notified_at timestamptz;   -- shown once by gry_passport_checkin

create table if not exists games.passport_meta (
  k  text primary key check (k ~ '^[a-z_]{3,40}$'),
  at timestamptz not null default clock_timestamp()
);
-- the first three YEET flights over 5000 m (tenths of a metre), one row per accepted flight
create table if not exists games.passport_yeet_5k (
  user_id  uuid not null references auth.users(id) on delete cascade,
  n        smallint not null check (n between 1 and 3),
  distance integer not null check (distance > 50000 and distance <= 60000),
  flown_at timestamptz not null default clock_timestamp(),
  primary key (user_id, n)
);
-- UTC days on which a Discord player opened PondOS (gry_passport_checkin)
create table if not exists games.passport_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
-- UTC days on which a Discord player wrote in the lobby chat (the chat itself is deleted after 24 h)
create table if not exists games.passport_chat_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);
-- counters the server keeps itself: letters sent, Pepe Miner seconds, accepted YEET flights
create table if not exists games.passport_progress (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  letters       integer not null default 0 check (letters >= 0),
  miner_seconds integer not null default 0 check (miner_seconds >= 0),
  miner_last_at timestamptz,
  yeet_flights  integer not null default 0 check (yeet_flights >= 0),
  yeet_5k_total integer not null default 0 check (yeet_5k_total >= 0)
);
alter table games.passport_progress add column if not exists yeet_flights integer not null default 0 check (yeet_flights >= 0);
alter table games.passport_progress add column if not exists yeet_5k_total integer not null default 0 check (yeet_5k_total >= 0);
-- Frog of the Week is the only repeatable stamp: how many weeks it was won
alter table games.passport_badges add column if not exists times integer not null default 1 check (times >= 1);
-- each finished Pepe Guesser week and each finished Pepe Pictures season is settled once
create table if not exists games.passport_weeks (week_start date primary key, settled_at timestamptz not null default clock_timestamp());
create table if not exists games.passport_seasons (season_no integer primary key, settled_at timestamptz not null default clock_timestamp());
alter table games.passport_weeks enable row level security;
alter table games.passport_seasons enable row level security;
alter table games.passport_meta enable row level security;
alter table games.passport_yeet_5k enable row level security;
alter table games.passport_days enable row level security;
alter table games.passport_chat_days enable row level security;
alter table games.passport_progress enable row level security;
revoke all on games.passport_meta, games.passport_yeet_5k, games.passport_days, games.passport_chat_days,
  games.passport_progress from public, anon, authenticated;

-- ---------- the one award path ----------
create or replace function games.passport_award(u uuid, b text, at timestamptz default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if b is null or b not in ('pond_pioneer', 'moonwalker', 'nasa_is_hiring', 'pepe_guesser', 'sharp_eye',
      'detective_fren', 'week_scout', 'scout_fren', 'welcome_back', 'streak_14', 'like_it_here', 'first_words',
      'community_fren', 'hey_fren', 'dear_editor', 'rookie_miner', 'good_game', 'checkmate',
      'i_voted', 'yeet_adept', 'fud_buster', 'long_snake', 'secret_starter', 'treasure_hunter', 'podium', 'game_night',
      'quiz_master', 'certified_fren', 'old_frog', 'arcade_hopper', 'frogmas', 'top_ten', 'season_champion', 'frog_of_the_week') then
    raise exception 'Unknown passport stamp %', b;
  end if;
  if u is null or games.discord_identity(u) is null then return false; end if;
  insert into games.passport_badges (user_id, badge_id, earned_at)
  values (u, b, coalesce(at, clock_timestamp()))
  on conflict (user_id, badge_id) do nothing;
  return found;
end
$$;

-- ---------- YEET THE PEP ----------
create or replace function games.passport_yeet_flight(u uuid, p_score integer)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare kept integer;
begin
  if p_score is null then return; end if;
  -- every accepted flight is counted, for stamps that may be added later
  insert into games.passport_progress (user_id, yeet_flights, yeet_5k_total)
  values (u, 1, case when p_score > 50000 then 1 else 0 end)
  on conflict (user_id) do update set
    yeet_flights = games.passport_progress.yeet_flights + 1,
    yeet_5k_total = games.passport_progress.yeet_5k_total + excluded.yeet_5k_total;
  if p_score >= 30000 then perform games.passport_award(u, 'yeet_adept'); end if;   -- 3000 m
  if p_score >= 60000 then perform games.passport_award(u, 'moonwalker'); end if;
  if p_score <= 50000 then return; end if;
  -- the caller holds this player's games.yeet_records row lock, so flights are counted one at a time
  select count(*) into kept from games.passport_yeet_5k f where f.user_id = u;
  if kept >= 3 then return; end if;
  insert into games.passport_yeet_5k (user_id, n, distance) values (u, kept + 1, p_score)
  on conflict (user_id, n) do nothing;
  if kept + 1 >= 3 then perform games.passport_award(u, 'nasa_is_hiring'); end if;
end
$$;

-- Same as update_yeet.sql, plus the passport hook after an accepted (not rate-limited) flight.
-- tests/passport-awards.test.mjs checks that the rest of the body still matches update_yeet.sql.
create or replace function public.gry_yeet_submit(p_score integer, p_ms integer, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); d jsonb; r games.yeet_records;
  v_nick text; saved boolean := false;
begin
  if u is null then raise exception 'Log in with Discord to save a flight'; end if;
  d := games.discord_identity(u);
  if d is null then raise exception 'Log in with Discord to save a flight'; end if;
  if p_version is distinct from 1 then raise exception 'Refresh the game before submitting'; end if;
  if p_score is null or p_score < 1 or p_score > 60000 then raise exception 'Invalid flight distance'; end if;
  if p_ms is null or p_ms < 1000 or p_ms > 360500 then raise exception 'Invalid flight duration'; end if;
  -- At most 100 m/s in v1; tolerate rounding and initial launch/collision steps.
  if p_score::bigint > p_ms::bigint + 100 then raise exception 'That distance does not match the flight time'; end if;
  v_nick := left(btrim(regexp_replace(coalesce(d->>'name', 'Discord pilot'), '[[:cntrl:]]', '', 'g')), 40);
  if v_nick = '' then v_nick := 'Discord pilot'; end if;
  insert into games.yeet_records(user_id, nick) values (u, v_nick) on conflict (user_id) do nothing;
  select * into strict r from games.yeet_records where user_id = u for update;
  -- A per-account lock makes simultaneous submissions monotonic and enforces cooldown atomically.
  if r.last_attempt_at > clock_timestamp() - interval '10 seconds' then
    return jsonb_build_object('best', r.best, 'saved', false, 'rate_limited', true);
  end if;
  saved := p_score > r.best;
  update games.yeet_records set nick = v_nick,
    best = greatest(best, p_score),
    duration_ms = case when p_score > best then p_ms else duration_ms end,
    achieved_at = case when p_score > best then clock_timestamp() else achieved_at end,
    last_attempt_at = clock_timestamp()
  where user_id = u;
  -- Fren Passport (update_passport_awards.sql): count the flight; a stamp bug never loses the flight.
  begin
    perform games.passport_yeet_flight(u, p_score);
  exception when others then
    raise warning 'passport yeet hook: %', sqlerrm;
  end;
  return jsonb_build_object('best', greatest(r.best, p_score), 'saved', saved,
                           'rate_limited', false, 'top', games.yeet_top());
end $$;
revoke all on function public.gry_yeet_submit(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.gry_yeet_submit(integer, integer, integer) to authenticated;

-- ---------- Pepe Guesser ----------
-- Re-reads this player's Discord-verified plays with a pin and awards whatever they reached.
-- One row per (puzzle, player) and one puzzle per UTC day, so every count is in different days.
create or replace function games.passport_wp_check(u uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare r record;
begin
  if u is null or games.discord_identity(u) is null then return; end if;
  with p as (
    select q.day, x.guessed_at as at, x.points
      from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
     where x.user_id = u and x.verified and x.g_lat is not null and x.guessed_at is not null and q.day is not null),
  g as (
    select day, at, points,
           row_number() over (order by day) as k,
           case when points = 5000 then row_number() over (partition by points = 5000 order by day) end as k5,
           day - (row_number() over (order by day))::integer as grp
      from p),
  s as (select at, k, k5, row_number() over (partition by grp order by day) as run from g)
  select min(at) filter (where k = 1) as first_guess,
         min(at) filter (where k5 = 1) as first_perfect,
         min(at) filter (where k5 = 5) as five_perfect,
         min(at) filter (where run = 7) as run7,
         min(at) filter (where run = 14) as run14
    into r from s;
  if r.first_guess is not null then perform games.passport_award(u, 'pepe_guesser', r.first_guess); end if;
  if r.first_perfect is not null then perform games.passport_award(u, 'sharp_eye', r.first_perfect); end if;
  if r.five_perfect is not null then perform games.passport_award(u, 'detective_fren', r.five_perfect); end if;
  if r.run7 is not null then perform games.passport_award(u, 'week_scout', r.run7); end if;
  if r.run14 is not null then perform games.passport_award(u, 'scout_fren', r.run14); end if;
end
$$;

-- current run of puzzle days with a pin, ending today (or yesterday, if today is not played yet)
create or replace function games.passport_wp_streak(u uuid)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date; s integer := 0;
  played boolean;
begin
  played := exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                     where x.user_id = u and x.verified and x.g_lat is not null and q.day = d);
  if not played then d := d - 1; end if;
  while s < 400 and exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                     where x.user_id = u and x.verified and x.g_lat is not null and q.day = d - s) loop
    s := s + 1;
  end loop;
  return s;
end
$$;

create or replace function games.passport_wp_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.guessed_at is not null and old.guessed_at is null and new.g_lat is not null and new.verified then
    begin
      perform games.passport_wp_check(new.user_id);
    exception when others then
      raise warning 'passport wp hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_wp_au on games.wp_plays;
create trigger passport_wp_au after update of guessed_at on games.wp_plays
  for each row execute function games.passport_wp_after();

-- ---------- lobby chat (PEP Games lobby and LAN Party) ----------
create or replace function games.passport_chat_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if new.verified and new.user_id is not null then
    begin
      insert into games.passport_chat_days (user_id, day)
      values (new.user_id, (new.created_at at time zone 'utc')::date)
      on conflict (user_id, day) do nothing;
      if found then   -- first message of the day: the only time the counts can change
        perform games.passport_award(new.user_id, 'first_words', new.created_at);
        select count(*) into n from games.passport_chat_days where user_id = new.user_id;
        if n >= 5 then perform games.passport_award(new.user_id, 'community_fren', new.created_at); end if;
      end if;
      -- two chat secrets (each unlocks a special avatar): a smiley, and the word "fren"
      if games.discord_identity(new.user_id) is not null then
        if new.body ~ '(:-?\)|\(:)' then
          insert into games.passport_secrets (user_id, secret_id, discovered_at) values (new.user_id, 'happy_fren', new.created_at)
          on conflict (user_id, secret_id) do nothing;
        end if;
        -- @mentions do not count: a nickname like @Fren6 is not saying the word
        if regexp_replace(new.body, '@\S+', '', 'g') ~* '(^|[^a-z])frens?([^a-z]|$)' then
          insert into games.passport_secrets (user_id, secret_id, discovered_at) values (new.user_id, 'born_to_fren', new.created_at)
          on conflict (user_id, secret_id) do nothing;
        end if;
      end if;
    exception when others then
      raise warning 'passport chat hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_chat_ai on games.lobby_chat;
create trigger passport_chat_ai after insert on games.lobby_chat
  for each row execute function games.passport_chat_after();

-- ---------- board games (chess, checkers, Connect Four, Sea Battle) ----------
-- Good Game: a game played to its end by two different Discord players. A resignation, a player who left,
-- an aborted game and very short games (fewer than 10 moves; Sea Battle always takes longer) do not count.
-- Checkmate!: the winner of a chess game that ended in checkmate under the same conditions.
create or replace function games.passport_table_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v1 boolean; v2 boolean; w uuid;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' and new.result is not null
     and new.p1 is not null and new.p2 is not null and new.p1 <> new.p2 then
    begin
      if coalesce(new.reason, '') ~* '(resigned|left the table|players left|did not place|did not make)' then return null; end if;
      if new.game <> 'battleship' and coalesce(array_length(new.history, 1), 0) < 10 then return null; end if;
      select coalesce(bool_or(m.verified) filter (where m.user_id = new.p1), false),
             coalesce(bool_or(m.verified) filter (where m.user_id = new.p2), false)
        into v1, v2 from games.table_members m where m.table_code = new.code;
      if not (v1 and v2) then return null; end if;
      perform games.passport_award(new.p1, 'good_game');
      perform games.passport_award(new.p2, 'good_game');
      if new.game = 'chess' and new.reason = 'checkmate' and new.result in ('p1', 'p2') then
        w := case new.result when 'p1' then new.p1 else new.p2 end;
        perform games.passport_award(w, 'checkmate');
      end if;
    exception when others then
      raise warning 'passport table hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_table_au on games.tables;
create trigger passport_table_au after update of status on games.tables
  for each row execute function games.passport_table_after();

-- a mention row exists only when a verified player really @mentioned another reserved nickname
create or replace function games.passport_mention_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if not exists (select 1 from games.passport_badges b where b.user_id = new.from_user and b.badge_id = 'hey_fren') then
      perform games.passport_award(new.from_user, 'hey_fren', new.created_at);
    end if;
  exception when others then
    raise warning 'passport mention hook: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists passport_mention_ai on games.lobby_mentions;
create trigger passport_mention_ai after insert on games.lobby_mentions
  for each row execute function games.passport_mention_after();

-- ---------- letters to the editor ----------
create or replace function games.passport_letter_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if new.discord then
    begin
      insert into games.passport_progress (user_id, letters) values (new.user_id, 1)
      on conflict (user_id) do update set letters = games.passport_progress.letters + 1
      returning letters into n;
      if n >= 1 then perform games.passport_award(new.user_id, 'dear_editor', new.created_at); end if;
    exception when others then
      raise warning 'passport letter hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_letter_ai on games.letters;
create trigger passport_letter_ai after insert on games.letters
  for each row execute function games.passport_letter_after();

-- ---------- Pepe Miner ----------
-- The game sends its cloud save every 60 s while it runs (docs/games/js/miner.js), and gry_miner_save
-- accepts at most one save per 20 s. Play time is the server's own clock between two accepted saves
-- that are at most 120 s apart; a longer gap starts a new session. The game's own numbers are ignored.
create or replace function games.passport_miner_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  begin
    insert into games.passport_progress (user_id, miner_last_at) values (new.user_id, clock_timestamp())
    on conflict (user_id) do update set
      miner_seconds = games.passport_progress.miner_seconds
        + case when games.passport_progress.miner_last_at > clock_timestamp() - interval '120 seconds'
               then greatest(0, ceil(extract(epoch from clock_timestamp() - games.passport_progress.miner_last_at)))::integer
               else 0 end,
      miner_last_at = clock_timestamp()
    returning miner_seconds into n;
    -- Happy Mining!: the first cloud save (v3). Play time is still counted for a future stamp.
    perform games.passport_award(new.user_id, 'rookie_miner');
  exception when others then
    raise warning 'passport miner hook: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists passport_miner_aiu on games.miner_saves;
create trigger passport_miner_aiu after insert or update on games.miner_saves
  for each row execute function games.passport_miner_after();

-- ---------- PondOS visits: Welcome Back!, 14-Day Streak, Guess You Like It Here, and new-stamp notices ----------
-- Called by PondOS (docs/meme/meme.js) when a Discord player opens a page. It writes one row per UTC day
-- at most, and hands back the stamps the player has not been told about yet (each one only once).
-- ---------- Pond Polls: I Voted ----------
create or replace function games.passport_poll_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified then
    begin perform games.passport_award(new.user_id, 'i_voted', new.voted_at);
    exception when others then raise warning 'passport poll hook: %', sqlerrm; end;
  end if;
  return null;
end
$$;

-- ---------- FUD Invaders and PEP Snake: FUD Buster (2,000 points), Long Snake (40 blocks) ----------
create or replace function games.passport_arcade_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified and new.user_id is not null then
    begin
      if new.game = 'fud' and new.score >= 2000 then perform games.passport_award(new.user_id, 'fud_buster', new.created_at); end if;
      if new.game = 'snake' and new.score >= 40 then perform games.passport_award(new.user_id, 'long_snake', new.created_at); end if;
    exception when others then raise warning 'passport arcade hook: %', sqlerrm; end;
  end if;
  return null;
end
$$;

-- ---------- secrets: Secret Starter (1), Treasure Hunter (6) ----------
create or replace function games.passport_secret_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  begin
    select count(*) into n from games.passport_secrets where user_id = new.user_id;
    if n >= 1 then perform games.passport_award(new.user_id, 'secret_starter', new.discovered_at); end if;
    if n >= 6 then perform games.passport_award(new.user_id, 'treasure_hunter', new.discovered_at); end if;
  exception when others then raise warning 'passport secret hook: %', sqlerrm; end;
  return null;
end
$$;

-- ---------- Pepe Pictures: Podium (top 3), Game Night (a scheduled night), Quiz Master (hosted, 4+ ranked players) ----------
create or replace function games.passport_result_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m games.matches; host uuid; n integer;
begin
  begin
    select * into m from games.matches where id = new.match_id;
    if m.id is null or m.mode <> 'obrazek' then return null; end if;
    if new.verified then
      if new.place <= 3 then perform games.passport_award(new.user_id, 'podium', new.finished_at); end if;
      if exists (select 1 from games.events e where e.room_code = m.room_code
                   and e.starts_at between m.started_at - interval '3 hours' and m.started_at + interval '3 hours') then
        perform games.passport_award(new.user_id, 'game_night', new.finished_at);
      end if;
    end if;
    select count(*) into n from games.results where match_id = new.match_id;
    if n >= 4 then
      select r.host_id into host from games.rooms r where r.code = m.room_code;
      if host is not null and host <> new.user_id then perform games.passport_award(host, 'quiz_master', new.finished_at); end if;
    end if;
  exception when others then raise warning 'passport result hook: %', sqlerrm; end;
  return null;
end
$$;

-- the triggers are created only where the game tables exist (every game migration runs before this file)
do $$ begin
  if to_regclass('games.poll_votes') is not null then
    drop trigger if exists passport_poll_ai on games.poll_votes;
    create trigger passport_poll_ai after insert on games.poll_votes for each row execute function games.passport_poll_after();
  end if;
  if to_regclass('games.arcade_scores') is not null then
    drop trigger if exists passport_arcade_ai on games.arcade_scores;
    create trigger passport_arcade_ai after insert on games.arcade_scores for each row execute function games.passport_arcade_after();
  end if;
  drop trigger if exists passport_secret_ai on games.passport_secrets;
  create trigger passport_secret_ai after insert on games.passport_secrets for each row execute function games.passport_secret_after();
  drop trigger if exists passport_result_ai on games.results;
  create trigger passport_result_ai after insert on games.results for each row execute function games.passport_result_after();
end $$;

-- ---------- daily rules, run by the check-in (once a visit) ----------
-- Pepe Guesser points of one player in a date range (verified plays only), and the same for a whole board
create or replace function games.passport_daily(u uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  wk date := (date_trunc('week', (now() at time zone 'utc'))::date) - 7;   -- last finished Monday-Sunday week
  joined timestamptz;
  games_played integer := 0;
  mine numeric;
  se jsonb := games.season_at(now());
  cur integer := (se->>'no')::int;
  w record;
  sn integer;
begin
  -- Certified Fren: 100 different UTC days
  if (select count(*) from games.passport_days where user_id = u) >= 100 then perform games.passport_award(u, 'certified_fren'); end if;
  -- Old Frog: one year since the first Discord log-on (the Discord identity's creation time)
  select min(coalesce((to_jsonb(i)->>'created_at')::timestamptz, au.created_at)) into joined
    from auth.identities i join auth.users au on au.id = i.user_id where i.user_id = u and i.provider = 'discord';
  if joined is not null and joined <= now() - interval '365 days' then perform games.passport_award(u, 'old_frog'); end if;
  -- Frogmas: a visit on 24, 25 or 26 December (UTC)
  if extract(month from today) = 12 and extract(day from today) between 24 and 26 then perform games.passport_award(u, 'frogmas'); end if;
  -- Arcade Hopper: a score kept by the server in 5 different games
  games_played :=
      (case when exists (select 1 from games.yeet_records y where y.user_id = u and y.best > 0) then 1 else 0 end)
    + (case when exists (select 1 from games.wp_plays x where x.user_id = u and x.verified and x.guessed_at is not null) then 1 else 0 end)
    + (case when to_regclass('games.arcade_scores') is not null
              and exists (select 1 from games.arcade_scores a where a.user_id = u and a.game = 'fud') then 1 else 0 end)
    + (case when to_regclass('games.arcade_scores') is not null
              and exists (select 1 from games.arcade_scores a where a.user_id = u and a.game = 'snake') then 1 else 0 end)
    + (case when exists (select 1 from games.miner_saves s where s.user_id = u) then 1 else 0 end)
    + (case when exists (select 1 from games.results r join games.matches m on m.id = r.match_id
                          where r.user_id = u and r.verified and m.mode = 'obrazek') then 1 else 0 end)
    + (case when exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = 'good_game') then 1 else 0 end);
  if games_played >= 5 then perform games.passport_award(u, 'arcade_hopper'); end if;
  -- Top 10: YEET board, Pepe Guesser week board (last 7 days), Pepe Pictures season ranking
  select y.best into mine from games.yeet_records y where y.user_id = u;
  if coalesce(mine, 0) > 0 and (select count(*) from games.yeet_records y where y.best > mine) < 10 then
    perform games.passport_award(u, 'top_ten');
  end if;
  select sum(x.points) into mine from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
   where x.user_id = u and x.verified and x.guessed_at is not null and q.day > today - 7;
  if coalesce(mine, 0) > 0 and (select count(*) from (
        select x.user_id from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
         where x.guessed_at is not null and q.day > today - 7 group by x.user_id having sum(x.points) > mine) z) < 10 then
    perform games.passport_award(u, 'top_ten');
  end if;
  if cur is not null then
    select sum(4 - g.place) into mine from games.guesses g join games.matches m on m.id = g.match_id
     where g.user_id = u and g.verified and m.ranked and m.season_no = cur and m.mode = 'obrazek';
    if coalesce(mine, 0) > 0 and (select count(*) from (
          select 1 from games.guesses g join games.matches m on m.id = g.match_id
           where m.ranked and m.season_no = cur and m.mode = 'obrazek'
           group by case when g.verified then 'u:' || g.user_id::text else 'g:' || g.nick_key end
          having sum(4 - g.place) > mine) z) < 10 then
      perform games.passport_award(u, 'top_ten');
    end if;
  end if;
  -- Frog of the Week: settle the last finished week once (Monday-Sunday, UTC); every tied first place wins
  insert into games.passport_weeks (week_start) values (wk) on conflict (week_start) do nothing;
  if found then
    for w in select z.user_id from (
        select x.user_id, rank() over (order by sum(x.points) desc) r
          from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
         where x.verified and x.guessed_at is not null and q.day between wk and wk + 6
         group by x.user_id) z where z.r = 1 loop
      if games.discord_identity(w.user_id) is not null then
        insert into games.passport_badges (user_id, badge_id, earned_at, times) values (w.user_id, 'frog_of_the_week', clock_timestamp(), 1)
        on conflict (user_id, badge_id) do update set times = games.passport_badges.times + 1, earned_at = excluded.earned_at, notified_at = null;
      end if;
    end loop;
  end if;
  -- Season Champion: first place of each finished ranked Pepe Pictures season (settled once, held once)
  for sn in select distinct m.season_no from games.matches m
             where m.ranked and m.mode = 'obrazek' and m.season_no is not null
               and (m.season_no < coalesce(cur, 0) or (m.season_no = cur and se->>'phase' = 'break'))
               and not exists (select 1 from games.passport_seasons p where p.season_no = m.season_no) loop
    insert into games.passport_seasons (season_no) values (sn) on conflict (season_no) do nothing;
    if found then
      for w in select z.uid from (
          select (array_agg(g.user_id))[1] uid, bool_or(g.verified) ver,
                 rank() over (order by sum(4 - g.place) desc, count(*) filter (where g.place = 1) desc,
                                       count(*) filter (where g.place = 2) desc, max(g.at) asc) r
            from games.guesses g join games.matches m on m.id = g.match_id
           where m.ranked and m.mode = 'obrazek' and m.season_no = sn
           group by case when g.verified then 'u:' || g.user_id::text else 'g:' || g.nick_key end) z
         where z.r = 1 and z.ver loop
        perform games.passport_award(w.uid, 'season_champion');
      end loop;
    end if;
  end loop;
end
$$;
revoke all on function games.passport_daily(uuid) from public, anon, authenticated;

create or replace function public.gry_passport_checkin()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  n integer;
  fresh jsonb;
begin
  if u is null or games.discord_identity(u) is null then
    return jsonb_build_object('signed_in', false);
  end if;
  insert into games.passport_days (user_id, day) values (u, today) on conflict (user_id, day) do nothing;
  if found then
    -- Welcome Back!: the first visit was yesterday, and this is the second one
    if (select count(*) from games.passport_days where user_id = u) = 2
       and exists (select 1 from games.passport_days where user_id = u and day = today - 1) then
      perform games.passport_award(u, 'welcome_back');
    end if;
    -- days are unique, so 14 rows in the last 14 days are 14 days in a row (and 30 in 30)
    select count(*) into n from games.passport_days where user_id = u and day > today - 14;
    if n >= 14 then perform games.passport_award(u, 'streak_14'); end if;
    select count(*) into n from games.passport_days where user_id = u and day > today - 30;
    if n >= 30 then perform games.passport_award(u, 'like_it_here'); end if;
  end if;
  -- the daily rules (Certified Fren, Old Frog, Frogmas, Arcade Hopper, Top 10, Frog of the Week, Season Champion)
  begin
    perform games.passport_daily(u);
  exception when others then
    raise warning 'passport daily hook: %', sqlerrm;
  end;
  -- Fresh Fren has its own notice in the Avatar Maker
  with shown as (
    update games.passport_badges b set notified_at = clock_timestamp()
     where b.user_id = u and b.notified_at is null and b.badge_id <> 'first_avatar'
    returning b.badge_id, b.earned_at)
  select coalesce(jsonb_agg(jsonb_build_object('id', badge_id, 'earned_at', earned_at) order by earned_at), '[]'::jsonb)
    into fresh from shown;
  return jsonb_build_object('signed_in', true, 'new_badges', fresh);
end
$$;
revoke all on function public.gry_passport_checkin() from public, anon, authenticated;
grant execute on function public.gry_passport_checkin() to authenticated;

-- ---------- Passport read path ----------
-- The newest definition (update_fren_avatar.sql had the previous one). Changes: Moonwalker is a stored
-- stamp now, and 'progress' carries the server's own counters for the Next Milestone bar.
create or replace function public.gry_passport_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb;
  joined timestamptz;
  best_distance integer := 0;
  extra_badges jsonb;
  discovered jsonb;
  owned_items jsonb;
  earned_count integer;
  badge_catalog jsonb;
  look jsonb;
  pr games.passport_progress%rowtype;
  login_streak integer := 0;
  day0 date := (now() at time zone 'utc')::date;
  progress jsonb;
begin
  -- Anonymous Supabase users also have auth.uid(). Require Discord specifically.
  if u is null then
    return jsonb_build_object('signed_in', false);
  end if;
  d := games.discord_identity(u);
  if d is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select au.created_at into joined
    from auth.users au where au.id = u;

  select coalesce(y.best, 0) into best_distance
    from games.yeet_records y where y.user_id = u;
  best_distance := coalesce(best_distance, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.badge_id,
           'title', case b.badge_id when 'first_avatar' then 'Fresh Fren' else b.badge_id end,
           'description', 'Awarded by a PepecoinHub game',
           'earned_at', b.earned_at, 'times', b.times) order by b.earned_at), '[]'::jsonb)
    into extra_badges
    from games.passport_badges b where b.user_id = u and b.badge_id <> 'certified_fren';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.secret_id, 'discovered_at', s.discovered_at)
           order by s.discovered_at), '[]'::jsonb)
    into discovered
    from games.passport_secrets s where s.user_id = u;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.item_id, 'quantity', i.quantity, 'earned_at', i.earned_at)
           order by i.earned_at), '[]'::jsonb)
    into owned_items
    from games.passport_items i where i.user_id = u;

  select jsonb_build_object('schema_version', a.schema_version,
           'bg', a.bg, 'clothing', a.clothing,
           'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'accessory', a.accessory, 'special', a.special)
    into look
    from games.passport_avatars a where a.user_id = u;

  select * into pr from games.passport_progress p where p.user_id = u;
  -- current run of PondOS days, ending today (or yesterday, before today's first visit)
  if not exists (select 1 from games.passport_days x where x.user_id = u and x.day = day0) then day0 := day0 - 1; end if;
  while login_streak < 400 and exists (select 1 from games.passport_days x where x.user_id = u and x.day = day0 - login_streak) loop
    login_streak := login_streak + 1;
  end loop;
  progress := jsonb_build_object(
    'yeet_5k_flights', (select count(*) from games.passport_yeet_5k f where f.user_id = u),
    'yeet_5k_total', coalesce(pr.yeet_5k_total, 0),
    'login_days', (select count(*) from games.passport_days x where x.user_id = u),
    'letters', coalesce(pr.letters, 0),
    'miner_minutes', coalesce(pr.miner_seconds, 0) / 60,
    'chat_days', (select count(*) from games.passport_chat_days c where c.user_id = u),
    'login_streak', login_streak,
    'wp_days', (select count(*) from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                 where x.user_id = u and x.verified and x.g_lat is not null and q.day is not null),
    'wp_perfect_days', (select count(*) from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                 where x.user_id = u and x.verified and x.g_lat is not null and x.points = 5000 and q.day is not null),
    'wp_streak', games.passport_wp_streak(u));

  badge_catalog := jsonb_build_array(
    jsonb_build_object('id', 'first_fren', 'title', 'First Fren',
      'description', 'Joined the pond with Discord.', 'earned_at', joined),
    jsonb_build_object('id', 'certified_fren', 'title', 'Certified Fren',
      'description', '100 distinct days of signed-in PondOS activity.',
      'earned_at', (select b.earned_at from games.passport_badges b
                    where b.user_id = u and b.badge_id = 'certified_fren'))
  );
  select count(*) into earned_count from jsonb_array_elements(badge_catalog) x
    where x->>'earned_at' is not null;
  earned_count := earned_count + jsonb_array_length(extra_badges);

  return jsonb_build_object(
    'signed_in', true,
    'nickname', coalesce(nullif(d->>'name', ''), 'Discord fren'),
    'member_since', joined,
    'yeet_best', best_distance,
    'achievements', badge_catalog || extra_badges,
    'achievements_earned', earned_count,
    'secrets', discovered,
    'items', owned_items,
    'avatar', look,
    'progress', progress,
    'care_days', null
  );
end
$$;
revoke all on function public.gry_passport_state() from public, anon, authenticated;
grant execute on function public.gry_passport_state() to authenticated;

-- internal helpers: never callable by the browser
revoke all on function games.passport_award(uuid, text, timestamptz), games.passport_yeet_flight(uuid, integer),
  games.passport_wp_check(uuid), games.passport_wp_streak(uuid), games.passport_wp_after(),
  games.passport_chat_after(), games.passport_mention_after(), games.passport_letter_after(),
  games.passport_miner_after() from public, anon, authenticated;

-- ---------- one-time work on the first run ----------
do $$
declare launch timestamptz; r record;
begin
  -- Pond Pioneer: every account with Discord linked right now. Never again after this run.
  insert into games.passport_meta (k) values ('pioneer_snapshot') on conflict (k) do nothing returning at into launch;
  if launch is not null then
    insert into games.passport_badges (user_id, badge_id, earned_at)
    select distinct i.user_id, 'pond_pioneer', launch
      from auth.identities i join auth.users au on au.id = i.user_id
     where i.provider = 'discord'
    on conflict (user_id, badge_id) do nothing;
  end if;
end $$;

-- Backfills from records the games already keep (safe to repeat: awards are on conflict do nothing).
-- Moonwalker: a 6000 m record, dated when it was flown.
select games.passport_award(y.user_id, 'moonwalker', y.achieved_at)
  from games.yeet_records y where y.best >= 60000;
-- Adept: a 3000 m record
select games.passport_award(y.user_id, 'yeet_adept', y.achieved_at)
  from games.yeet_records y where y.best >= 30000;
-- Podium: top 3 of a finished Pepe Pictures game
select games.passport_award(r.user_id, 'podium', r.finished_at)
  from games.results r join games.matches m on m.id = r.match_id where r.verified and r.place <= 3 and m.mode = 'obrazek';
-- Pepe Guesser: every Discord player with a verified play.
select games.passport_wp_check(p.user_id)
  from (select distinct x.user_id from games.wp_plays x where x.verified and x.g_lat is not null) p;
-- Letters: the server still has them (only read letters beyond the newest 2000 are ever deleted).
insert into games.passport_progress (user_id, letters)
select l.user_id, count(*) from games.letters l
  join auth.users au on au.id = l.user_id
 where l.discord group by l.user_id
on conflict (user_id) do nothing;
select games.passport_award(l.user_id, 'dear_editor', l.created_at)
  from (select user_id, created_at, row_number() over (partition by user_id order by created_at, id) as k
          from games.letters where discord) l
 where l.k = 1;
-- I Voted, FUD Buster, Long Snake, Secret Starter, Treasure Hunter: from records that already exist
do $$ begin
  if to_regclass('games.poll_votes') is not null then
    perform games.passport_award(v.user_id, 'i_voted', v.voted_at) from games.poll_votes v where v.verified;
  end if;
  if to_regclass('games.arcade_scores') is not null then
    perform games.passport_award(a.user_id, case a.game when 'fud' then 'fud_buster' else 'long_snake' end, a.created_at)
       from games.arcade_scores a
      where a.verified and a.user_id is not null and ((a.game = 'fud' and a.score >= 2000) or (a.game = 'snake' and a.score >= 40));
  end if;
end $$;
select games.passport_award(s.user_id, 'secret_starter') from (select distinct user_id from games.passport_secrets) s;
select games.passport_award(s.user_id, 'treasure_hunter') from (select user_id from games.passport_secrets group by user_id having count(*) >= 6) s;
-- Happy Mining!: everyone who already has a Pepe Miner cloud save.
select games.passport_award(m.user_id, 'rookie_miner') from games.miner_saves m;
-- Stamps retired or re-ruled by the v3 list (2026-11-08). The Passport is not public yet, so nothing
-- anyone has seen is removed; this only matters if an earlier draft of this file already ran.
delete from games.passport_badges
 where badge_id = 'miner_fren'
    or (badge_id in ('junior_editor', 'senior_editor')
        and not exists (select 1 from information_schema.columns
                         where table_schema = 'games' and table_name = 'letters' and column_name = 'printed_at'));

commit;
