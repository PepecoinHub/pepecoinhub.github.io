-- Pepe Guesser: weekly ranking (Monday-Sunday UTC), Days at #1, Longest Guessing Streak, Pond Dominator, Hall of Fame.
-- Run once in the Supabase SQL editor, after update_wheres_pepe*.sql, update_fren_passport.sql, update_fren_avatar.sql
-- and update_passport_awards.sql. Then run update_passport_awards.sql once more (its passport_daily() hands the
-- Weekly Champion / Frog of the Week settlement to games.wp_settle() below). Safe to run again.
--
-- How it works (games/WP_HALL_OF_FAME.md has the long version)
--   * Nothing new is scored. Everything comes from games.wp_plays, which the server already writes and scores.
--     A play counts when it is Discord-verified and finished (guessed_at); each puzzle is one UTC day, so a day
--     gives at most 5000 points. The host's plays never count (the host approves the photos and knows the answers).
--   * games.wp_settle() closes finished UTC days and weeks, oldest first, from games.config.wp_hof_start on:
--       - one row per day in games.wp_days: the leader of the week's ranking at 23:59:59 UTC (points from Monday
--         through that day). Exactly one player with the most points (> 0) leads; a tie at the top leads nobody.
--       - one row per week in games.wp_weeks: the Sunday leader is the Weekly Champion (Frog of the Week stamp,
--         one more each win); a tie on Sunday means no winner. Leading all 7 days alone gives Pond Dominator.
--     Day and week are the primary keys, every insert is "on conflict do nothing", and stamps are given only
--     by the call that inserted the row, so running it again (or twice at the same time) never pays twice.
--   * Who runs it: pg_cron every night just after 00:00 UTC when that extension is on (see the end of this file),
--     the Passport check-in, and the Hall of Fame / stats reads. Late runs give the same result: a day's points
--     are fixed once that day's puzzle is over.
--   * The Hall of Fame starts with the launch of the Fren Passport and the Avatar Maker (owner, 2026-11-11):
--     wp_hof_start is the first Monday on or after the launch, the moment update_passport_awards.sql first ran
--     (games.passport_meta 'pioneer_snapshot'). Launch on a Monday: that Monday. Before the launch nothing is settled.
--     Days before wp_hof_start are never filled in afterwards (no history is rebuilt from old data).
--   * Version A (owner, 2026-11-11): nothing before the start counts, the Longest Guessing Streak included.
--   * Longest Guessing Streak is worked out from the plays themselves, with the same rule as the Passport's
--     current streak (games.passport_wp_streak): Discord-verified plays with a pin, one per UTC day.

-- ---------- settings ----------
alter table games.config add column if not exists wp_hof_start date;
do $$ begin
  alter table games.config add constraint config_wp_hof_start_monday check (wp_hof_start is null or extract(isodow from wp_hof_start) = 1);
exception when duplicate_object then null; end $$;

-- the start: the first Monday (UTC) on or after the Passport launch; stays null until the launch has happened
create or replace function games.wp_hof_begin() returns date
language plpgsql volatile security definer set search_path = '' as $$
declare st date; launch date;
begin
  select c.wp_hof_start into st from games.config c where c.id = 1;
  if st is not null then return st; end if;
  if to_regclass('games.passport_meta') is null then return null; end if;
  select (m.at at time zone 'utc')::date into launch from games.passport_meta m where m.k = 'pioneer_snapshot';
  if launch is null then return null; end if;
  st := launch + ((8 - extract(isodow from launch)::int) % 7);
  -- the Passport season start (update_passport_season.sql, Monday 16 XI 2026): never earlier than that
  if to_regprocedure('games.passport_start_day()') is not null then
    st := greatest(st, games.passport_start_day());
    st := st + ((8 - extract(isodow from st)::int) % 7);
  end if;
  update games.config set wp_hof_start = st where id = 1 and wp_hof_start is null;
  return (select c.wp_hof_start from games.config c where c.id = 1);
end
$$;

-- the stored start, read only (null until the launch): Longest Guessing Streak counts days from it on
create or replace function games.wp_hof_start() returns date
language sql stable security definer set search_path = '' as $$
  select c.wp_hof_start from games.config c where c.id = 1
$$;

-- ---------- tables (server only) ----------
create table if not exists games.wp_days (
  day          date primary key,                                   -- the UTC day, settled at its 23:59:59
  week_start   date not null check (extract(isodow from week_start) = 1),
  leader_id    uuid,                                               -- null: nobody scored, or a tie at the top
  leader_nick  text,
  points       integer not null default 0 check (points >= 0),     -- the top week total at the end of the day
  tied         boolean not null default false,
  players      integer not null default 0,
  settled_at   timestamptz not null default clock_timestamp(),
  check (day between week_start and week_start + 6),
  check (leader_id is null or not tied)
);
create index if not exists wp_days_leader on games.wp_days (leader_id) where leader_id is not null;
create index if not exists wp_days_week on games.wp_days (week_start);

