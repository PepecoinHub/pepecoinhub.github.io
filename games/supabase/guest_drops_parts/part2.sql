-- PEP Drop SQL, part 2 of 4: the card: state and joining
-- Run parts 1, 2, 3, 4 in order in the Supabase SQL editor (each one: paste, Run). Safe to run again.
-- Same content as games/supabase/update_guest_drops.sql, split for copying on a phone.
begin;
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

revoke all on function games.gdrop_ensure(), games.gdrop_phase(games.gdrops), games.gdrop_view(games.gdrops, uuid) from public, anon, authenticated;
revoke all on function public.gry_gdrop_state(), public.gry_gdrop_join(text, text) from public;
grant execute on function public.gry_gdrop_state(), public.gry_gdrop_join(text, text) to anon, authenticated;
commit;
