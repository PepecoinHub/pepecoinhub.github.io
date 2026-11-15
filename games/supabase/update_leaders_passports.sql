-- LEADERS and the Pepe Guesser ranking: a name opens that fren's Fren Passport (read only).
-- Every top 10 row of a Discord player now carries 'id', but only when the one asking is logged on with Discord
-- (the same rule as the Hall of Fame, update_wheres_pepe_hall_of_fame.sql, and gry_passport_public). Guests and
-- anonymous visitors get exactly what they got before. Nothing else changes: same rows, same order, same grants.
-- Run once in the Supabase SQL editor, AFTER update_arcade.sql, update_miner_top.sql, update_yeet_guests.sql and
-- update_wheres_pepe_hall_of_fame.sql (if one of those runs again later, run this file again). Safe to run again.

-- the id a top 10 row may show: the row's player is on Discord and so is the one asking; otherwise null
create or replace function games.lead_id(u uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case when u is not null and auth.uid() is not null
               and games.discord_identity(auth.uid()) is not null
               and games.discord_identity(u) is not null then u end
$$;
revoke all on function games.lead_id(uuid) from public, anon, authenticated;

-- FUD Invaders, PEP Snake, Pepe Gold Hook (from update_arcade.sql, plus 'id')
create or replace function public.gry_arcade_top(p_game text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (case when verified then user_id::text else 'n:' || lower(nick) end)
           user_id, nick, score, verified, created_at
      from games.arcade_scores
     where game = p_game
     order by case when verified then user_id::text else 'n:' || lower(nick) end, score desc, created_at
  ), top as (
    select * from best order by score desc, created_at limit 10
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('nick', nick, 'score', score, 'verified', verified, 'at', created_at,
                              'id', case when verified then games.lead_id(user_id) end))
                            order by score desc, created_at), '[]'::jsonb) from top
$$;

-- Pepe Miner (from update_miner_top.sql, plus 'id')
create or replace function public.gry_miner_top() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('nick', t.nick, 'score', t.blocks, 'verified', true, 'id', games.lead_id(t.user_id)))
                order by t.blocks desc, t.updated_at), '[]'::jsonb)
from (select s.user_id, left(coalesce(games.discord_identity(s.user_id)->>'name', 'Discord miner'), 32) nick,
floor(s.all_time / 10000) blocks, s.updated_at
from games.miner_saves s
-- only finite totals: NaN and Infinity cannot be written to JSON (in PostgreSQL NaN sorts above Infinity)
where s.all_time >= 10000 and s.all_time < 'Infinity'::double precision and games.discord_identity(s.user_id) is not null
order by s.all_time desc, s.updated_at limit 10) t
$$;

-- YEET THE PEP (from update_yeet_guests.sql, plus 'id'; guests have none)
create or replace function games.yeet_top() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('nick', t.nick, 'score', t.best, 'verified', t.ver, 'id', games.lead_id(t.user_id)))
                order by t.best desc, t.at), '[]'::jsonb)
from (select * from (
select user_id, nick, best, achieved_at at, true ver from games.yeet_records where best > 0
union all
select null::uuid, shown, best, achieved_at, false from games.yeet_guests) a
order by best desc, at limit 10) t
$$;
revoke all on function games.yeet_top() from public, anon, authenticated;

-- Pepe Guesser today / this week (from update_wheres_pepe_hall_of_fame.sql, plus 'id' for verified players)
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
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('nick', nick, 'points', pts, 'played', n, 'verified', ver, 'hidden', host,
                            'id', case when ver then games.lead_id(user_id) end)) order by pts desc, best_time), '[]'::jsonb)
from (select * from one where k = 1 order by pts desc, best_time limit 10) t
$$;
-- the public functions keep the grants they already have (create or replace does not change them)
