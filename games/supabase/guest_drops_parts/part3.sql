-- PEP Drop SQL, part 3 of 4: host tools
-- Run parts 1, 2, 3, 4 in order in the Supabase SQL editor (each one: paste, Run). Safe to run again.
-- Same content as games/supabase/update_guest_drops.sql, split for copying on a phone.
begin;
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

revoke all on function public.gry_gdrop_host(), public.gry_gdrop_host_settings(jsonb), public.gry_gdrop_host_start(numeric, int, text),
  public.gry_gdrop_host_cancel(bigint), public.gry_gdrop_host_remove(bigint, uuid) from public, anon;
grant execute on function public.gry_gdrop_host(), public.gry_gdrop_host_settings(jsonb), public.gry_gdrop_host_start(numeric, int, text),
  public.gry_gdrop_host_cancel(bigint), public.gry_gdrop_host_remove(bigint, uuid) to authenticated;
commit;
