-- Where's Pepe SQL, part 4 of 6 (run the parts in order)
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

