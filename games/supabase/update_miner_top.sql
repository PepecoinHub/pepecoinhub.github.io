-- Pepe Miner top 10 for the LEADERS window in PondOS. Run after update_miner_cloud.sql. Safe to run again.
-- Only Discord players have a cloud save, so only they are listed (by blocks mined: all-time game PEP / 10,000).
-- Game PEP are points, not coins; the save is trusted as the game sends it. No prizes depend on this list.
-- Blocks stay a double precision number, not a bigint: Pepe Miner is an idle game, and an all-time total
-- above about 9.2e22 gives more blocks than a bigint can hold (9.2e18). One such save used to break the whole
-- list with "bigint out of range". JSON carries numbers like 1e30 fine.
create or replace function public.gry_miner_top() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_build_object('nick', t.nick, 'score', t.blocks, 'verified', true) order by t.blocks desc, t.updated_at), '[]'::jsonb)
from (select left(coalesce(games.discord_identity(s.user_id)->>'name', 'Discord miner'), 32) nick,
floor(s.all_time / 10000) blocks, s.updated_at
from games.miner_saves s
-- only finite totals: NaN and Infinity cannot be written to JSON (in PostgreSQL NaN sorts above Infinity)
where s.all_time >= 10000 and s.all_time < 'Infinity'::double precision and games.discord_identity(s.user_id) is not null
order by s.all_time desc, s.updated_at limit 10) t
$$;
revoke all on function public.gry_miner_top() from public;
grant execute on function public.gry_miner_top() to anon, authenticated;
