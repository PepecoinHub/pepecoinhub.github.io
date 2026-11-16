-- Haze install, part 1 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
create table if not exists games.haze_settings (
  id boolean primary key default true check (id), enabled boolean not null default false
);
insert into games.haze_settings(id) values(true) on conflict do nothing;
-- Closed beta (owner + Haze, 2026-11-16): while beta_only is true, only users in games.haze_testers can use
-- any Haze RPC or Edge action. It starts true, so turning `enabled` on never opens tipping to everyone by accident.
alter table games.haze_settings add column if not exists beta_only boolean not null default true;
create table if not exists games.haze_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text not null default '' check(length(label)<=60),
  added_at timestamptz not null default clock_timestamp()
);
alter table games.haze_testers enable row level security;
revoke all on games.haze_testers from public,anon,authenticated;
create or replace function games.haze_open(u uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select s.enabled and (not s.beta_only or (u is not null and exists(select 1 from games.haze_testers t where t.user_id=u)))
    from games.haze_settings s where s.id),false)
$$;
revoke all on function games.haze_open(uuid) from public,anon,authenticated;
create table if not exists games.haze_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  address text not null unique check(address ~ '^P[1-9A-HJ-NP-Za-km-z]{33}$'),
  linked_at timestamptz not null default clock_timestamp()
);
create table if not exists games.haze_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nonce text not null unique check(nonce ~ '^[a-f0-9]{64}$'),
  issued_at timestamptz not null, expires_at timestamptz not null, used_at timestamptz,
  checks integer not null default 0, last_checked_at timestamptz
);
create table if not exists games.haze_tips (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users(id) on delete cascade,
  recipient uuid not null references auth.users(id) on delete cascade,
  message_id bigint references games.lobby_chat(id) on delete set null,
  sender_address text not null, recipient_address text not null,
  sender_nick text not null, recipient_nick text not null,
  amount_atomic numeric(20,0) not null check(amount_atomic between 100000000 and 10000000000000),
  reaction text not null check(reaction in ('heart','applause','rocket')),
  note text not null default '' check(length(note)<=160),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  txid text check(txid ~ '^[a-f0-9]{64}$'),
  output_index integer check(output_index>=0),
  block_hash text, block_time bigint, confirmed_at timestamptz,
  last_checked_at timestamptz, checks integer not null default 0,
  check(sender<>recipient and sender_address<>recipient_address)
);
create unique index if not exists haze_tip_transaction on games.haze_tips(txid) where txid is not null;
-- Untrusted sender-submitted candidate, kept for automatic recovery. It grants
-- no receipt, stamp or global txid reservation; only verification binds txid.
alter table games.haze_tips add column if not exists submitted_txid text check(submitted_txid ~ '^[a-f0-9]{64}$');
create index if not exists haze_tip_sender on games.haze_tips(sender,created_at);
create index if not exists haze_tip_messages on games.haze_tips(message_id,confirmed_at);
create table if not exists games.haze_transactions(txid text primary key check(txid ~ '^[a-f0-9]{64}$'),kind text not null check(kind in ('single','group')),intent uuid not null unique);
alter table games.haze_transactions enable row level security;
revoke all on games.haze_transactions from public,anon,authenticated;
insert into games.haze_transactions(txid,kind,intent) select txid,'single',id from games.haze_tips where confirmed_at is not null on conflict do nothing;
alter table games.haze_settings enable row level security;
alter table games.haze_links enable row level security;
alter table games.haze_challenges enable row level security;
alter table games.haze_tips enable row level security;
revoke all on games.haze_settings,games.haze_links,games.haze_challenges,games.haze_tips from public,anon,authenticated;
create or replace function games.haze_require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if not games.haze_open(u) then raise exception 'Haze tipping is not enabled yet.'; end if;
  if u is null or games.discord_identity(u) is null then raise exception 'Sign in with Discord to use Haze tips.'; end if;
  return u;
end $$;
revoke all on function games.haze_require_user() from public,anon,authenticated;
create or replace function public.gry_haze_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  return jsonb_build_object('enabled',games.haze_open(u),
    'address',(select address from games.haze_links where user_id=u),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'sender',t.sender_address,'address',t.recipient_address,
      'recipient',t.recipient_nick,'message_id',t.message_id,'amount_atomic',t.amount_atomic::text,'reaction',t.reaction,'note',t.note,
      'created_at',t.created_at,'expires_at',t.expires_at,'txid',t.submitted_txid)) from
      (select * from games.haze_tips where sender=u and submitted_txid is not null and confirmed_at is null
        and expires_at+interval '2 hours'>clock_timestamp() order by created_at desc limit 20) t),'[]'::jsonb));
end $$;
commit;