create table if not exists games.wp_weeks (
  week_start   date primary key check (extract(isodow from week_start) = 1),
  winner_id    uuid,                                               -- null: a tie on Sunday, or nobody played
  winner_nick  text,
  points       integer not null default 0 check (points >= 0),
  tied         boolean not null default false,
  players      integer not null default 0,
  dominator    boolean not null default false,                     -- the winner led alone on all 7 days
  settled_at   timestamptz not null default clock_timestamp(),
  check (winner_id is null or not tied),
  check (not dominator or winner_id is not null)
);
create index if not exists wp_weeks_winner on games.wp_weeks (winner_id) where winner_id is not null;

alter table games.wp_days enable row level security;
alter table games.wp_weeks enable row level security;
revoke all on games.wp_days, games.wp_weeks from public, anon, authenticated;

-- ---------- the week's ranking ----------
-- Monday 00:00 UTC of the week a day belongs to
create or replace function games.wp_monday(d date) returns date
language sql immutable set search_path = '' as $$
  select d - (extract(isodow from d)::int - 1)
$$;

-- every counted player's points from Monday p_week through p_through (official plays only)
create or replace function games.wp_standings(p_week date, p_through date)
returns table (user_id uuid, nick text, points bigint)
language sql stable security definer set search_path = '' as $$
  select x.user_id, (array_agg(x.nick order by q.day desc))[1], sum(least(greatest(x.points, 0), 5000))::bigint
    from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
   where x.verified and x.guessed_at is not null and x.points is not null
     and q.day between p_week and p_through
     and games.discord_identity(x.user_id) is not null
     and not games.is_host_user(x.user_id)
   group by x.user_id
$$;

-- Pond Dominator: once per account, for a settled week the winner led alone on all 7 days (wp_weeks.dominator).
-- Given from the stored week, so it also arrives when passport_award() learned the stamp after the week was settled.
create or replace function games.wp_dominator_stamps() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare w record;
begin
  if to_regclass('games.passport_badges') is null then return; end if;
  for w in select x.winner_id, min(x.settled_at) at from games.wp_weeks x
            where x.dominator and not exists (select 1 from games.passport_badges b where b.user_id = x.winner_id and b.badge_id = 'pond_dominator')
            group by x.winner_id loop
    begin
      perform games.passport_award(w.winner_id, 'pond_dominator', w.at);
    exception when others then
      raise warning 'wp settle: pond_dominator: %', sqlerrm;   -- an older passport_award() without this stamp
    end;
  end loop;
end
$$;

-- ---------- settlement ----------
create or replace function games.wp_settle() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  st date;
  today date := (now() at time zone 'utc')::date;
  last_week date := games.wp_monday((now() at time zone 'utc')::date) - 7;   -- the last finished week
  d date;
  ws date;
  top bigint;
  n_top integer;
  n_all integer;
  who uuid;
  who_nick text;
  sun games.wp_days;
  alone integer;
  got date;
  nd integer := 0;
  nw integer := 0;
