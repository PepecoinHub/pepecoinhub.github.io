-- Where's Pepe? A daily guess-the-place game in PondOS (the meme edition).
-- Run once in the Supabase SQL editor after schema.sql and update_arcade.sql. Safe to run again.
--
-- How it works
--   * A robot (scripts/wheres_pepe.py, GitHub Actions) prepares puzzles a week ahead: a free-licence photo
--     from Wikimedia Commons with a Pepe traveller added. It may only call gry_wp_robot_*, with a token
--     whose hash is stored here. Create the token once with:  select games.wp_new_robot_token();
--     and paste the result into GitHub: Settings > Secrets and variables > Actions > WP_ROBOT_TOKEN.
--   * Nothing is public before a puzzle goes live. The host (Discord host account) sees the queue,
--     with the answers, and approves or rejects each puzzle. Approved puzzles go live one per UTC day.
--   * The picture is handed out only when a signed-in player presses Start; the server notes the time.
--     2 minutes per guess: up to 5000 points in the first minute, 4000 after the continent hint (1:00),
--     3000 after the flag hint (1:30). Full marks within 1 km. Each tab switch after the first: -1000.
--   * Day and week rankings list Discord-verified players only (guest accounts are free to make).
--   * PEP rewards: the site holds no coins. A verified player may leave a PEP address after a guess;
--     the host pays the open claims from the host's own wallet (one sendmany) and records the txid.

-- ---------- tables ----------
create table if not exists games.wp_puzzles (
  id          bigint generated always as identity primary key,
  qid         text not null unique,                 -- Wikidata item, so a place is never used twice
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  day         date unique,                          -- the UTC day it is live (set when the day comes)
  num         int unique,                           -- Where's Pepe #num
  title       text not null,
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  country     text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  continent   text not null,
  wiki_url    text,
  credit      text not null,
  license     text not null,
  source_url  text not null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists wp_puzzles_queue on games.wp_puzzles (status, day, decided_at, id);

create table if not exists games.wp_images (
  puzzle_id bigint primary key references games.wp_puzzles(id) on delete cascade,
  data      text not null                           -- data:image/webp;base64,…  (handed out only after Start)
);

create table if not exists games.wp_plays (
  puzzle_id  bigint not null references games.wp_puzzles(id) on delete cascade,
  user_id    uuid not null,
  nick       text not null,
  verified   boolean not null default false,
  started_at timestamptz not null default now(),
  leaves     int not null default 0,
  guessed_at timestamptz,
  g_lat      double precision,
  g_lon      double precision,
  km         double precision,
  points     int,
  primary key (puzzle_id, user_id)
);
create index if not exists wp_plays_user on games.wp_plays (user_id, started_at);

create table if not exists games.wp_claims (
  id         bigint generated always as identity primary key,
  puzzle_id  bigint not null references games.wp_puzzles(id) on delete cascade,
  user_id    uuid not null,
  nick       text not null,
  address    text not null check (address ~ '^P[1-9A-HJ-NP-Za-km-z]{33}$'),
  pep        numeric(14, 2) not null check (pep > 0),
  status     text not null default 'open' check (status in ('open', 'held', 'paid')),
  txid       text check (txid is null or txid ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  paid_at    timestamptz,
  unique (puzzle_id, user_id)
);
create index if not exists wp_claims_open on games.wp_claims (status, created_at);
create index if not exists wp_claims_addr on games.wp_claims (address, created_at);

alter table games.wp_puzzles enable row level security;
alter table games.wp_images  enable row level security;
alter table games.wp_plays   enable row level security;
alter table games.wp_claims  enable row level security;
revoke all on games.wp_puzzles, games.wp_images, games.wp_plays, games.wp_claims from public, anon, authenticated;

alter table games.config add column if not exists wp_robot_hash text;
alter table games.config add column if not exists wp_pep_per_50 numeric(10, 2) not null default 1;
alter table games.config add column if not exists wp_max_day int not null default 100;
alter table games.config add column if not exists wp_max_week int not null default 500;
alter table games.config add column if not exists wp_rewards_open boolean not null default true;

-- ---------- helpers ----------
create or replace function games.wp_new_robot_token() returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  update games.config set wp_robot_hash = encode(sha256(convert_to(t, 'UTF8')), 'hex') where id = 1;
  return t;   -- shown once: paste it into the GitHub secret WP_ROBOT_TOKEN
end $$;
revoke all on function games.wp_new_robot_token() from public, anon, authenticated;

create or replace function games.wp_robot_ok(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_token) between 40 and 200
         and (select wp_robot_hash from games.config where id = 1) = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), false)
