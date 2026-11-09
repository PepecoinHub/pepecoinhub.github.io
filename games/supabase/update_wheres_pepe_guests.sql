-- Where's Pepe? PEP rewards for guests too, with guards. Run after update_wheres_pepe.sql. Safe to run again.
-- Guests (no Discord): one reward per network a day, only from day 3 of a streak, lower caps.
-- Everyone: a weekly budget for the whole game. The host panel flags suspicious claims.
alter table games.wp_plays add column if not exists ip_hash text;
alter table games.wp_claims add column if not exists verified boolean not null default true;
alter table games.wp_claims add column if not exists ip_hash text;
create index if not exists wp_plays_ip on games.wp_plays (puzzle_id, ip_hash);
alter table games.config add column if not exists wp_guest_max_day int not null default 50;
alter table games.config add column if not exists wp_guest_max_week int not null default 200;
alter table games.config add column if not exists wp_guest_streak int not null default 2;
alter table games.config add column if not exists wp_week_budget numeric(14, 2) not null default 5000;

create or replace function games.wp_play_ip() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
new.ip_hash := coalesce(new.ip_hash, games.client_ip_hash());
return new;
end $$;
drop trigger if exists wp_play_ip on games.wp_plays;
create trigger wp_play_ip before insert on games.wp_plays for each row execute function games.wp_play_ip();

create or replace function games.wp_streak(u uuid, d date) returns int
language plpgsql stable security definer set search_path = '' as $$
declare s int := 0;
begin
while exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
where x.user_id = u and q.day = d - s and x.guessed_at is not null) loop
s := s + 1;
end loop;
return s;
end $$;

-- start of this reward week: Monday 00:00 UTC
create or replace function games.wp_week_start() returns timestamptz
language sql stable set search_path = '' as $$
select date_trunc('week', now() at time zone 'utc') at time zone 'utc'
$$;

create or replace function games.wp_budget_left() returns numeric
language sql stable security definer set search_path = '' as $$
select greatest(0, (select wp_week_budget from games.config where id = 1)
- coalesce((select sum(pep) from games.wp_claims where status <> 'held' and created_at >= games.wp_week_start()), 0))
$$;

-- what this player can get: the page shows it under the result
create or replace function public.gry_wp_rewards() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); c games.config; ver boolean;
begin
select * into c from games.config where id = 1;
ver := u is not null and games.discord_identity(u) is not null;
return jsonb_build_object('open', c.wp_rewards_open, 'verified', ver, 'per_50', c.wp_pep_per_50,
'max_day', case when ver then c.wp_max_day else c.wp_guest_max_day end,
'max_week', case when ver then c.wp_max_week else c.wp_guest_max_week end,
'discord_max_day', c.wp_max_day, 'guest_streak', c.wp_guest_streak,
'streak', case when u is null then 0 else games.wp_streak(u, games.wp_utc_day()) end,
'budget_left', games.wp_budget_left());
end $$;

