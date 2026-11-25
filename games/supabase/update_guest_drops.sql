-- PEP Drop: a daily PEP airdrop in the LAN Party chat that guests can join too (owner, 2026-11-25).
--
-- How it works
--  * Every day at a set time (default 20:00 Warsaw time) a drop opens for a set length (default 60 minutes) with a set
--    pool (default 300 PEP). The host can also start one by hand.
--  * Anyone signed in can join with only a PEP address: a guest (the guest sign-in already has the Cloudflare human
--    check) or a Discord fren. One entry per account, per network and per address. Hosts do not join.
--  * When the timer ends, the pool is split equally among everyone who joined (at least 1 PEP each, up to 200 people).
--  * The host taps "Pay with Haze": it becomes one Haze group payout, reviewed in the LAN Party chat and approved in
--    Haze from the host's own wallet. When it has 2 confirmations, the drop is marked as paid with its transaction id.
--    Cancelling the payout (or letting its 12 hours run out) lets the host prepare it again.
--  * Fraud can never cost more than the pool: more entries only make each share smaller.
--  * No private keys anywhere on the server; nothing moves without the host's approval in Haze.
--
-- Run once in the Supabase SQL editor, after the Haze tips + groups SQL. Safe to run again.
-- Drops start switched OFF: turn them on in LAN Party → PEP Drop → Host (or: update games.gdrop_settings set enabled = true;).
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

-- Opens today's daily drop when its time has come (the first visitor after the start time makes it).
create or replace function games.gdrop_ensure() returns void
language plpgsql security definer set search_path = '' as $$
declare s games.gdrop_settings; d date; t0 timestamptz;
begin
  select * into s from games.gdrop_settings where id;
  if not found or not s.enabled or not s.daily then return; end if;
  d := (now() at time zone s.tz)::date;
  t0 := (d + s.daily_at) at time zone s.tz;
  if now() < t0 or now() >= t0 + make_interval(mins => s.minutes) then return; end if;
  insert into games.gdrops(slot, title, pool_pep, max_entries, opens_at, closes_at)
  values (d, 'PEP Drop · ' || to_char(d, 'DD Mon'), s.pool_pep, least(s.max_entries, floor(s.pool_pep)::int), t0, t0 + make_interval(mins => s.minutes))
  on conflict (slot) do nothing;
end $$;

-- Where a drop stands, as the chat shows it: open, waiting (for the payout), paying, paid, empty, cancelled.
create or replace function games.gdrop_phase(g games.gdrops) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when g.state <> 'live' then g.state
    when now() < g.closes_at then 'open'
    when not exists (select 1 from games.gdrop_entries e where e.drop_id = g.id) then 'empty'
    when exists (select 1 from games.haze_groups h where h.id = g.group_id and h.state = 'ready' and h.expires_at > clock_timestamp()) then 'paying'
    else 'waiting' end
$$;

create or replace function games.gdrop_view(g games.gdrops, u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', g.id, 'title', g.title, 'pool', g.pool_pep, 'max', g.max_entries,
    'opens_at', g.opens_at, 'closes_at', g.closes_at, 'phase', games.gdrop_phase(g), 'txid', g.txid,
    'entries', (select count(*) from games.gdrop_entries e where e.drop_id = g.id),
    'mine', (select jsonb_build_object('address', e.address, 'at', e.created_at) from games.gdrop_entries e where e.drop_id = g.id and e.user_id = u))
$$;

