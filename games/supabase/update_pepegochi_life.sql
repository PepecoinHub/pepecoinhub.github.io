-- PepeGochi A12 "a life of its own" on the server (owner spec 2026-11-21, owner request 2026-11-22).
--
-- Run after update_pepegochi_v2.sql (games.pepegochi_lives, games.pepegochi_view, games.pepegochi_clock,
-- games.discord_identity). Safe to run again. Stamps go through games.passport_award() (update_passport_awards.sql):
-- while it does not know the six new stamps yet (the hidden beta), nothing is awarded and nothing is lost; running
-- this file again after the launch gives every stamp earned so far, with the date it was earned.
--
-- What it does
--   1. Trips. The owner sends a healthy froglet or adult on a trip: short (4 h) or long (12 h), with one thing in the
--      backpack (snack, map, lantern) that makes some places likelier. The SERVER rolls the place and the souvenir
--      when the trip starts and keeps them hidden until the return time. The browser only counts down. When the frog
--      is back the owner opens the postcard (claim): the souvenir goes to games.pepegochi_souvenirs, the place to
--      the postcard album. The catalog numbers are the same as docs/meme/pepegochi-trips.mjs (a test checks it).
--      The grand expedition (48 h, once a week) stays switched off (rules key trips_grand_enabled): the needs keep
--      falling while the frog is away and 48 h is the neglect limit, so it needs an owner decision on the care rules
--      first. Until then a trip needs every need at 75 or more.
--   2. The golden lemon. Watering the lemon tree in the room on 14 UTC days in a row grows ONE golden lemon, for good
--      (it belongs to the account, every later frog sees it too). Stamp Golden Harvest.
--   3. The night signal. Between 3:00 and 3:59 local time the room's TV shows static and the numbers 0098 (the
--      browser says its time zone offset; like the Midnight Fren secret this trusts the player's clock).
--      Passport secret Night Signal.
--   4. The diary on the server, so the phone and the computer show the same pages. The browser writes the pages
--      (cosmetic, only its owner reads them); the server keeps them per account and frog life and merges two
--      devices. Opening the diary on 7 different UTC days: stamp Dear Diary. Opening it at 3 AM: stamp Snoop.
--   5. Stamps: Tourist (first postcard), Globetrotter (postcards from all 9 places), Moon Frog (the frog went to the
--      Moon), Golden Harvest, Dear Diary, Snoop.
--
-- Server calls a player makes: 1 x gry_pepegochi_life() when the room or PondOS opens, 1 per trip start/claim,
-- at most 1 watering and 1 diary opening a day that change anything, 1 diary save after new pages.
begin;

do $$
begin
  if to_regclass('games.pepegochi_lives') is null then
    raise exception 'Run update_pepegochi_v2.sql before update_pepegochi_life.sql';
  end if;
end $$;

-- ====================================================================================================
-- 1. trips
-- ====================================================================================================
create table if not exists games.pepegochi_trip_places (
  place_id text primary key,
  w_short integer not null check (w_short >= 0),
  w_long integer not null check (w_long >= 0),
  w_grand integer not null check (w_grand >= 0),
  pack text check (pack in ('snack', 'map', 'lantern')),
  secret boolean not null default false
);
insert into games.pepegochi_trip_places (place_id, w_short, w_long, w_grand, pack, secret) values
  ('big_pond', 30, 20, 10, 'snack', false),
  ('forgotten_coins_swamp', 25, 20, 12, 'lantern', false),
  ('scrypt_mine', 25, 20, 14, 'lantern', false),
  ('lily_hills', 30, 20, 10, 'snack', false),
  ('duck_city', 10, 14, 14, null, false),
  ('exchange', 10, 14, 12, 'map', false),
  ('old_internet', 10, 14, 12, 'map', false),
  ('krakow_dragon', 0, 4, 8, 'map', false),
  ('moon', 0, 3, 4, null, false),
  ('unknown', 0, 1, 1, null, true)
on conflict (place_id) do update set w_short = excluded.w_short, w_long = excluded.w_long,
  w_grand = excluded.w_grand, pack = excluded.pack, secret = excluded.secret;

