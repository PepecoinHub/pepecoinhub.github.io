-- PepeGochi trips (A12, owner spec 2026-11-21). DRAFT: not installed anywhere.
--
-- Run after update_pepegochi_v2.sql (needs games.pepegochi_lives, games.pepegochi_view, games.pepegochi_clock,
-- games.discord_identity). Safe to run again.
--
-- What it does
--   * The owner sends a healthy froglet or adult on a trip: short (4 h), long (12 h) or a grand expedition (48 h,
--     once in 7 days), with one thing in the backpack (snack, map, lantern) that makes some places likelier.
--   * The SERVER rolls the place and the souvenir when the trip starts and keeps them hidden until the return time.
--     The browser only counts down. Nothing comes from the browser except the length and the pack.
--   * When the frog is back, the owner opens the postcard (claim): the souvenir goes to games.pepegochi_souvenirs.
--   * The catalog numbers are the same as docs/meme/pepegochi-trips.mjs (tests/pepegochi-trips.test.mjs checks it).
--
-- OPEN (owner decision before install): needs keep falling during a trip in this draft. The spec says they should
-- not fall while the frog is away; that needs a change in games.pepegochi_eval (pause between started_at and
-- return_at), which touches the live care engine, so it is not done here. Until then a trip requires every need
-- at 75 or more, and the grand expedition stays switched off (rules key trips_grand_enabled = false).
begin;

do $$
begin
  if to_regclass('games.pepegochi_lives') is null then
    raise exception 'Run update_pepegochi_v2.sql before update_pepegochi_trips.sql';
  end if;
end $$;

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
  ('moon', 0, 1, 4, null, false),
  ('unknown', 0, 0, 1, null, true)
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

alter table games.pepegochi_trip_places enable row level security;
alter table games.pepegochi_souvenir_catalog enable row level security;
alter table games.pepegochi_trips enable row level security;
alter table games.pepegochi_souvenirs enable row level security;
revoke all on games.pepegochi_trip_places, games.pepegochi_souvenir_catalog, games.pepegochi_trips,
  games.pepegochi_souvenirs from public, anon, authenticated;

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
revoke all on function games.pepegochi_trip_roll(text, text) from public, anon, authenticated;

-- What the browser may see: the place and souvenir only once the frog is back.
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
revoke all on function games.pepegochi_trip_view(uuid, timestamptz) from public, anon, authenticated;

-- ---------- browser RPCs (Discord only, no user id) ----------
create or replace function public.gry_pepegochi_trip_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); t timestamptz := games.pepegochi_clock();
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  return jsonb_build_object('server_now', t, 'trip', games.pepegochi_trip_view(u, t),
    'souvenirs', coalesce((select jsonb_agg(jsonb_build_object('id', s.souvenir_id, 'first_at', s.first_at, 'times', s.times)
      order by s.first_at) from games.pepegochi_souvenirs s where s.user_id = u), '[]'::jsonb),
    'grand_ready_at', (select max(tr.started_at) + interval '7 days' from games.pepegochi_trips tr
      where tr.user_id = u and tr.length = 'grand'));
end
$$;
revoke all on function public.gry_pepegochi_trip_state() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_trip_state() to authenticated;

create or replace function public.gry_pepegochi_trip_start(p_length text, p_pack text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  t timestamptz := games.pepegochi_clock();
  v jsonb; pet jsonb; roll record; hours integer;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  if p_length not in ('short', 'long', 'grand') or (p_pack is not null and p_pack not in ('snack', 'map', 'lantern')) then
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
  return jsonb_build_object('server_now', t, 'trip', games.pepegochi_trip_view(u, t));
end
$$;
revoke all on function public.gry_pepegochi_trip_start(text, text) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_trip_start(text, text) to authenticated;

-- Opens the postcard of a returned trip and keeps the souvenir. Idempotent: nothing to claim returns the state.
create or replace function public.gry_pepegochi_trip_claim()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); t timestamptz := games.pepegochi_clock(); tr games.pepegochi_trips%rowtype;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  select * into tr from games.pepegochi_trips x where x.user_id = u and x.claimed_at is null and x.return_at <= t
    order by x.started_at desc limit 1 for update;
  if found then
    update games.pepegochi_trips set claimed_at = t where trip_id = tr.trip_id;
    if tr.souvenir_id is not null then
      insert into games.pepegochi_souvenirs (user_id, souvenir_id, first_at) values (u, tr.souvenir_id, t)
      on conflict (user_id, souvenir_id) do update set times = games.pepegochi_souvenirs.times + 1;
    end if;
    return jsonb_build_object('server_now', t, 'claimed', jsonb_build_object('place', tr.place_id,
      'souvenir', tr.souvenir_id, 'length', tr.length), 'trip', games.pepegochi_trip_view(u, t));
  end if;
  return jsonb_build_object('server_now', t, 'claimed', null, 'trip', games.pepegochi_trip_view(u, t));
end
$$;
revoke all on function public.gry_pepegochi_trip_claim() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_trip_claim() to authenticated;

commit;
