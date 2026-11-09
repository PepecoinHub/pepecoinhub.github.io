-- Pepe Guesser: full 5000 points only within 1 km of the right spot (was 10 km), from the puzzle of 2026-11-10 (UTC) on.
-- Earlier puzzles keep 10 km. Beyond the radius the points fall off as before: cap * exp(-(km - radius) / 1500).
-- Run once in the Supabase SQL editor (after update_wheres_pepe.sql). Safe to run again.
-- Only replaces games.wp_finish; grants stay as they are. Plays already scored keep their points.
create or replace function games.wp_finish(p games.wp_puzzles, pl games.wp_plays, a_lat double precision, a_lon double precision)
returns games.wp_plays language plpgsql security definer set search_path = '' as $$
declare el double precision := extract(epoch from now() - pl.started_at); cap int; k double precision; pts int := 0; r games.wp_plays;
  rk double precision := case when p.day >= date '2026-11-10' then 1 else 10 end;   -- full-points radius in km: 1 km from puzzle day 2026-11-10 (UTC), 10 km before
begin
  cap := case when el <= 62 then 5000 when el <= 92 then 4000 when el <= 130 then 3000 else 0 end;   -- a little grace for slow networks
  if a_lat is not null and a_lon is not null and cap > 0 then
    k := games.wp_km(a_lat, a_lon, p.lat, p.lon);
    pts := greatest(0, round(cap * case when k <= rk then 1 else exp(-(k - rk) / 1500.0) end)::int - greatest(0, pl.leaves - 1) * 1000);
  elsif a_lat is not null and a_lon is not null then
    k := games.wp_km(a_lat, a_lon, p.lat, p.lon);
  end if;
  update games.wp_plays set guessed_at = now(), g_lat = a_lat, g_lon = a_lon, km = k, points = pts
   where puzzle_id = pl.puzzle_id and user_id = pl.user_id returning * into r;
  return r;
end $$;