$$;

create or replace function games.wp_utc_day() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date
$$;

-- today's puzzle: the one already set for today, or the oldest approved one, which gets today's date now
create or replace function games.wp_today() returns games.wp_puzzles
language plpgsql security definer set search_path = '' as $$
declare p games.wp_puzzles; d date := games.wp_utc_day();
begin
  select * into p from games.wp_puzzles where day = d;
  if found then return p; end if;
  perform 1 from games.config where id = 1 for update;      -- one caller picks the puzzle of the day
  select * into p from games.wp_puzzles where day = d;
  if found then return p; end if;
  update games.wp_puzzles set day = d, num = coalesce((select max(num) from games.wp_puzzles), 0) + 1
   where id = (select id from games.wp_puzzles where status = 'approved' and day is null order by decided_at, id limit 1)
  returning * into p;
  -- pictures of puzzles older than 7 days are deleted (the answers and scores stay)
  delete from games.wp_images i using games.wp_puzzles q where q.id = i.puzzle_id and q.day < d - 7;
  return p;
end $$;

create or replace function games.wp_km(a_lat double precision, a_lon double precision, b_lat double precision, b_lon double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 2 * 6371.0 * asin(least(1, sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
         + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lon - a_lon) / 2), 2))))
$$;

create or replace function games.wp_reveal(p games.wp_puzzles) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('lat', p.lat, 'lon', p.lon, 'title', p.title, 'country', p.country, 'country_code', p.country_code,
         'continent', p.continent, 'wiki_url', p.wiki_url, 'credit', p.credit, 'license', p.license, 'source_url', p.source_url)
$$;