-- Everything the chat card needs. Open to everyone, signed in or not.
create or replace function public.gry_gdrop_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); s games.gdrop_settings; cur games.gdrops; prev games.gdrops; nxt timestamptz; d date;
begin
  perform games.gdrop_ensure();
  select * into s from games.gdrop_settings where id;
  select * into cur from games.gdrops where state = 'live' and now() >= opens_at and now() < closes_at order by closes_at limit 1;
  -- the last finished drop stays on the card for a day (waiting for the payout, or paid)
  select * into prev from games.gdrops where closes_at <= now() and closes_at > now() - interval '24 hours' and state <> 'cancelled'
   order by closes_at desc limit 1;
  if s.enabled and s.daily then
    d := (now() at time zone s.tz)::date;
    nxt := (d + s.daily_at) at time zone s.tz;
    if nxt <= now() then nxt := (d + 1 + s.daily_at) at time zone s.tz; end if;
  end if;
  return jsonb_build_object(
    'enabled', coalesce(s.enabled, false), 'pool', s.pool_pep, 'minutes', s.minutes, 'next_at', nxt,
    'signed_in', u is not null, 'is_host', games.is_host_user(u),
    'drop', case when cur.id is null then null else games.gdrop_view(cur, u) end,
    'last', case when prev.id is null then null else games.gdrop_view(prev, u) end);
end $$;