create table if not exists games.pepegochi_souvenir_catalog (
  souvenir_id text primary key,
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  from_places text[]            -- null: any place
);
insert into games.pepegochi_souvenir_catalog (souvenir_id, rarity, from_places) values
  ('souv_pebble', 'common', null),
  ('souv_shell', 'common', null),
  ('souv_photo', 'rare', null),
  ('souv_hard_hat', 'rare', array['scrypt_mine']),
  ('souv_old_cd', 'rare', array['old_internet']),
  ('souv_duck_feather', 'epic', array['duck_city']),
  ('souv_mini_miner', 'epic', array['scrypt_mine', 'exchange']),
  ('souv_dragon_scale', 'legendary', array['krakow_dragon']),
  ('souv_moon_dust', 'legendary', array['moon'])
on conflict (souvenir_id) do update set rarity = excluded.rarity, from_places = excluded.from_places;

create table if not exists games.pepegochi_trips (
  trip_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  life_id uuid not null references games.pepegochi_lives (life_id) on delete cascade,
  length text not null check (length in ('short', 'long', 'grand')),
  pack text check (pack in ('snack', 'map', 'lantern')),
  place_id text not null references games.pepegochi_trip_places (place_id),
  souvenir_id text references games.pepegochi_souvenir_catalog (souvenir_id),
  started_at timestamptz not null,
  return_at timestamptz not null,
  claimed_at timestamptz
);
-- one open trip per account at a time
create unique index if not exists pepegochi_trips_one_open on games.pepegochi_trips (user_id) where claimed_at is null;
create index if not exists pepegochi_trips_user on games.pepegochi_trips (user_id, started_at desc);

create table if not exists games.pepegochi_souvenirs (
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  souvenir_id text not null references games.pepegochi_souvenir_catalog (souvenir_id),
  first_at timestamptz not null,
  times integer not null default 1 check (times >= 1),
  primary key (user_id, souvenir_id)
);

-- ====================================================================================================
-- 2-4. watering, marks (golden lemon, night signal, snoop), diary
-- ====================================================================================================
create table if not exists games.pepegochi_watering (
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  day date not null,                                    -- UTC day
  at timestamptz not null,
  primary key (user_id, day)
);
-- one row per thing that happened once for good: golden_lemon, night_signal, snoop
create table if not exists games.pepegochi_marks (
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  mark text not null check (mark in ('golden_lemon', 'night_signal', 'snoop')),
  at timestamptz not null,
  primary key (user_id, mark)
);
create table if not exists games.pepegochi_diary (
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  life_id uuid not null references games.pepegochi_lives (life_id) on delete cascade,
  seen double precision not null default 0,             -- ms since 1970, the browser's "last seen"
  read integer not null default 0 check (read >= 0),
  pages jsonb not null default '[]'::jsonb check (jsonb_typeof(pages) = 'array'),
  updated_at timestamptz not null,
  primary key (user_id, life_id)
);
create table if not exists games.pepegochi_diary_days (
  user_id uuid not null references games.pepegochi_owners (user_id) on delete cascade,
  day date not null,                                    -- UTC day the diary was opened
  primary key (user_id, day)
);

alter table games.pepegochi_trip_places enable row level security;
alter table games.pepegochi_souvenir_catalog enable row level security;
alter table games.pepegochi_trips enable row level security;
alter table games.pepegochi_souvenirs enable row level security;
alter table games.pepegochi_watering enable row level security;
alter table games.pepegochi_marks enable row level security;
alter table games.pepegochi_diary enable row level security;
alter table games.pepegochi_diary_days enable row level security;
revoke all on games.pepegochi_trip_places, games.pepegochi_souvenir_catalog, games.pepegochi_trips,
  games.pepegochi_souvenirs, games.pepegochi_watering, games.pepegochi_marks, games.pepegochi_diary,
  games.pepegochi_diary_days from public, anon, authenticated;

-- ====================================================================================================
-- helpers
-- ====================================================================================================
-- The signed-in Discord account, or an error. Every browser RPC below starts with it.
create or replace function games.pepegochi_life_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  return u;
end
$$;

