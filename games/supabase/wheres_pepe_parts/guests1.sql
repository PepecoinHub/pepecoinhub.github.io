-- Where's Pepe guest rewards, part 1 of 3 (run in order)
alter table games.wp_plays add column if not exists ip_hash text;

alter table games.wp_claims add column if not exists verified boolean not null default true;

alter table games.wp_claims add column if not exists ip_hash text;

create index if not exists wp_plays_ip on games.wp_plays (puzzle_id, ip_hash);

alter table games.config add column if not exists wp_guest_max_day int not null default 50;

alter table games.config add column if not exists wp_guest_max_week int not null default 200;

alter table games.config add column if not exists wp_guest_streak int not null default 3;

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

create or replace function games.wp_budget_left() returns numeric
language sql stable security definer set search_path = '' as $$
select greatest(0, (select wp_week_budget from games.config where id = 1)
- coalesce((select sum(pep) from games.wp_claims where status <> 'held' and created_at > now() - interval '7 days'), 0))
$$;

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

