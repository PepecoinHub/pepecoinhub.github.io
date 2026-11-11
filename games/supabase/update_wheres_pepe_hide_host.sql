-- Pepe Guesser: the host's own score is hidden from other players.
-- The host approves the photos, so the host knows where Pepe is. The host may still play,
-- but the host's plays no longer show in the Today / 7 days top 10 (game window, LEADERS,
-- "leads with" line on the desktop) and do not count in "N players today".
-- The host still sees their own row in the top 10, marked "hidden" (only the host gets it).
-- "Host" = games.is_host_user(): the Discord host account or a live host code session.
-- Run once in the Supabase SQL editor (after update_wheres_pepe_top_all.sql and update_wheres_pepe_count.sql).
-- Safe to run again. Only replaces gry_wp_top and gry_wp_count; grants stay as they are.

create or replace function public.gry_wp_top(p_scope text default 'day') returns jsonb
language sql stable security definer set search_path = '' as $$
with d as (select (now() at time zone 'utc')::date as today),
rows as (
select x.user_id, max(x.nick) nick, bool_or(x.verified) ver, max(x.ip_hash) ip, sum(x.points) pts, count(*) n, min(x.guessed_at - x.started_at) best_time
from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id, d
where x.guessed_at is not null
and (case when p_scope = 'week' then q.day > d.today - 7 else q.day = d.today end)
group by x.user_id),
seen as (
-- the host's plays are left out, except for the host looking at their own row
select r.*, games.is_host_user(r.user_id) host from rows r),
one as (
select *, row_number() over (partition by case when ver then user_id::text else coalesce(ip, user_id::text) end order by pts desc, best_time) k
from seen
where not host or user_id = auth.uid())
select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'points', pts, 'played', n, 'verified', ver, 'hidden', host) order by pts desc, best_time), '[]'::jsonb)
from (select * from one where k = 1 order by pts desc, best_time limit 10) t
$$;

create or replace function public.gry_wp_count() returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('players', count(*), 'discord', count(*) filter (where x.verified))
from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
where q.day = (now() at time zone 'utc')::date and x.guessed_at is not null
and not games.is_host_user(x.user_id)
$$;