create or replace function public.gry_gdrop_join(p_address text, p_nick text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a text := btrim(coalesce(p_address, '')); g games.gdrops; ip text := games.client_ip_hash();
  nk text; ver boolean; n int;
begin
  if u is null then raise exception 'Sign in first (as a guest or with Discord).'; end if;
  if games.is_host_user(u) then raise exception 'You are the host: you pay this drop, you do not join it.'; end if;
  perform games.gdrop_ensure();
  select * into g from games.gdrops where state = 'live' and now() >= opens_at and now() < closes_at order by closes_at limit 1 for update;
  if g.id is null then raise exception 'No PEP Drop is open right now.'; end if;
  if a !~ '^P[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That is not a PEP address (it starts with P and has 34 characters).'; end if;
  if exists (select 1 from games.gdrop_entries e where e.drop_id = g.id and e.user_id = u) then
    raise exception 'You are already in this drop.'; end if;
  if ip is null then raise exception 'Joining needs a normal connection. Try again, or log on with Discord.'; end if;
  if exists (select 1 from games.gdrop_entries e where e.drop_id = g.id and e.ip_hash = ip) then
    raise exception 'Someone on this network already joined this drop. One entry per network.'; end if;
  if exists (select 1 from games.gdrop_entries e where e.drop_id = g.id and e.address = a) then
    raise exception 'That address is already in this drop.'; end if;
  if exists (select 1 from games.gdrop_entries e where e.address = a and e.user_id <> u and e.created_at > now() - interval '30 days') then
    raise exception 'That address joined earlier with another player. Use your own address.'; end if;
  if exists (select 1 from games.haze_links h where h.address = a and games.is_host_user(h.user_id)) then
    raise exception 'That is the host''s address.'; end if;
  select count(*) into n from games.gdrop_entries e where e.drop_id = g.id;
  if n >= g.max_entries then raise exception 'This drop is full (% frens). Come back to the next one!', g.max_entries; end if;
  ver := games.discord_identity(u) is not null;
  nk := left(btrim(regexp_replace(coalesce(nullif((select p.nick from games.profiles p where p.user_id = u), ''), p_nick, ''), '[\r\n\t<>]', '', 'g')), 20);
  if nk = '' then nk := 'Guest'; end if;
  insert into games.gdrop_entries(drop_id, user_id, nick, address, verified, ip_hash) values (g.id, u, nk, a, ver, ip);
  return jsonb_build_object('joined', true, 'entries', n + 1, 'closes_at', g.closes_at);
end $$;

-- ----- host tools -----
create or replace function public.gry_gdrop_host() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  perform games.gdrop_ensure();
  return jsonb_build_object(
    'settings', (select jsonb_build_object('enabled', enabled, 'daily', daily, 'daily_at', to_char(daily_at, 'HH24:MI'), 'tz', tz,
                  'pool', pool_pep, 'minutes', minutes, 'max_entries', max_entries) from games.gdrop_settings where id),
    'haze_linked', exists (select 1 from games.haze_links where user_id = u),
    'drops', coalesce((select jsonb_agg(x order by (x->>'id')::bigint desc) from (
       select games.gdrop_view(g, u) || jsonb_build_object(
         'list', coalesce((select jsonb_agg(jsonb_build_object('user_id', e.user_id, 'nick', e.nick, 'address', e.address, 'verified', e.verified,
                   'other_drops', (select count(distinct e2.drop_id) from games.gdrop_entries e2 where e2.user_id = e.user_id and e2.drop_id <> g.id),
                   'wp_other_players', (select count(distinct k.user_id) from games.wp_claims k where k.address = e.address and k.user_id <> e.user_id))
                 order by e.created_at) from games.gdrop_entries e where e.drop_id = g.id), '[]'::jsonb)) x
       from games.gdrops g order by g.id desc limit 7) t), '[]'::jsonb));
end $$;

create or replace function public.gry_gdrop_host_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  if (p->>'pool')::numeric not between 1 and 100000 or (p->>'minutes')::int not between 5 and 720
     or (p->>'max_entries')::int not between 1 and 200 or coalesce(p->>'daily_at', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Pool 1 to 100000 PEP, 5 to 720 minutes, 1 to 200 people, time as HH:MM.'; end if;
  update games.gdrop_settings set enabled = coalesce((p->>'enabled')::boolean, enabled), daily = coalesce((p->>'daily')::boolean, daily),
    daily_at = (p->>'daily_at')::time, pool_pep = (p->>'pool')::numeric, minutes = (p->>'minutes')::int, max_entries = (p->>'max_entries')::int
   where id;
  return jsonb_build_object('saved', true);
end $$;

create or replace function public.gry_gdrop_host_start(p_pool numeric, p_minutes int, p_title text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); s games.gdrop_settings; t text := left(btrim(coalesce(p_title, '')), 60); nid bigint;
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  if p_pool is null or p_pool not between 1 and 100000 or p_minutes is null or p_minutes not between 5 and 720 then
    raise exception 'Pool 1 to 100000 PEP, 5 to 720 minutes.'; end if;
  if exists (select 1 from games.gdrops where state = 'live' and now() < closes_at) then
    raise exception 'A drop is already open. Wait for it to end, or cancel it.'; end if;
  select * into s from games.gdrop_settings where id;
  insert into games.gdrops(title, pool_pep, max_entries, opens_at, closes_at, created_by)
  values (case when t = '' then 'PEP Drop · ' || to_char(now() at time zone s.tz, 'DD Mon HH24:MI') else t end,
          p_pool, least(s.max_entries, floor(p_pool)::int), now(), now() + make_interval(mins => p_minutes), u)
  returning gdrops.id into nid;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.gry_gdrop_host_cancel(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  update games.gdrops set state = 'cancelled' where id = p_id and state = 'live'
     and not exists (select 1 from games.haze_groups h where h.id = gdrops.group_id and (h.submitted_txid is not null or h.state = 'confirmed'));
  if not found then raise exception 'This drop cannot be cancelled (already paid, or a payment was sent).'; end if;
  update games.haze_groups set state = 'cancelled' where id = (select group_id from games.gdrops where id = p_id) and state = 'ready' and submitted_txid is null;
  return jsonb_build_object('cancelled', true);
end $$;

-- Remove one entry (a rule breaker) before the payout is prepared.
create or replace function public.gry_gdrop_host_remove(p_id bigint, p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); g games.gdrops;
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  select * into g from games.gdrops where id = p_id for update;
  if g.id is null or games.gdrop_phase(g) not in ('open', 'waiting') then raise exception 'Entries can be removed only before the payout is prepared.'; end if;
  delete from games.gdrop_entries where drop_id = p_id and user_id = p_user;
  return jsonb_build_object('removed', found);
end $$;

-- A finished drop becomes one Haze group payout: the pool split equally, the remainder (in 0.00000001 PEP) to the first joiners.
create or replace function public.gry_gdrop_host_payout(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); sa text; g games.gdrops; n int; total numeric; q numeric; rem numeric; gid uuid;
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  if not (games.haze_open(u) and coalesce((select groups_enabled from games.haze_settings where id), false)) then
    raise exception 'Haze group payouts are not available right now.'; end if;
  select address into sa from games.haze_links where user_id = u;
  if sa is null then raise exception 'Link your Haze wallet first (LAN Party chat → Haze → Link).'; end if;
  select * into g from games.gdrops where id = p_id for update;
  if g.id is null then raise exception 'Drop not found.'; end if;
  case games.gdrop_phase(g)
    when 'open' then raise exception 'This drop is still open. Pay it after the timer ends.';
    when 'paying' then raise exception 'A Haze payout for this drop is already waiting in the LAN Party chat (Community drops → Review payout).';
    when 'waiting' then null;
    else raise exception 'This drop has nothing to pay.';
  end case;
  delete from games.gdrop_entries e where e.drop_id = g.id and (e.address = sa or not exists (select 1 from auth.users a where a.id = e.user_id));
  select count(*) into n from games.gdrop_entries where drop_id = g.id;
  if n = 0 then update games.gdrops set state = 'empty' where id = g.id; raise exception 'Nobody is left in this drop.'; end if;
  total := (g.pool_pep * 100000000)::numeric(20, 0);
  q := trunc(total / n); rem := mod(total, n);
  if q < 100000000 then raise exception 'Each share would be under 1 PEP. Remove some entries, or make the pool bigger next time.'; end if;
  insert into games.haze_groups(owner, sender_address, creator, mode, audience, title, note, total_atomic, max_winners, closes_at, state, expires_at)
  values (u, sa, coalesce((select nick from games.profiles where user_id = u), 'Host'), 'selected', 'all', g.title, '',
          total, n, clock_timestamp(), 'ready', clock_timestamp() + interval '12 hours')
  returning id into gid;
  insert into games.haze_group_recipients(group_id, user_id, nick, address, amount_atomic, ordinal)
  select gid, e.user_id, e.nick, e.address, q + case when e.rn <= rem then 1 else 0 end, e.rn::int
    from (select x.*, row_number() over (order by x.created_at, x.address) rn from games.gdrop_entries x where x.drop_id = g.id) e;
  update games.gdrops set group_id = gid where id = g.id;
  return jsonb_build_object('id', gid, 'addresses', n, 'pep', g.pool_pep, 'each', round(q / 100000000, 8));
end $$;

-- A confirmed Haze payout marks its drop as paid, with the transaction id.
create or replace function games.gdrop_haze_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'confirmed' and old.state is distinct from 'confirmed' then
    update games.gdrops set state = 'paid', txid = new.txid, paid_at = now() where group_id = new.id and state = 'live';
  end if;
  return new;
end $$;
drop trigger if exists gdrop_haze_paid on games.haze_groups;
create trigger gdrop_haze_paid after update of state on games.haze_groups for each row execute function games.gdrop_haze_paid();

revoke all on function games.gdrop_ensure(), games.gdrop_phase(games.gdrops), games.gdrop_view(games.gdrops, uuid), games.gdrop_haze_paid() from public, anon, authenticated;
revoke all on function public.gry_gdrop_state(), public.gry_gdrop_join(text, text), public.gry_gdrop_host(), public.gry_gdrop_host_settings(jsonb),
  public.gry_gdrop_host_start(numeric, int, text), public.gry_gdrop_host_cancel(bigint), public.gry_gdrop_host_remove(bigint, uuid),
  public.gry_gdrop_host_payout(bigint) from public;
grant execute on function public.gry_gdrop_state(), public.gry_gdrop_join(text, text) to anon, authenticated;
grant execute on function public.gry_gdrop_host(), public.gry_gdrop_host_settings(jsonb),
  public.gry_gdrop_host_start(numeric, int, text), public.gry_gdrop_host_cancel(bigint), public.gry_gdrop_host_remove(bigint, uuid),
  public.gry_gdrop_host_payout(bigint) to authenticated;
commit;

-- Check: select * from games.gdrop_settings;   Turn on: update games.gdrop_settings set enabled = true;
-- Emergency stop: update games.gdrop_settings set enabled = false; update games.gdrops set state = 'cancelled' where state = 'live' and now() < closes_at;
