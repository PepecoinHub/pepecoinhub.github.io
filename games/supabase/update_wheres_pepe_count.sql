-- Where's Pepe? how many players today (shown under the ranking). Run after update_wheres_pepe_guests.sql. Safe to run again.
create or replace function public.gry_wp_count() returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('players', count(*), 'discord', count(*) filter (where x.verified))
from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
where q.day = (now() at time zone 'utc')::date and x.guessed_at is not null
$$;
revoke all on function public.gry_wp_count() from public;
grant execute on function public.gry_wp_count() to anon, authenticated;
