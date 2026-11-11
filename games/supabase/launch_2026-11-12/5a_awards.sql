-- Fren Passport: stamps the server can verify, awarded by the games themselves.
-- DRAFT. Apply to PH-games only after review, in this order:
--   update_fren_passport.sql -> update_fren_avatar.sql -> this file.
-- It also needs the game migrations it hooks into (already on production):
--   update_yeet.sql, update_wheres_pepe.sql (+ _guests), update_lobby_chat.sql, update_open_chat.sql,
--   update_lobby_mentions.sql, update_frog_letters.sql, update_letters_community.sql, update_miner_cloud.sql.
-- Safe to run twice.
--
-- RUN IT FOR THE PUBLIC BETA (Thursday 12 XI 2026), before the Passport opens to everyone.
-- Season start (games.passport_start(), update_fren_passport.sql): Monday 16 XI 00:00 Warsaw time.
--   * Before it (the beta) the server gives only Pond Pioneer: to every account with Discord linked when
--     this file first runs, and to every Discord fren who opens PondOS until the start.
--   * From it on, every other stamp works, from zero: nothing dated before the start counts, and there are
--     no backfills from old records. Pond Pioneer can no longer be earned.
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
--   junior_editor, senior_editor, vox_populi   1, 5 and 10 letters the owner marked "Printed" (gry_letter_printed)
--   bug_hunter      given by the owner from the mailbox (gry_letter_bug_hunter)
--   bali            for every fren once the owner opens it, the day Pepecoin reaches $0.01 (gry_passport_bali)
-- The editor stamps are never awarded from the number of letters sent (owner, 2026-11-08).
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
      'quiz_master', 'certified_fren', 'old_frog', 'arcade_hopper', 'frogmas', 'top_ten', 'season_champion', 'frog_of_the_week',
      'junior_editor', 'senior_editor', 'vox_populi', 'bug_hunter', 'bali') then
    raise exception 'Unknown passport stamp %', b;
  end if;
  if u is null or games.discord_identity(u) is null then return false; end if;
  -- Season start: in the beta only Pond Pioneer, and Pond Pioneer only in the beta.
  -- From the start on, nothing dated before it counts (no head starts from old records).
  if b = 'pond_pioneer' then
    if games.passport_open() then return false; end if;
  elsif not games.passport_open() or (at is not null and at < games.passport_start()) then
    return false;
  end if;
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
  if p_score is null or not games.passport_open() then return; end if;
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
     where x.user_id = u and x.verified and x.g_lat is not null and x.guessed_at is not null and q.day is not null
       and q.day >= games.passport_start_day()),
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
  while s < 400 and d - s >= games.passport_start_day() and exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
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
  if new.verified and new.user_id is not null and games.passport_open() then
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


commit;
