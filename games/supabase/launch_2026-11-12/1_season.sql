-- Fren Passport season start. Run FIRST, before update_fren_passport.sql and the other Passport files.
-- Safe to run twice. Writes no data.
--
-- Season start (owner decision 2026-11-11): the public beta runs from Thursday 12 XI to Sunday 15 XI.
-- In the beta the server gives only Pond Pioneer. Everything else (stamps, secrets, counters) starts
-- on Monday 16 XI 00:00 Warsaw time = 2026-11-15 23:00 UTC, from zero: nothing done before that counts.
create or replace function games.passport_start()
returns timestamptz language sql stable set search_path = '' as $$
select '2026-11-15 23:00:00+00'::timestamptz
$$;
-- the first UTC puzzle/visit day that counts (Pepe Guesser and PondOS days are UTC dates)
create or replace function games.passport_start_day()
returns date language sql stable set search_path = '' as $$
select ((games.passport_start() at time zone 'utc')::date + 1)
$$;
create or replace function games.passport_open()
returns boolean language sql volatile set search_path = '' as $$
select clock_timestamp() >= games.passport_start()
$$;
revoke all on function games.passport_start(), games.passport_start_day(), games.passport_open()
  from public, anon, authenticated;
