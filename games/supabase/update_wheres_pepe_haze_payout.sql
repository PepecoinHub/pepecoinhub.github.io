-- Pepe Guesser: pay a finished reward week with Haze Wallet (owner, 2026-11-22).
-- The host tools freeze each reward week (Monday 00:00 to Sunday 23:59 UTC) once it ends: the list of addresses and
-- amounts no longer changes. "Pay with Haze" turns the open rewards of finished weeks into one Haze group payout
-- (up to 200 addresses, at least 1 PEP each). The host reviews it in the LAN Party chat (Community drops → Review
-- payout) and approves it in Haze. When the payment has 2 confirmations, these rewards are marked as paid with its
-- transaction id. Cancelling the payout (or letting its 12 hours run out) leaves the rewards open.
-- Run once in the Supabase SQL editor, after the Haze tips + groups SQL and the Pepe Guesser SQL. Safe to run again.
begin;
create table if not exists games.wp_haze_payouts(
  group_id uuid primary key references games.haze_groups(id) on delete cascade,
  claim_ids bigint[] not null,
  created_at timestamptz not null default now()
);
alter table games.wp_haze_payouts enable row level security;
revoke all on games.wp_haze_payouts from public, anon, authenticated;

-- p_merge (owner, 2026-11-23): a player who claimed with two addresses in the week is paid once, on their newest
-- address, but only after the host confirms it (the first call names the player and the addresses).
drop function if exists public.gry_wp_host_haze_payout(bigint[]);
create or replace function public.gry_wp_host_haze_payout(p_ids bigint[], p_merge boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); sa text; g uuid; n int; total numeric; ids bigint[]; wk timestamptz; bad text;
begin
  if not games.is_host_user(u) then raise exception 'Only the host can do this'; end if;
  if not (games.haze_open(u) and coalesce((select groups_enabled from games.haze_settings where id), false)) then
    raise exception 'Haze group payouts are not available right now.'; end if;
  select address into sa from games.haze_links where user_id = u;
  if sa is null then raise exception 'Link your Haze wallet first (LAN Party chat → Haze → Link).'; end if;
  perform 1 from auth.users where id = u for no key update;
  -- open rewards from finished weeks, not the host's own address, not already waiting in a Haze payout
  select array_agg(k.id order by k.id), min(k.created_at) into ids, wk from games.wp_claims k
   where k.id = any(p_ids) and k.status = 'open' and k.created_at < games.wp_week_start() and k.address <> sa
     and not exists (select 1 from games.wp_haze_payouts w join games.haze_groups hg on hg.id = w.group_id
                     where k.id = any(w.claim_ids) and hg.state = 'ready' and hg.expires_at > clock_timestamp());
  if ids is null then raise exception 'No open rewards from a finished week to pay (or a Haze payout for them is already waiting in the LAN Party chat).'; end if;
  if exists (select 1 from games.wp_claims k where k.id = any(ids) and not exists (select 1 from auth.users a where a.id = k.user_id)) then
    raise exception 'A reward belongs to a deleted account. Hold it, then try again.'; end if;
  -- Where each reward is paid: its own address, or with p_merge the player's newest address in the list.
  drop table if exists wp_pay;
  create temp table wp_pay on commit drop as
    select k.id, k.user_id, k.nick, k.pep, k.created_at, k.address,
           first_value(k.address) over (partition by k.user_id order by k.created_at desc, k.id desc) as newest
      from games.wp_claims k where k.id = any(ids);
  if not p_merge then
    select string_agg(x.nick || ' (' || x.addrs || ')', '; ') into bad from
      (select max(nick) nick, string_agg(distinct address, ', ') addrs from wp_pay group by user_id having count(distinct address) > 1) x;
    if bad is not null then
      raise exception 'TWO_ADDRESSES: A player used two addresses this week: %. Confirm to pay all of their rewards to their newest address, or Hold one of them.', bad;
    end if;
  else
    update wp_pay set address = newest;
  end if;
  select string_agg(address || ' (' || s || ' PEP)', ', ') into bad from
    (select address, sum(pep) s from wp_pay group by address having sum(pep) < 1) x;
  if bad is not null then raise exception 'Haze pays at least 1 PEP per address. Hold these, then try again: %', bad; end if;
  select count(distinct address), sum(pep) into n, total from wp_pay;
  if n > 200 then raise exception '% addresses. One Haze payment pays up to 200; hold some for a second payout.', n; end if;
  insert into games.haze_groups(owner, sender_address, creator, mode, audience, title, note, total_atomic, max_winners, closes_at, state, expires_at)
  values (u, sa, coalesce((select nick from games.profiles where user_id = u), 'Host'), 'selected', 'all',
          'Pepe Guesser rewards · week of ' || to_char(date_trunc('week', wk at time zone 'utc'), 'DD Mon'), '',
          (total * 100000000)::numeric(20, 0), n, clock_timestamp(), 'ready', clock_timestamp() + interval '12 hours')
  returning id into g;
  insert into games.haze_group_recipients(group_id, user_id, nick, address, amount_atomic, ordinal)
  select g, (array_agg(user_id order by created_at))[1], (array_agg(nick order by created_at desc))[1], address,
         (sum(pep) * 100000000)::numeric(20, 0), (row_number() over (order by min(created_at), address))::int
    from wp_pay group by address;
  insert into games.wp_haze_payouts(group_id, claim_ids) values (g, ids);
  return jsonb_build_object('id', g, 'addresses', n, 'pep', total, 'claims', cardinality(ids));
end $$;
revoke all on function public.gry_wp_host_haze_payout(bigint[], boolean) from public, anon;
grant execute on function public.gry_wp_host_haze_payout(bigint[], boolean) to authenticated;

-- A confirmed Haze payout marks its rewards as paid, with the transaction id.
create or replace function games.wp_haze_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'confirmed' and old.state is distinct from 'confirmed' then
    update games.wp_claims k set status = 'paid', txid = new.txid, paid_at = now()
      from games.wp_haze_payouts w where w.group_id = new.id and k.id = any(w.claim_ids) and k.status in ('open', 'held');
  end if;
  return new;
end $$;
revoke all on function games.wp_haze_paid() from public, anon, authenticated;
drop trigger if exists wp_haze_paid on games.haze_groups;
create trigger wp_haze_paid after update of state on games.haze_groups for each row execute function games.wp_haze_paid();
commit;
