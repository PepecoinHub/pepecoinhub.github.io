-- PEP Drop SQL, part 4 of 4: Pay with Haze + marking paid
-- Run parts 1, 2, 3, 4 in order in the Supabase SQL editor (each one: paste, Run). Safe to run again.
-- Same content as games/supabase/update_guest_drops.sql, split for copying on a phone.
begin;
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

revoke all on function games.gdrop_haze_paid() from public, anon, authenticated;
revoke all on function public.gry_gdrop_host_payout(bigint) from public, anon;
grant execute on function public.gry_gdrop_host_payout(bigint) to authenticated;
commit;

-- Check (should show one row, enabled = false until you turn drops on in LAN Party → PEP Drop → Host tools):
select * from games.gdrop_settings;