-- The local hour for a time zone offset the browser reports (minutes east of UTC, like -Date#getTimezoneOffset()).
-- Real offsets only: -12:00 to +14:00 in quarter hours. Anything else: null (nothing counts).
create or replace function games.pepegochi_local_hour(t timestamptz, p_tz_min integer)
returns integer language sql immutable set search_path = '' as $$
  select case when p_tz_min between -720 and 840 and p_tz_min % 15 = 0
    then extract(hour from (t at time zone 'UTC') + make_interval(mins => p_tz_min))::integer end
$$;

-- The stamps and the secret this file gives, each with the moment it was earned. Safe to call any time: a stamp
-- passport_award() does not know yet ("Unknown passport stamp") is skipped and comes with the next call.
create or replace function games.pepegochi_life_stamps(u uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare s record; signal timestamptz;
begin
  for s in
    select x.stamp, x.at from (
      select 'tourist' stamp, (select min(tr.claimed_at) from games.pepegochi_trips tr where tr.user_id = u) at
      union all
      select 'globetrotter', (select case when count(*) = (select count(*) from games.pepegochi_trip_places p where not p.secret)
                                      then max(firsts.at) end
                                from (select tr.place_id, min(tr.claimed_at) at from games.pepegochi_trips tr
                                       join games.pepegochi_trip_places p on p.place_id = tr.place_id and not p.secret
                                      where tr.user_id = u and tr.claimed_at is not null group by tr.place_id) firsts)
      union all
      select 'moon_frog', (select min(tr.claimed_at) from games.pepegochi_trips tr where tr.user_id = u and tr.place_id = 'moon')
      union all
      select 'golden_harvest', (select m.at from games.pepegochi_marks m where m.user_id = u and m.mark = 'golden_lemon')
      union all
      select 'snoop', (select m.at from games.pepegochi_marks m where m.user_id = u and m.mark = 'snoop')
      union all
      select 'dear_diary', (select (d.day + interval '12 hours')::timestamptz from games.pepegochi_diary_days d where d.user_id = u
                             order by d.day offset 6 limit 1)
    ) x
    where x.at is not null
      and not exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = x.stamp)
  loop
    begin
      perform games.passport_award(u, s.stamp, s.at);
    exception when raise_exception then
      if sqlerrm not like 'Unknown passport stamp %' then raise; end if;
    end;
  end loop;
  -- the Night Signal secret: only in the open season (like the Pond Map secrets), dated when it was seen, and only
  -- once passport_award() knows this file's stamps (launch day): the hidden beta keeps every secret for later too
  select m.at into signal from games.pepegochi_marks m where m.user_id = u and m.mark = 'night_signal';
  begin
    perform games.passport_award(null, 'snoop');
  exception when raise_exception then
    signal := null;
  end;
  if signal is not null and to_regprocedure('games.passport_open()') is not null and games.passport_open()
     and signal >= games.passport_start() then
    insert into games.passport_secrets (user_id, secret_id, discovered_at) values (u, 'night_signal', signal)
    on conflict do nothing;
  end if;
exception when undefined_table or undefined_function then
  return;   -- no Passport installed (local tests of the game alone)
end
$$;

-- ---------- the roll (same rules as rollTrip in pepegochi-trips.mjs) ----------
create or replace function games.pepegochi_trip_roll(p_length text, p_pack text)
returns table (place_id text, souvenir_id text) language plpgsql volatile set search_path = '' as $$
declare
  total numeric; r numeric; pick text; rarity text; chance numeric;
  order_r text[] := array['common', 'rare', 'epic', 'legendary'];
  i integer;
begin
  -- place
  select sum(w) into total from (
    select case p_length when 'short' then p.w_short when 'long' then p.w_long else p.w_grand end
           * case when p_pack is not null and p.pack = p_pack then 2 else 1 end as w
      from games.pepegochi_trip_places p) x;
  r := random() * total;
  for pick, chance in
    select p.place_id, (case p_length when 'short' then p.w_short when 'long' then p.w_long else p.w_grand end
           * case when p_pack is not null and p.pack = p_pack then 2 else 1 end)::numeric
      from games.pepegochi_trip_places p order by p.place_id
  loop
    if chance > 0 then
      r := r - chance;
      place_id := pick;
      exit when r < 0;
    end if;
  end loop;
  souvenir_id := null;
  if place_id = 'unknown' then return next; return; end if;

  -- souvenir: chance by length, then rarity 70/22/7/1 (no legendary on a short trip), downgraded when the
  -- place has nothing of that rarity
  chance := case p_length when 'short' then 0.4 when 'long' then 0.7 else 1 end;
  if random() < chance then
    r := random() * case when p_length = 'short' then 99 else 100 end;
    rarity := case when r < 70 then 'common' when r < 92 then 'rare' when r < 99 then 'epic' else 'legendary' end;
    for i in reverse array_position(order_r, rarity)..1 loop
      select c.souvenir_id into souvenir_id from games.pepegochi_souvenir_catalog c
        where c.rarity = order_r[i] and (c.from_places is null or place_id = any (c.from_places))
        order by random() limit 1;
      exit when souvenir_id is not null;
    end loop;
  end if;
  return next;
end
$$;

-- What the browser may see of the open trip: the place and souvenir only once the frog is back.
create or replace function games.pepegochi_trip_view(u uuid, t timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  select case when x.trip_id is null then null else jsonb_build_object(
    'trip_id', x.trip_id, 'length', x.length, 'pack', x.pack, 'started_at', x.started_at, 'return_at', x.return_at,
    'claimed_at', x.claimed_at,
    'place', case when t >= x.return_at then x.place_id end,
    'souvenir', case when t >= x.return_at then x.souvenir_id end) end
  from (select 1) one
  left join lateral (select * from games.pepegochi_trips tr where tr.user_id = u and tr.claimed_at is null
    order by tr.started_at desc limit 1) x on true
$$;

-- Everything A12 the browser shows, in one answer (room window and taskbar frog).
create or replace function games.pepegochi_life_view(u uuid, t timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; pet jsonb; d games.pepegochi_diary%rowtype; streak integer := 0; day0 date := (t at time zone 'UTC')::date;
begin
  v := games.pepegochi_view(u, t);
  pet := v->'pet';
  if pet is not null and pet->>'status' <> 'departed' then
    select * into d from games.pepegochi_diary x where x.user_id = u and x.life_id = (pet->>'life_id')::uuid;
  end if;
  -- the watering streak that is still alive (watered today or yesterday), for the frog's hints only
  if not exists (select 1 from games.pepegochi_watering w where w.user_id = u and w.day = day0) then day0 := day0 - 1; end if;
  while streak < 14 and exists (select 1 from games.pepegochi_watering w where w.user_id = u and w.day = day0 - streak) loop
    streak := streak + 1;
  end loop;
  day0 := (t at time zone 'UTC')::date;
  return jsonb_build_object(
    'server_now', t,
    'trip', games.pepegochi_trip_view(u, t),
    'souvenirs', coalesce((select jsonb_agg(jsonb_build_object('id', s.souvenir_id, 'first_at', s.first_at, 'times', s.times)
      order by s.first_at) from games.pepegochi_souvenirs s where s.user_id = u), '[]'::jsonb),
    'postcards', coalesce((select jsonb_agg(jsonb_build_object('place', x.place_id, 'first_at', x.first_at, 'times', x.times)
      order by x.first_at) from (select tr.place_id, min(tr.claimed_at) first_at, count(*)::integer times
        from games.pepegochi_trips tr where tr.user_id = u and tr.claimed_at is not null group by tr.place_id) x), '[]'::jsonb),
    'grand_open', coalesce((games.pepegochi_rules()->>'trips_grand_enabled')::boolean, false),
    'grand_ready_at', (select max(tr.started_at) + interval '7 days' from games.pepegochi_trips tr
      where tr.user_id = u and tr.length = 'grand'),
    'watered_today', exists (select 1 from games.pepegochi_watering w where w.user_id = u and w.day = day0),
    'shine', case when streak >= 11 then 2 when streak >= 7 then 1 else 0 end,
    'golden_at', (select m.at from games.pepegochi_marks m where m.user_id = u and m.mark = 'golden_lemon'),
    'signal_at', (select m.at from games.pepegochi_marks m where m.user_id = u and m.mark = 'night_signal'),
    'diary', case when d.user_id is null then null
      else jsonb_build_object('life_id', d.life_id, 'seen', d.seen, 'read', d.read, 'pages', d.pages) end);
end
$$;

revoke all on function games.pepegochi_life_user(), games.pepegochi_local_hour(timestamptz, integer),
  games.pepegochi_life_stamps(uuid), games.pepegochi_trip_roll(text, text), games.pepegochi_trip_view(uuid, timestamptz),
  games.pepegochi_life_view(uuid, timestamptz) from public, anon, authenticated;

-- ====================================================================================================
-- browser RPCs (Discord only, no user id from the browser)
-- ====================================================================================================
create or replace function public.gry_pepegochi_life()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  return games.pepegochi_life_view(games.pepegochi_life_user(), games.pepegochi_clock());
end
$$;

create or replace function public.gry_pepegochi_trip_start(p_length text, p_pack text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := games.pepegochi_life_user();
  t timestamptz := games.pepegochi_clock();
  v jsonb; pet jsonb; roll record; hours integer;
begin
  if p_length is null or p_length not in ('short', 'long', 'grand') or (p_pack is not null and p_pack not in ('snack', 'map', 'lantern')) then
    raise exception 'Unknown trip' using errcode = '22023';
  end if;
  if p_length = 'grand' and coalesce((games.pepegochi_rules()->>'trips_grand_enabled')::boolean, false) is not true then
    raise exception 'The grand expedition is not open yet' using errcode = '22023';
  end if;
  perform 1 from games.pepegochi_owners o where o.user_id = u for update;
  v := games.pepegochi_view(u, t);
  pet := v->'pet';
  if pet is null or pet->>'status' <> 'healthy' or pet->>'stage' not in ('froglet', 'adult') then
    raise exception 'Only a healthy froglet or adult can travel' using errcode = '22023';
  end if;
  if (pet->'needs'->>'hunger')::integer < 75 or (pet->'needs'->>'hygiene')::integer < 75
     or (pet->'needs'->>'mood')::integer < 75 or (pet->'needs'->>'energy')::integer < 75 then
    raise exception 'Your frog wants to be fed, clean and rested before a trip' using errcode = '22023';
  end if;
  if exists (select 1 from games.pepegochi_trips tr where tr.user_id = u and tr.claimed_at is null) then
    raise exception 'Your frog is already on a trip' using errcode = '22023';
  end if;
  if p_length = 'grand' and exists (select 1 from games.pepegochi_trips tr where tr.user_id = u
      and tr.length = 'grand' and tr.started_at > t - interval '7 days') then
    raise exception 'One grand expedition a week' using errcode = '22023';
  end if;
  select * into roll from games.pepegochi_trip_roll(p_length, p_pack);
  hours := case p_length when 'short' then 4 when 'long' then 12 else 48 end;
  insert into games.pepegochi_trips (user_id, life_id, length, pack, place_id, souvenir_id, started_at, return_at)
  values (u, (pet->>'life_id')::uuid, p_length, p_pack, roll.place_id, roll.souvenir_id, t, t + make_interval(hours => hours));
  return games.pepegochi_life_view(u, t);
end
$$;

-- Opens the postcard of a returned trip and keeps the souvenir. Idempotent: nothing to claim returns the state.
create or replace function public.gry_pepegochi_trip_claim()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := games.pepegochi_life_user(); t timestamptz := games.pepegochi_clock(); tr games.pepegochi_trips%rowtype;
  claimed jsonb := null;
begin
  select * into tr from games.pepegochi_trips x where x.user_id = u and x.claimed_at is null and x.return_at <= t
    order by x.started_at desc limit 1 for update;
  if found then
    update games.pepegochi_trips set claimed_at = t where trip_id = tr.trip_id;
    if tr.souvenir_id is not null then
      insert into games.pepegochi_souvenirs (user_id, souvenir_id, first_at) values (u, tr.souvenir_id, t)
      on conflict (user_id, souvenir_id) do update set times = games.pepegochi_souvenirs.times + 1;
    end if;
    claimed := jsonb_build_object('place', tr.place_id, 'souvenir', tr.souvenir_id, 'length', tr.length,
      'new_place', not exists (select 1 from games.pepegochi_trips x where x.user_id = u and x.place_id = tr.place_id
                                 and x.claimed_at is not null and x.trip_id <> tr.trip_id));
    perform games.pepegochi_life_stamps(u);
  end if;
  return games.pepegochi_life_view(u, t) || jsonb_build_object('claimed', claimed);
end
$$;

-- Waters the lemon tree. Counts once per UTC day; 14 days in a row grow the golden lemon (once, for good).
create or replace function public.gry_pepegochi_water()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := games.pepegochi_life_user(); t timestamptz := games.pepegochi_clock(); day0 date := (t at time zone 'UTC')::date;
  run integer := 0; golden boolean := false;
begin
  -- the lemon tree belongs to the room (the account), not to one frog: any owner may water it
  if not exists (select 1 from games.pepegochi_owners o where o.user_id = u) then
    return games.pepegochi_life_view(u, t) || jsonb_build_object('golden_new', false);
  end if;
  perform 1 from games.pepegochi_owners o where o.user_id = u for update;
  insert into games.pepegochi_watering (user_id, day, at) values (u, day0, t) on conflict do nothing;
  -- days in a row up to today
  loop
    exit when not exists (select 1 from games.pepegochi_watering w where w.user_id = u and w.day = day0 - run);
    run := run + 1;
    exit when run >= 14;
  end loop;
  if run >= 14 then
    insert into games.pepegochi_marks (user_id, mark, at) values (u, 'golden_lemon', t) on conflict do nothing;
    golden := found;
    if golden then perform games.pepegochi_life_stamps(u); end if;
  end if;
  return games.pepegochi_life_view(u, t) || jsonb_build_object('golden_new', golden);
end
$$;

-- The TV in the room at night. At 3:00-3:59 local time (by the offset the browser reports) the signal comes through.
create or replace function public.gry_pepegochi_tv_signal(p_tz_min integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := games.pepegochi_life_user(); t timestamptz := games.pepegochi_clock(); first boolean := false;
begin
  if games.pepegochi_local_hour(t, p_tz_min) is distinct from 3 then
    return jsonb_build_object('signal', null, 'new', false);
  end if;
  if not exists (select 1 from games.pepegochi_owners o where o.user_id = u) then
    return jsonb_build_object('signal', null, 'new', false);
  end if;
  insert into games.pepegochi_marks (user_id, mark, at) values (u, 'night_signal', t) on conflict do nothing;
  first := found;
  if first then perform games.pepegochi_life_stamps(u); end if;
  return jsonb_build_object('signal', '0098', 'new', first);
end
$$;

-- The owner opens the diary: counts the UTC day (Dear Diary at 7) and notices 3 AM (Snoop).
create or replace function public.gry_pepegochi_diary_open(p_tz_min integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := games.pepegochi_life_user(); t timestamptz := games.pepegochi_clock(); snoop boolean := false; newday boolean;
begin
  if not exists (select 1 from games.pepegochi_owners o where o.user_id = u) then
    return jsonb_build_object('snoop', false, 'days', 0);
  end if;
  insert into games.pepegochi_diary_days (user_id, day) values (u, (t at time zone 'UTC')::date) on conflict do nothing;
  newday := found;
  if games.pepegochi_local_hour(t, p_tz_min) = 3 then
    insert into games.pepegochi_marks (user_id, mark, at) values (u, 'snoop', t) on conflict do nothing;
    snoop := found;
  end if;
  if newday or snoop then perform games.pepegochi_life_stamps(u); end if;
  return jsonb_build_object('snoop', games.pepegochi_local_hour(t, p_tz_min) = 3,
    'days', (select count(*) from games.pepegochi_diary_days d where d.user_id = u));
end
$$;

-- Saves the diary of the current frog. The server merges with what another device saved: pages are kept by
-- (id, at), the newest 365; "last seen" and "read" take the larger value. Returns the merged diary.
create or replace function public.gry_pepegochi_diary_save(p_book jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := games.pepegochi_life_user(); t timestamptz := games.pepegochi_clock(); pet jsonb; life uuid;
  incoming jsonb; merged jsonb; p jsonb; seen double precision; rd integer;
begin
  pet := games.pepegochi_view(u, t)->'pet';
  if pet is null or pet->>'status' = 'departed' then raise exception 'No frog to write a diary' using errcode = '22023'; end if;
  life := (pet->>'life_id')::uuid;
  if p_book is null or jsonb_typeof(p_book) <> 'object' or jsonb_typeof(p_book->'pages') <> 'array'
     or jsonb_array_length(p_book->'pages') > 365 or length(p_book::text) > 200000 then
    raise exception 'Bad diary' using errcode = '22023';
  end if;
  for p in select * from jsonb_array_elements(p_book->'pages') loop
    if jsonb_typeof(p) <> 'object' or jsonb_typeof(p->'id') <> 'string' or (p->>'id') !~ '^[a-z0-9_]{2,40}$'
       or jsonb_typeof(p->'day') <> 'number' or jsonb_typeof(p->'at') <> 'number' or jsonb_typeof(p->'text') <> 'string'
       or length(p->>'text') > 280 or (p->>'day')::numeric not between 1 and 100000 then
      raise exception 'Bad diary page' using errcode = '22023';
    end if;
  end loop;
  seen := case when jsonb_typeof(p_book->'seen') = 'number' then (p_book->>'seen')::double precision else 0 end;
  rd := case when jsonb_typeof(p_book->'read') = 'number' then greatest(0, least(100000, (p_book->>'read')::numeric::integer)) else 0 end;
  perform 1 from games.pepegochi_owners o where o.user_id = u for update;
  incoming := (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'day', (x->>'day')::numeric::integer,
    'at', (x->>'at')::double precision, 'text', x->>'text')), '[]'::jsonb) from jsonb_array_elements(p_book->'pages') x);
  select coalesce(jsonb_agg(q.pg order by q.at), '[]'::jsonb) into merged from (
    select dd.pg, dd.at from (
      select distinct on (z.pg->>'id', z.at) z.pg, z.at from (
        select e pg, (e->>'at')::double precision at from games.pepegochi_diary d, jsonb_array_elements(d.pages) e
         where d.user_id = u and d.life_id = life
        union all
        select e, (e->>'at')::double precision from jsonb_array_elements(incoming) e
      ) z order by z.pg->>'id', z.at
    ) dd order by dd.at desc limit 365
  ) q;
  insert into games.pepegochi_diary (user_id, life_id, seen, read, pages, updated_at)
  values (u, life, seen, rd, merged, t)
  on conflict (user_id, life_id) do update set seen = greatest(games.pepegochi_diary.seen, excluded.seen),
    read = greatest(games.pepegochi_diary.read, excluded.read), pages = excluded.pages, updated_at = t;
  return (select jsonb_build_object('life_id', d.life_id, 'seen', d.seen, 'read', d.read, 'pages', d.pages)
    from games.pepegochi_diary d where d.user_id = u and d.life_id = life);
end
$$;

revoke all on function public.gry_pepegochi_life(), public.gry_pepegochi_trip_start(text, text),
  public.gry_pepegochi_trip_claim(), public.gry_pepegochi_water(), public.gry_pepegochi_tv_signal(integer),
  public.gry_pepegochi_diary_open(integer), public.gry_pepegochi_diary_save(jsonb) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_life(), public.gry_pepegochi_trip_start(text, text),
  public.gry_pepegochi_trip_claim(), public.gry_pepegochi_water(), public.gry_pepegochi_tv_signal(integer),
  public.gry_pepegochi_diary_open(integer), public.gry_pepegochi_diary_save(jsonb) to authenticated;

-- Stamps earned before passport_award() knew them (the hidden beta) arrive now, with their dates.
do $$
declare r record;
begin
  for r in select distinct user_id from (
    select user_id from games.pepegochi_trips where claimed_at is not null
    union select user_id from games.pepegochi_marks union select user_id from games.pepegochi_diary_days) x
  loop
    perform games.pepegochi_life_stamps(r.user_id);
  end loop;
end $$;

commit;