-- what a play looks like to its player (hints appear by time; the answer only after the guess or the end)
create or replace function games.wp_view(p games.wp_puzzles, pl games.wp_plays, with_image boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare el double precision := extract(epoch from now() - pl.started_at); done boolean := pl.guessed_at is not null; r jsonb;
begin
  r := jsonb_build_object('num', p.num, 'day', p.day, 'started_at', pl.started_at, 'now', now(), 'elapsed', el,
         'leaves', pl.leaves, 'done', done);
  if el >= 60 or done then r := r || jsonb_build_object('continent', p.continent); end if;
  if el >= 90 or done then r := r || jsonb_build_object('country', p.country, 'country_code', p.country_code); end if;
  if done then
    r := r || jsonb_build_object('points', pl.points, 'km', pl.km, 'g_lat', pl.g_lat, 'g_lon', pl.g_lon, 'answer', games.wp_reveal(p),
               'claim', (select jsonb_build_object('pep', c.pep, 'status', c.status, 'txid', c.txid, 'address', c.address)
                           from games.wp_claims c where c.puzzle_id = p.id and c.user_id = pl.user_id));
  end if;
  if with_image then
    r := r || jsonb_build_object('image', (select data from games.wp_images where puzzle_id = p.id));
  end if;
  return r;
end $$;

-- ends a play: score from the guess (or 0 without one)
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

-- ---------- players ----------
-- today's state: is there a puzzle, did I play it, my streak, time to the next one (no picture, no answer)
create or replace function public.gry_wp_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p games.wp_puzzles := games.wp_today(); u uuid := auth.uid(); pl games.wp_plays; s int := 0; d date;
begin
  if u is not null and p.id is not null then
    select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
    if pl.user_id is not null and pl.guessed_at is null and pl.started_at < now() - interval '130 seconds' then
      pl := games.wp_finish(p, pl, null, null);
    end if;
  end if;
  if u is not null then   -- streak: days in a row with a finished play, up to today or yesterday
    d := games.wp_utc_day();
    if not exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id where x.user_id = u and q.day = d and x.guessed_at is not null) then d := d - 1; end if;
    while exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id where x.user_id = u and q.day = d and x.guessed_at is not null) loop
      s := s + 1; d := d - 1;
    end loop;
  end if;
  return jsonb_build_object(
    'live', p.id is not null, 'num', p.num, 'day', coalesce(p.day, games.wp_utc_day()),
    'next_at', (games.wp_utc_day() + 1)::timestamp at time zone 'utc', 'now', now(), 'streak', s,
    'signed_in', u is not null, 'verified', u is not null and games.discord_identity(u) is not null,
    'is_host', u is not null and games.is_host_user(u),
    'rewards', (select jsonb_build_object('open', wp_rewards_open, 'per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week) from games.config where id = 1),
    'played', pl.user_id is not null, 'mine', case when pl.user_id is not null then games.wp_view(p, pl, pl.guessed_at is not null) end);
end $$;

-- Start (or come back to) today's puzzle: the clock starts here, and the picture comes with it
create or replace function public.gry_wp_start(p_nick text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles; pl games.wp_plays; d jsonb; v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
begin
  if u is null then raise exception 'Log on first (Discord or guest) to play'; end if;
  p := games.wp_today();
  if p.id is null then raise exception 'Pepe is still packing. No puzzle today yet, come back later'; end if;
  select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
  if pl.user_id is null then
    d := games.discord_identity(u);
    if d is not null then
      v_nick := coalesce((select nick from games.profiles where user_id = u), left(d->>'name', 32));
    else
      if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]+$' then v_nick := 'guest'; end if;
      if games.is_profane(v_nick) then v_nick := 'guest'; end if;
    end if;
    insert into games.wp_plays (puzzle_id, user_id, nick, verified) values (p.id, u, v_nick, d is not null)
    on conflict do nothing;
    select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
  end if;
  if pl.guessed_at is null and pl.started_at < now() - interval '130 seconds' then pl := games.wp_finish(p, pl, null, null); end if;
  return games.wp_view(p, pl, true);
end $$;

-- the page reports leaving the tab during a play (the first time is a warning, then -1000 each)
create or replace function public.gry_wp_leave() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles := games.wp_today(); n int;
begin
  update games.wp_plays set leaves = leaves + 1
   where puzzle_id = p.id and user_id = u and guessed_at is null and started_at > now() - interval '130 seconds'
  returning leaves into n;
  return jsonb_build_object('leaves', coalesce(n, 0));
end $$;

-- the hints, once their time has come
create or replace function public.gry_wp_hint() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles := games.wp_today(); pl games.wp_plays;
begin
  select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
  if pl.user_id is null then raise exception 'Press Start first'; end if;
  return games.wp_view(p, pl, false) - 'image';
end $$;

create or replace function public.gry_wp_guess(p_lat double precision, p_lon double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles := games.wp_today(); pl games.wp_plays;
begin
  if u is null then raise exception 'Log on first'; end if;
  select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u for update;
  if pl.user_id is null then raise exception 'Press Start first'; end if;
  if pl.guessed_at is null then
    if p_lat is null or p_lon is null then
      -- no pin when the time ran out: the play ends with 0 points
      if pl.started_at > now() - interval '118 seconds' then raise exception 'Put the pin on the map first'; end if;
      pl := games.wp_finish(p, pl, null, null);
    else
      if p_lat not between -90 and 90 then raise exception 'Put the pin on the map first'; end if;
      p_lon := ((p_lon + 180)::numeric % 360 + 360) % 360 - 180;   -- a map dragged around the world sends lon > 180
      pl := games.wp_finish(p, pl, p_lat, p_lon);
    end if;
  end if;
  return games.wp_view(p, pl, false) - 'image';
end $$;

-- rankings: today, or the last 7 days (Discord-verified players only)
create or replace function public.gry_wp_top(p_scope text default 'day') returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (select (now() at time zone 'utc')::date as today),
  rows as (
    select x.user_id, max(x.nick) nick, sum(x.points) pts, count(*) n, min(x.guessed_at - x.started_at) best_time
      from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id, d
     where x.verified and x.guessed_at is not null
       and (case when p_scope = 'week' then q.day > d.today - 7 else q.day = d.today end)
     group by x.user_id)
  select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'points', pts, 'played', n) order by pts desc, best_time), '[]'::jsonb)
    from (select * from rows order by pts desc, best_time limit 10) t
$$;

