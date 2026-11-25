-- PEP Drop SQL, part 1 of 4: tables (drops start switched OFF)
-- Run parts 1, 2, 3, 4 in order in the Supabase SQL editor (each one: paste, Run). Safe to run again.
-- Same content as games/supabase/update_guest_drops.sql, split for copying on a phone.
begin;
create table if not exists games.gdrop_settings(
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  daily boolean not null default true,                       -- open one by itself every day at daily_at
  daily_at time not null default '20:00',
  tz text not null default 'Europe/Warsaw',
  pool_pep numeric(14, 2) not null default 300 check (pool_pep between 1 and 100000),
  minutes int not null default 60 check (minutes between 5 and 720),
  max_entries int not null default 200 check (max_entries between 1 and 200)
);
insert into games.gdrop_settings(id) values (true) on conflict do nothing;

create table if not exists games.gdrops(
  id bigint generated always as identity primary key,
  slot date unique,                                          -- the day of a daily drop (null for one started by hand)
  title text not null default 'PEP Drop',
  pool_pep numeric(14, 2) not null check (pool_pep >= 1),
  max_entries int not null check (max_entries between 1 and 200),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  state text not null default 'live' check (state in ('live', 'cancelled', 'empty', 'paid')),
  group_id uuid references games.haze_groups(id) on delete set null,   -- the newest Haze payout prepared for it
  txid text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index if not exists gdrops_closes on games.gdrops(closes_at);

create table if not exists games.gdrop_entries(
  drop_id bigint not null references games.gdrops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nick text not null,
  address text not null check (address ~ '^P[1-9A-HJ-NP-Za-km-z]{33}$'),
  verified boolean not null default false,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  primary key (drop_id, user_id),
  unique (drop_id, address),
  unique (drop_id, ip_hash)
);
create index if not exists gdrop_entries_address on games.gdrop_entries(address, created_at);

alter table games.gdrop_settings enable row level security;
alter table games.gdrops enable row level security;
alter table games.gdrop_entries enable row level security;
revoke all on games.gdrop_settings, games.gdrops, games.gdrop_entries from public, anon, authenticated;
commit;
