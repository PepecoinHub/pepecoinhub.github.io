-- Where's Pepe? top 10 for everyone: guests too, not only Discord players. Run after update_wheres_pepe_guests.sql. Safe to run again.
-- Each row says whether the player is verified (Discord), so the game shows guests in grey.
-- Guest accounts are free to make, so guests count once per network (their best one).
create or replace function public.gry_wp_top(p_scope text default 'day') returns jsonb
language sql stable security definer set search_path = '' as $$
with d as (select (now() at time zone 'utc')::date as today),
rows as (
select x.user_id, max(x.nick) nick, bool_or(x.verified) ver, max(x.ip_hash) ip, sum(x.points) pts, count(*) n, min(x.guessed_at - x.started_at) best_time
from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id, d
where x.guessed_at is not null
and (case when p_scope = 'week' then q.day > d.today - 7 else q.day = d.today end)
group by x.user_id),
one as (
select *, row_number() over (partition by case when ver then user_id::text else coalesce(ip, user_id::text) end order by pts desc, best_time) k
from rows)
select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'points', pts, 'played', n, 'verified', ver) order by pts desc, best_time), '[]'::jsonb)
from (select * from one where k = 1 order by pts desc, best_time limit 10) t
$$;