-- PEP reward: a verified player leaves an address after today's guess (or yesterday's)
create or replace function public.gry_wp_claim(p_address text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a text := btrim(coalesce(p_address, '')); c games.config; pl games.wp_plays; q games.wp_puzzles;
        pep numeric; wk numeric;
begin
  if u is null or games.discord_identity(u) is null then raise exception 'PEP rewards are for players logged on with Discord'; end if;
  select * into c from games.config where id = 1;
  if not c.wp_rewards_open then raise exception 'Rewards are paused right now'; end if;
  if a !~ '^P[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That is not a PEP address (it starts with P and has 34 characters)'; end if;
  select x.* into pl from games.wp_plays x join games.wp_puzzles w on w.id = x.puzzle_id
   where x.user_id = u and x.guessed_at is not null and w.day >= games.wp_utc_day() - 1
     and not exists (select 1 from games.wp_claims k where k.puzzle_id = x.puzzle_id and k.user_id = u)
   order by w.day desc limit 1;
  if pl.user_id is null then raise exception 'Nothing to claim: play today''s puzzle first (one reward per puzzle)'; end if;
  if exists (select 1 from games.wp_claims k where k.address = a and k.user_id <> u and k.created_at > now() - interval '90 days') then
    raise exception 'That address is already used by another player'; end if;
  pep := least(c.wp_max_day, floor(coalesce(pl.points, 0) / 50.0) * c.wp_pep_per_50);
  select coalesce(sum(k.pep), 0) into wk from games.wp_claims k where k.user_id = u and k.status <> 'held' and k.created_at > now() - interval '7 days';
  pep := least(pep, greatest(0, c.wp_max_week - wk));
  if pep <= 0 then raise exception 'No reward this time (score too low, or the weekly limit is reached)'; end if;
  select * into q from games.wp_puzzles where id = pl.puzzle_id;
  insert into games.wp_claims (puzzle_id, user_id, nick, address, pep) values (pl.puzzle_id, u, pl.nick, a, pep);
  return jsonb_build_object('pep', pep, 'status', 'open', 'num', q.num);
end $$;

create or replace function public.gry_wp_my_claims() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('num', q.num, 'pep', k.pep, 'status', k.status, 'txid', k.txid, 'at', k.created_at) order by k.created_at desc), '[]'::jsonb)
    from (select * from games.wp_claims where user_id = auth.uid() order by created_at desc limit 20) k join games.wp_puzzles q on q.id = k.puzzle_id
$$;

-- ---------- host ----------
create or replace function public.gry_wp_host_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'day', day, 'num', num, 'title', title, 'lat', lat, 'lon', lon,
            'country', country, 'continent', continent, 'wiki_url', wiki_url, 'credit', credit, 'license', license, 'source_url', source_url)
            order by (status = 'pending') desc, day nulls last, decided_at, id)
     from games.wp_puzzles where status <> 'rejected' and (day is null or day >= games.wp_utc_day())), '[]'::jsonb);
end $$;