create or replace function public.gry_wp_claim(p_address text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a text := btrim(coalesce(p_address, '')); c games.config; pl games.wp_plays; q games.wp_puzzles;
pep numeric; wk numeric; ver boolean; ip text := games.client_ip_hash(); mx_d numeric; mx_w numeric;
begin
if u is null then raise exception 'Log on first'; end if;
ver := games.discord_identity(u) is not null;
select * into c from games.config where id = 1 for update;   -- one claim at a time: the budget stays exact
if not c.wp_rewards_open then raise exception 'Rewards are paused right now'; end if;
if a !~ '^P[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That is not a PEP address (it starts with P and has 34 characters)'; end if;
select x.* into pl from games.wp_plays x join games.wp_puzzles w on w.id = x.puzzle_id
where x.user_id = u and x.guessed_at is not null and w.day >= games.wp_utc_day() - 1
and not exists (select 1 from games.wp_claims k where k.puzzle_id = x.puzzle_id and k.user_id = u)
order by w.day desc limit 1;
if pl.user_id is null then raise exception 'Nothing to claim: play today''s puzzle first (one reward per puzzle)'; end if;
select * into q from games.wp_puzzles where id = pl.puzzle_id;
if exists (select 1 from games.wp_claims k where k.address = a and k.user_id <> u and k.created_at > now() - interval '90 days') then
raise exception 'That address is already used by another player'; end if;
if not ver then
if ip is null then raise exception 'Guest rewards need a normal connection. Log on with Discord instead'; end if;
if games.wp_streak(u, q.day) < c.wp_guest_streak then
raise exception 'Guest rewards start on day % of your streak. Keep playing every day, or log on with Discord', c.wp_guest_streak; end if;
-- the network you claim from and the network you played from: each gives one guest reward a day
if exists (select 1 from games.wp_claims k left join games.wp_plays y on y.puzzle_id = k.puzzle_id and y.user_id = k.user_id
where k.puzzle_id = q.id and not k.verified and (k.ip_hash in (ip, pl.ip_hash) or y.ip_hash in (ip, pl.ip_hash))) then
raise exception 'Someone on this network already took today''s guest reward. Log on with Discord for your own'; end if;
end if;
mx_d := case when ver then c.wp_max_day else c.wp_guest_max_day end;
mx_w := case when ver then c.wp_max_week else c.wp_guest_max_week end;
pep := least(mx_d, floor(coalesce(pl.points, 0) / 50.0) * c.wp_pep_per_50);
select coalesce(sum(k.pep), 0) into wk from games.wp_claims k where k.user_id = u and k.status <> 'held' and k.created_at >= games.wp_week_start();
pep := least(pep, greatest(0, mx_w - wk), games.wp_budget_left());
if pep <= 0 then
if games.wp_budget_left() <= 0 then raise exception 'This week''s PEP budget is used up. More next week!'; end if;
raise exception 'No reward this time (score too low, or your weekly limit is reached)';
end if;
insert into games.wp_claims (puzzle_id, user_id, nick, address, pep, verified, ip_hash) values (pl.puzzle_id, u, pl.nick, a, pep, ver, ip);
return jsonb_build_object('pep', pep, 'status', 'open', 'num', q.num);
end $$;

-- host: open claims with flags, and all the settings
create or replace function public.gry_wp_host_claims() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
return jsonb_build_object(
'claims', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nick', k.nick, 'address', k.address, 'pep', k.pep, 'status', k.status,
'num', q.num, 'points', x.points, 'at', k.created_at, 'verified', k.verified,
'secs', round(extract(epoch from x.guessed_at - x.started_at)),
'other_players_on_address', (select count(distinct z.user_id) from games.wp_claims z where z.address = k.address and z.user_id <> k.user_id),
'accounts_on_network', case when k.ip_hash is null then 0 else (select count(distinct y.user_id) from games.wp_plays y where y.puzzle_id = k.puzzle_id and y.ip_hash = k.ip_hash) end
) order by k.created_at)
from games.wp_claims k join games.wp_puzzles q on q.id = k.puzzle_id
left join games.wp_plays x on x.puzzle_id = k.puzzle_id and x.user_id = k.user_id
where k.status in ('open', 'held')), '[]'::jsonb),
'paid', coalesce((select jsonb_agg(t) from (select txid, sum(pep) pep, count(*) n, max(paid_at) at from games.wp_claims
where status = 'paid' group by txid order by max(paid_at) desc limit 10) t), '[]'::jsonb),
'budget_left', games.wp_budget_left(),
'settings', (select jsonb_build_object('per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week, 'open', wp_rewards_open,
'guest_max_day', wp_guest_max_day, 'guest_max_week', wp_guest_max_week, 'guest_streak', wp_guest_streak, 'week_budget', wp_week_budget) from games.config where id = 1));
end $$;

create or replace function public.gry_wp_host_settings2(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
if (p->>'per_50')::numeric not between 0 and 1000 or (p->>'max_day')::int < 0 or (p->>'max_week')::int < 0
or (p->>'guest_max_day')::int < 0 or (p->>'guest_max_week')::int < 0 or (p->>'guest_streak')::int not between 1 and 30
or (p->>'week_budget')::numeric not between 0 and 100000000 then raise exception 'Those numbers look wrong'; end if;
update games.config set wp_pep_per_50 = (p->>'per_50')::numeric, wp_max_day = (p->>'max_day')::int, wp_max_week = (p->>'max_week')::int,
wp_rewards_open = (p->>'open')::boolean, wp_guest_max_day = (p->>'guest_max_day')::int, wp_guest_max_week = (p->>'guest_max_week')::int,
wp_guest_streak = (p->>'guest_streak')::int, wp_week_budget = (p->>'week_budget')::numeric where id = 1;
end $$;

revoke all on function games.wp_play_ip(), games.wp_streak(uuid, date), games.wp_budget_left() from public, anon, authenticated;
revoke all on function public.gry_wp_rewards(), public.gry_wp_claim(text), public.gry_wp_host_claims(), public.gry_wp_host_settings2(jsonb) from public;
grant execute on function public.gry_wp_rewards() to anon, authenticated;
grant execute on function public.gry_wp_claim(text), public.gry_wp_host_claims(), public.gry_wp_host_settings2(jsonb) to authenticated;
