-- Where's Pepe SQL, part 1 of 6 (run the parts in order)
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

