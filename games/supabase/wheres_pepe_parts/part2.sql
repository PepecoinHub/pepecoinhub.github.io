-- Where's Pepe SQL, part 2 of 6 (run the parts in order)
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