begin
  st := games.wp_hof_begin();
  if st is null or st >= today then return jsonb_build_object('days', 0, 'weeks', 0); end if;
  -- already up to date: yesterday is settled, and so is the last finished week
  if exists (select 1 from games.wp_days where day = today - 1)
     and (last_week < st or exists (select 1 from games.wp_weeks where week_start = last_week)) then
    perform games.wp_dominator_stamps();
    return jsonb_build_object('days', 0, 'weeks', 0);
  end if;
  -- one settlement at a time (the second caller waits, then finds everything done)
  perform pg_advisory_xact_lock(hashtext('games.wp_settle'));

  -- days, oldest first
  for d in select g::date from generate_series(st, today - 1, interval '1 day') g
            where not exists (select 1 from games.wp_days x where x.day = g::date) order by 1 loop
    ws := games.wp_monday(d);
    select max(s.points), count(*) into top, n_all from games.wp_standings(ws, d) s;
    select count(*) into n_top from games.wp_standings(ws, d) s where s.points = top;
    who := null; who_nick := null;
    if coalesce(top, 0) > 0 and n_top = 1 then
      select s.user_id, s.nick into who, who_nick from games.wp_standings(ws, d) s where s.points = top;
    end if;
    insert into games.wp_days (day, week_start, leader_id, leader_nick, points, tied, players)
    values (d, ws, who, who_nick, coalesce(top, 0), coalesce(top, 0) > 0 and n_top > 1, coalesce(n_all, 0))
    on conflict (day) do nothing;
    if found then nd := nd + 1; end if;
  end loop;

  -- weeks whose Sunday is settled, oldest first
  for ws in select x.week_start from games.wp_days x
             where x.day = x.week_start + 6 and x.week_start >= st
               and not exists (select 1 from games.wp_weeks w where w.week_start = x.week_start)
             order by 1 loop
    if (select count(*) from games.wp_days x where x.week_start = ws) <> 7 then continue; end if;
    select * into sun from games.wp_days x where x.day = ws + 6;
    select count(*) into alone from games.wp_days x where x.week_start = ws and x.leader_id = sun.leader_id and not x.tied;
    insert into games.wp_weeks (week_start, winner_id, winner_nick, points, tied, players, dominator)
    values (ws, sun.leader_id, sun.leader_nick, sun.points, sun.tied, sun.players, sun.leader_id is not null and alone = 7)
    on conflict (week_start) do nothing
    returning week_start into got;
    if got is null then continue; end if;
    nw := nw + 1; got := null;
    -- this week is settled here, so the older Frog of the Week rule in passport_daily() leaves it alone
    if to_regclass('games.passport_weeks') is not null then
      insert into games.passport_weeks (week_start) values (ws) on conflict (week_start) do nothing;
    end if;
    -- Frog of the Week: only from the call that inserted the week, only Discord accounts. Pond Dominator: below.
    if sun.leader_id is not null and to_regclass('games.passport_badges') is not null
       and games.discord_identity(sun.leader_id) is not null then
      insert into games.passport_badges (user_id, badge_id, earned_at, times) values (sun.leader_id, 'frog_of_the_week', clock_timestamp(), 1)
      on conflict (user_id, badge_id) do update set times = games.passport_badges.times + 1, earned_at = excluded.earned_at, notified_at = null;
    end if;
  end loop;
  perform games.wp_dominator_stamps();
  return jsonb_build_object('days', nd, 'weeks', nw);
end
$$;

-- ---------- Longest Guessing Streak ----------
-- the longest run of UTC puzzle days with a Discord-verified play with a pin (the rule of passport_wp_streak)
create or replace function games.wp_longest_streak(u uuid) returns integer
language sql stable security definer set search_path = '' as $$
  with days as (
    select distinct q.day from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
     where x.user_id = u and x.verified and x.g_lat is not null and x.guessed_at is not null and q.day is not null
       and q.day >= coalesce(games.wp_hof_start(), 'infinity'::date)),
  runs as (select day - (row_number() over (order by day))::int as grp from days)
  select coalesce(max(n), 0)::int from (select count(*) n from runs group by grp) r
$$;

-- what a player's public card shows next to their name (no ids, no counters that tell when someone is around)
create or replace function games.wp_card(u uuid, with_id boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', case when with_id and games.discord_identity(u) is not null then u end,
    'nick', coalesce((select x.nick from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                       where x.user_id = u and x.verified order by q.day desc nulls last limit 1), 'fren'),
    'avatar', (select jsonb_build_object('schema_version', a.schema_version, 'bg', a.bg, 'clothing', a.clothing,
                 'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'accessory', a.accessory, 'special', a.special)
                 from games.passport_avatars a where a.user_id = u)))
$$;

-- after the launch, the first run of this file already fixes the start
select games.wp_hof_begin();

-- ---------- browser RPCs (read only, apart from closing finished days) ----------
-- a player's Pepe Guesser records: yours (p_user null), or another Discord fren's when you are logged on with Discord
create or replace function public.gry_wp_stats(p_user uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); u uuid := coalesce(p_user, auth.uid());
begin
  if me is null or games.discord_identity(me) is null then return jsonb_build_object('signed_in', false); end if;
  if games.discord_identity(u) is null then return jsonb_build_object('signed_in', true, 'found', false); end if;
  begin perform games.wp_settle(); exception when others then raise warning 'wp settle: %', sqlerrm; end;
  return jsonb_build_object('signed_in', true, 'found', true,
    'days_at_1', (select count(*) from games.wp_days x where x.leader_id = u),
    'weeks_won', (select count(*) from games.wp_weeks w where w.winner_id = u),
    'longest_streak', games.wp_longest_streak(u),
    'since', games.wp_hof_begin());
end
$$;