create or replace function public.gry_wp_host_image(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  return (select data from games.wp_images where puzzle_id = p_id);
end $$;

create or replace function public.gry_wp_host_decide(p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  update games.wp_puzzles set status = case when p_ok then 'approved' else 'rejected' end, decided_at = now()
   where id = p_id and day is null;
  if not found then raise exception 'That puzzle is already live, or gone'; end if;
  if not p_ok then delete from games.wp_images where puzzle_id = p_id; end if;
end $$;

create or replace function public.gry_wp_host_claims() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  return jsonb_build_object(
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nick', k.nick, 'address', k.address, 'pep', k.pep, 'status', k.status,
                 'num', q.num, 'points', x.points, 'at', k.created_at,
                 'other_players_on_address', (select count(distinct z.user_id) from games.wp_claims z where z.address = k.address and z.user_id <> k.user_id)) order by k.created_at)
       from games.wp_claims k join games.wp_puzzles q on q.id = k.puzzle_id
       left join games.wp_plays x on x.puzzle_id = k.puzzle_id and x.user_id = k.user_id
      where k.status in ('open', 'held')), '[]'::jsonb),
    'paid', coalesce((select jsonb_agg(t) from (select txid, sum(pep) pep, count(*) n, max(paid_at) at from games.wp_claims
                      where status = 'paid' group by txid order by max(paid_at) desc limit 10) t), '[]'::jsonb),
    'settings', (select jsonb_build_object('per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week, 'open', wp_rewards_open) from games.config where id = 1));
end $$;

create or replace function public.gry_wp_host_paid(p_ids bigint[], p_txid text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  if coalesce(lower(btrim(p_txid)), '') !~ '^[0-9a-f]{64}$' then raise exception 'A transaction id is 64 characters 0-9 a-f'; end if;
  update games.wp_claims set status = 'paid', txid = lower(btrim(p_txid)), paid_at = now() where id = any(p_ids) and status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.gry_wp_host_hold(p_id bigint, p_hold boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  update games.wp_claims set status = case when p_hold then 'held' else 'open' end where id = p_id and status <> 'paid';
end $$;

create or replace function public.gry_wp_host_settings(p_per_50 numeric, p_max_day int, p_max_week int, p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  if p_per_50 < 0 or p_per_50 > 1000 or p_max_day < 0 or p_max_week < 0 or p_max_week > 1000000 then raise exception 'Those numbers look wrong'; end if;
  update games.config set wp_pep_per_50 = p_per_50, wp_max_day = p_max_day, wp_max_week = p_max_week, wp_rewards_open = p_open where id = 1;
end $$;

-- ---------- robot ----------
create or replace function public.gry_wp_robot_status(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not games.wp_robot_ok(p_token) then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'pending', (select count(*) from games.wp_puzzles where status = 'pending'),
    'approved_waiting', (select count(*) from games.wp_puzzles where status = 'approved' and day is null),
    'used', (select count(*) from games.wp_puzzles));
end $$;

create or replace function public.gry_wp_robot_add(p_token text, p jsonb, p_image text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r games.wp_puzzles;
begin
  if not games.wp_robot_ok(p_token) then raise exception 'Not allowed'; end if;
  if (select count(*) from games.wp_puzzles where status = 'pending') >= 30 then raise exception 'The queue is full'; end if;
  if p_image is null or p_image !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$' or length(p_image) > 700000 then raise exception 'Bad picture'; end if;
  if exists (select 1 from games.wp_puzzles where qid = p->>'qid') then return jsonb_build_object('duplicate', true); end if;
  insert into games.wp_puzzles (qid, title, lat, lon, country, country_code, continent, wiki_url, credit, license, source_url)
  values (left(p->>'qid', 20), left(p->>'title', 120), (p->>'lat')::double precision, (p->>'lon')::double precision,
          left(p->>'country', 80), upper(left(p->>'country_code', 2)), left(p->>'continent', 40), left(p->>'wiki_url', 300),
          left(p->>'credit', 200), left(p->>'license', 60), left(p->>'source_url', 300))
  returning * into r;
  insert into games.wp_images (puzzle_id, data) values (r.id, p_image);
  return jsonb_build_object('id', r.id);
end $$;

-- ---------- access ----------
revoke all on function games.wp_today(), games.wp_view(games.wp_puzzles, games.wp_plays, boolean),
  games.wp_finish(games.wp_puzzles, games.wp_plays, double precision, double precision), games.wp_robot_ok(text),
  games.wp_reveal(games.wp_puzzles), games.wp_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public.gry_wp_today(), public.gry_wp_start(text), public.gry_wp_leave(), public.gry_wp_hint(),
  public.gry_wp_guess(double precision, double precision), public.gry_wp_top(text), public.gry_wp_claim(text), public.gry_wp_my_claims(),
  public.gry_wp_host_queue(), public.gry_wp_host_image(bigint), public.gry_wp_host_decide(bigint, boolean), public.gry_wp_host_claims(),
  public.gry_wp_host_paid(bigint[], text), public.gry_wp_host_hold(bigint, boolean), public.gry_wp_host_settings(numeric, int, int, boolean),
  public.gry_wp_robot_status(text), public.gry_wp_robot_add(text, jsonb, text) from public;
grant execute on function public.gry_wp_today(), public.gry_wp_top(text), public.gry_wp_robot_status(text), public.gry_wp_robot_add(text, jsonb, text) to anon, authenticated;
grant execute on function public.gry_wp_start(text), public.gry_wp_leave(), public.gry_wp_hint(), public.gry_wp_guess(double precision, double precision),
  public.gry_wp_claim(text), public.gry_wp_my_claims(),
  public.gry_wp_host_queue(), public.gry_wp_host_image(bigint), public.gry_wp_host_decide(bigint, boolean), public.gry_wp_host_claims(),
  public.gry_wp_host_paid(bigint[], text), public.gry_wp_host_hold(bigint, boolean), public.gry_wp_host_settings(numeric, int, int, boolean) to authenticated;