-- the Hall of Fame window: past weeks, and the all-time boards (one per category, never mixed)
create or replace function public.gry_wp_hof(p_limit integer default 20) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); ids boolean; lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  begin perform games.wp_settle(); exception when others then raise warning 'wp settle: %', sqlerrm; end;
  ids := me is not null and games.discord_identity(me) is not null;   -- passports open by id, for Discord frens only
  return jsonb_build_object(
    'since', games.wp_hof_begin(),
    'weeks', coalesce((select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start, 'week_end', w.week_start + 6,
        'year', to_char(w.week_start, 'IYYY')::int, 'week', to_char(w.week_start, 'IW')::int,
        'points', w.points, 'tied', w.tied, 'players', w.players, 'dominator', w.dominator,
        'winner', case when w.winner_id is not null then games.wp_card(w.winner_id, ids) || jsonb_build_object('nick', w.winner_nick) end)
        order by w.week_start desc)
      from (select * from games.wp_weeks order by week_start desc limit 52) w), '[]'::jsonb),
    'legends', jsonb_build_object(
      'weeks', coalesce((select jsonb_agg(games.wp_card(t.u, ids) || jsonb_build_object('value', t.n, 'rank', t.r) order by t.r, t.u)
          from (select winner_id u, count(*) n, rank() over (order by count(*) desc) r from games.wp_weeks
                 where winner_id is not null group by winner_id order by 2 desc limit lim) t), '[]'::jsonb),
      'days', coalesce((select jsonb_agg(games.wp_card(t.u, ids) || jsonb_build_object('value', t.n, 'rank', t.r) order by t.r, t.u)
          from (select leader_id u, count(*) n, rank() over (order by count(*) desc) r from games.wp_days
                 where leader_id is not null group by leader_id order by 2 desc limit lim) t), '[]'::jsonb),
      'streak', coalesce((select jsonb_agg(games.wp_card(t.u, ids) || jsonb_build_object('value', t.n, 'rank', t.r) order by t.r, t.u)
          from (select s.u, s.n, rank() over (order by s.n desc) r from (
                  select r.user_id u, max(r.len) n from (
                    select z.user_id, count(*) len from (
                      select d.user_id, d.day - (row_number() over (partition by d.user_id order by d.day))::int grp
                        from (select distinct x.user_id, q.day from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                               where x.verified and x.g_lat is not null and x.guessed_at is not null and q.day is not null
                                 and q.day >= coalesce(games.wp_hof_start(), 'infinity'::date)
                                 and games.discord_identity(x.user_id) is not null
                                 and not games.is_host_user(x.user_id)) d) z
                     group by z.user_id, z.grp) r group by r.user_id) s
                order by s.n desc limit lim) t), '[]'::jsonb)));
end
$$;

-- ---------- the live week board: Monday 00:00 UTC to Sunday 23:59:59 UTC ----------
-- The same top 10 as update_wheres_pepe_top_all.sql, with 'week' meaning this Monday-Sunday week (it was the last
-- 7 days). The host's plays stay out, as in update_wheres_pepe_hide_host.sql (PR #251): only the host sees their own
-- row, marked hidden. If that file runs after this one, run this one again (it would bring back the rolling 7 days).
create or replace function public.gry_wp_top(p_scope text default 'day') returns jsonb
language sql stable security definer set search_path = '' as $$
with d as (select (now() at time zone 'utc')::date as today),
rows as (
select x.user_id, max(x.nick) nick, bool_or(x.verified) ver, max(x.ip_hash) ip, sum(x.points) pts, count(*) n, min(x.guessed_at - x.started_at) best_time
from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id, d
where x.guessed_at is not null
and (case when p_scope = 'week' then q.day between games.wp_monday(d.today) and d.today else q.day = d.today end)
group by x.user_id),
seen as (
select r.*, games.is_host_user(r.user_id) host from rows r),
one as (
select *, row_number() over (partition by case when ver then user_id::text else coalesce(ip, user_id::text) end order by pts desc, best_time) k
from seen
where not host or user_id = auth.uid())
select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'points', pts, 'played', n, 'verified', ver, 'hidden', host) order by pts desc, best_time), '[]'::jsonb)
from (select * from one where k = 1 order by pts desc, best_time limit 10) t
$$;

-- ---------- access ----------
revoke all on function games.wp_hof_begin(), games.wp_monday(date), games.wp_standings(date, date), games.wp_settle(), games.wp_dominator_stamps(), games.wp_longest_streak(uuid),
  games.wp_card(uuid, boolean) from public, anon, authenticated;
revoke all on function games.wp_hof_start() from public, anon, authenticated;
revoke all on function public.gry_wp_stats(uuid), public.gry_wp_hof(integer) from public;
grant execute on function public.gry_wp_hof(integer) to anon, authenticated;
grant execute on function public.gry_wp_stats(uuid) to authenticated;
-- gry_wp_top keeps the grants it already has (create or replace does not change them)

-- ---------- nightly run (only when the pg_cron extension is on) ----------
-- Supabase: Database > Extensions > pg_cron, then run this file again. Without it the reads above settle on demand.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.schedule('wp-settle', '1 0 * * *', 'select games.wp_settle()')$c$;
  end if;
end $$;
