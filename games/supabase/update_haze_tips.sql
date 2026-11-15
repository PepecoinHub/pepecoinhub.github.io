-- REVIEW BUILD. Run after schema.sql, lobby chat and Fren Passport migrations.
-- No balances, deposits, signing keys, bot wallet or withdrawal endpoint.
-- Disabled by default; the owner enables only after reviewing the Haze release,
-- deploying haze-wallet and configuring its read-only Pepecoin indexer.
begin;
create table if not exists games.haze_settings (
  id boolean primary key default true check (id), enabled boolean not null default false
);
insert into games.haze_settings(id) values(true) on conflict do nothing;
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
alter table games.haze_settings enable row level security;
alter table games.haze_links enable row level security;
alter table games.haze_challenges enable row level security;
alter table games.haze_tips enable row level security;
revoke all on games.haze_settings,games.haze_links,games.haze_challenges,games.haze_tips from public,anon,authenticated;

create or replace function games.haze_require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if not coalesce((select enabled from games.haze_settings where id),false) then raise exception 'Haze tipping is not enabled yet.'; end if;
  if u is null or games.discord_identity(u) is null then raise exception 'Sign in with Discord to use Haze tips.'; end if;
  return u;
end $$;
revoke all on function games.haze_require_user() from public,anon,authenticated;

create or replace function public.gry_haze_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  return jsonb_build_object('enabled',coalesce((select enabled from games.haze_settings where id),false),
    'address',(select address from games.haze_links where user_id=u),
    'pending',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'sender',t.sender_address,'address',t.recipient_address,
      'recipient',t.recipient_nick,'message_id',t.message_id,'amount_atomic',t.amount_atomic::text,'reaction',t.reaction,'note',t.note,
      'created_at',t.created_at,'expires_at',t.expires_at,'txid',t.submitted_txid)) from
      (select * from games.haze_tips where sender=u and submitted_txid is not null and confirmed_at is null
        and expires_at+interval '2 hours'>clock_timestamp() order by created_at desc limit 20) t),'[]'::jsonb));
end $$;
create or replace function public.gry_haze_link_begin() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_require_user(); c games.haze_challenges; at timestamptz:=date_trunc('milliseconds',clock_timestamp());
begin
  -- Lock the user, including the first challenge, so parallel calls share the limit.
  perform 1 from auth.users where id=u for no key update;
  if exists(select 1 from games.haze_challenges where user_id=u and issued_at>clock_timestamp()-interval '30 seconds') then raise exception 'Wait 30 seconds before linking again.'; end if;
  insert into games.haze_challenges(user_id,nonce,issued_at,expires_at)
    values(u,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),at,at+interval '5 minutes')
    on conflict(user_id) do update set nonce=excluded.nonce,issued_at=excluded.issued_at,expires_at=excluded.expires_at,used_at=null,checks=0,last_checked_at=null
    returning * into c;
  return jsonb_build_object('version','haze-auth-v1','audience','https://pepecoinhub.com',
    'network','pepecoin-mainnet','purpose','Link Haze Wallet to PepecoinHub','nonce',c.nonce,
    'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create or replace function public.haze_link_context(p_user uuid,p_nonce text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c games.haze_challenges;
begin
  if not coalesce((select enabled from games.haze_settings where id),false) or games.discord_identity(p_user) is null then raise exception 'Haze linking unavailable.'; end if;
  select * into c from games.haze_challenges where user_id=p_user and nonce=p_nonce and used_at is null and expires_at>clock_timestamp() for update;
  if not found then raise exception 'This wallet-link request expired or was already used.'; end if;
  if c.checks>=5 or c.last_checked_at>clock_timestamp()-interval '1 second' then raise exception 'Too many ownership checks. Start a fresh connection later.'; end if;
  update games.haze_challenges set checks=checks+1,last_checked_at=clock_timestamp() where user_id=p_user;
  return jsonb_build_object('version','haze-auth-v1','audience','https://pepecoinhub.com','network','pepecoin-mainnet',
    'purpose','Link Haze Wallet to PepecoinHub','nonce',c.nonce,
    'issuedAt',to_char(c.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt',to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create or replace function public.haze_link_finish(p_user uuid,p_nonce text,p_address text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not coalesce((select enabled from games.haze_settings where id),false) or games.discord_identity(p_user) is null then raise exception 'Haze linking unavailable.'; end if;
  -- The edge verifier calls this only after checking the exact signature and checksum.
  update games.haze_challenges set used_at=clock_timestamp()
    where user_id=p_user and nonce=p_nonce and used_at is null and expires_at>clock_timestamp();
  if not found then raise exception 'This wallet-link request was already used.'; end if;
  insert into games.haze_links(user_id,address) values(p_user,p_address)
    on conflict(user_id) do update set address=excluded.address,linked_at=clock_timestamp();
  insert into games.passport_badges(user_id,badge_id) values(p_user,'haze_linked') on conflict do nothing;
  return jsonb_build_object('address',p_address,'badge','haze_linked');
end $$;
create or replace function public.gry_haze_unlink() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
  if u is null then raise exception 'Sign in first.'; end if;
  delete from games.haze_links where user_id=u;
  delete from games.haze_challenges where user_id=u;
  delete from games.passport_badges where user_id=u and badge_id='haze_linked';
  return jsonb_build_object('unlinked',true);
end $$;
create or replace function public.gry_haze_tip_begin(p_message bigint,p_amount text,p_reaction text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_require_user(); m games.lobby_chat; s games.haze_links; r games.haze_links; t games.haze_tips; n text:=trim(coalesce(p_note,''));
begin
  perform 1 from auth.users where id=u for no key update;
  if p_amount !~ '^[1-9][0-9]{0,13}$' or p_amount::numeric not between 100000000 and 10000000000000 then raise exception 'Choose between 1 and 100000 native PEP.'; end if;
  if p_reaction not in ('heart','applause','rocket') or length(n)>160 or n ~ '[[:cntrl:]]' or n ~* '(https?://|www\.|discord\.gg)' then raise exception 'Choose a reaction and a short plain-text note.'; end if;
  if games.is_profane(n) or games.is_blocked(n) then raise exception 'Please choose a different note.'; end if;
  if exists(select 1 from games.lobby_mutes where user_id=u and until>clock_timestamp()) then raise exception 'Tipping in this chat is unavailable while muted.'; end if;
  if (select count(*) from games.haze_tips where sender=u and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'Tip limit reached. Try again later.'; end if;
  if exists(select 1 from games.haze_tips where sender=u and created_at>clock_timestamp()-interval '10 seconds') then raise exception 'Wait 10 seconds before starting another tip.'; end if;
  select * into m from games.lobby_chat where id=p_message and hidden_at is null and created_at>clock_timestamp()-interval '24 hours';
  if not found or not m.verified or games.discord_identity(m.user_id) is null or m.user_id=u then raise exception 'Choose a visible message by another Discord fren.'; end if;
  select * into s from games.haze_links where user_id=u;
  select * into r from games.haze_links where user_id=m.user_id;
  if s.address is null then raise exception 'Link your Haze wallet first.'; end if;
  if r.address is null then raise exception 'This fren has not linked a receiving wallet yet.'; end if;
  insert into games.haze_tips(sender,recipient,message_id,sender_address,recipient_address,sender_nick,recipient_nick,amount_atomic,reaction,note)
    values(u,m.user_id,m.id,s.address,r.address,coalesce((select nick from games.profiles where user_id=u),'Fren'),m.nick,p_amount::numeric,p_reaction,n)
    returning * into t;
  return jsonb_build_object('id',t.id,'sender',t.sender_address,'address',t.recipient_address,'recipient',t.recipient_nick,
    'amount_atomic',t.amount_atomic::text,'reaction',t.reaction,'note',t.note,'created_at',t.created_at,'expires_at',t.expires_at);
end $$;

create or replace function public.haze_tip_context(p_user uuid,p_intent uuid,p_txid text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t games.haze_tips;
begin
  if not coalesce((select enabled from games.haze_settings where id),false) or games.discord_identity(p_user) is null then raise exception 'Haze tipping unavailable.'; end if;
  perform 1 from auth.users where id=p_user for no key update;
  if p_txid is null or p_txid !~ '^[a-f0-9]{64}$' then raise exception 'Invalid transaction ID.'; end if;
  select * into t from games.haze_tips where id=p_intent and sender=p_user for update;
  if not found then raise exception 'Tip not found.'; end if;
  if t.txid is not null and t.txid<>p_txid then raise exception 'This tip already has a transaction. Do not send again.'; end if;
  if t.confirmed_at is null then
    if clock_timestamp()>t.expires_at+interval '2 hours' then raise exception 'Tip check expired. Keep your transaction ID and contact support.'; end if;
    if t.checks>=120 or t.last_checked_at>clock_timestamp()-interval '15 seconds' then raise exception 'Wait at least 15 seconds before checking again.'; end if;
    if (select coalesce(sum(checks),0) from games.haze_tips where sender=p_user and created_at>clock_timestamp()-interval '24 hours')>=200 then raise exception 'Daily payment-check limit reached. Keep your transaction ID and contact support.'; end if;
    update games.haze_tips set last_checked_at=clock_timestamp(),checks=checks+1,submitted_txid=p_txid where id=t.id;
  end if;
  return jsonb_build_object('id',t.id,'sender',t.sender_address,'address',t.recipient_address,'amount_atomic',t.amount_atomic::text,
    'created_at',t.created_at,'expires_at',t.expires_at,'confirmed',t.confirmed_at is not null,'txid',p_txid);
end $$;
create or replace function public.haze_tip_confirm(p_user uuid,p_intent uuid,p_txid text,p_vout integer,p_block text,p_time bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t games.haze_tips;
begin
  if not coalesce((select enabled from games.haze_settings where id),false) then raise exception 'Haze tipping unavailable.'; end if;
  select * into t from games.haze_tips where id=p_intent and sender=p_user for update;
  if not found or p_txid is null or p_txid !~ '^[a-f0-9]{64}$' or (t.txid is not null and t.txid<>p_txid) or p_vout is null or p_vout<0 or p_block is null or p_block !~ '^[a-f0-9]{64}$' or p_time is null or
    p_time<extract(epoch from t.created_at)::bigint-30 or p_time>extract(epoch from t.expires_at)::bigint+7200 then raise exception 'The verified payment does not match this tip.'; end if;
  if t.confirmed_at is null then
    update games.haze_tips set txid=p_txid,output_index=p_vout,block_hash=p_block,block_time=p_time,confirmed_at=clock_timestamp() where id=t.id;
    insert into games.passport_badges(user_id,badge_id) values(p_user,'haze_first_tip') on conflict do nothing;
    begin perform realtime.send('{}'::jsonb,'tip','lobby-chat',true); exception when others then null; end;
  end if;
  return jsonb_build_object('id',t.id,'state','confirmed','txid',p_txid);
end $$;

-- Only receipts for visible messages in this batch; never expose addresses or pending tips.
create or replace function public.gry_haze_chat(p_messages bigint[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(array_length(p_messages,1),0)>120 then raise exception 'Too many messages.'; end if;
  if not coalesce((select enabled from games.haze_settings where id),false) then return jsonb_build_object('linked_users','[]'::jsonb,'receipts','[]'::jsonb); end if;
  return jsonb_build_object('linked_users',coalesce((select jsonb_agg(distinct m.user_id) from games.lobby_chat m join games.haze_links l on l.user_id=m.user_id
    where m.id=any(p_messages) and m.hidden_at is null and m.created_at>clock_timestamp()-interval '24 hours'),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'message_id',t.message_id,'sender',t.sender_nick,'recipient',t.recipient_nick,
      'amount_atomic',t.amount_atomic::text,'reaction',t.reaction,'note',t.note,'txid',t.txid,'state','confirmed') order by t.confirmed_at)
      from (select t.* from games.haze_tips t join games.lobby_chat m on m.id=t.message_id where t.confirmed_at is not null and m.id=any(p_messages)
        and m.hidden_at is null and m.created_at>clock_timestamp()-interval '24 hours' order by t.confirmed_at desc limit 200) t),'[]'::jsonb));
end $$;

revoke all on function public.gry_haze_status(),public.gry_haze_link_begin(),public.gry_haze_unlink(),public.gry_haze_tip_begin(bigint,text,text,text),public.gry_haze_chat(bigint[]) from public,anon,authenticated;
grant execute on function public.gry_haze_status(),public.gry_haze_link_begin(),public.gry_haze_unlink(),public.gry_haze_tip_begin(bigint,text,text,text) to authenticated;
grant execute on function public.gry_haze_chat(bigint[]) to anon,authenticated;
revoke all on function public.haze_link_context(uuid,text),public.haze_link_finish(uuid,text,text),public.haze_tip_context(uuid,uuid,text),public.haze_tip_confirm(uuid,uuid,text,integer,text,bigint) from public,anon,authenticated;
grant execute on function public.haze_link_context(uuid,text),public.haze_link_finish(uuid,text,text),public.haze_tip_context(uuid,uuid,text),public.haze_tip_confirm(uuid,uuid,text,integer,text,bigint) to service_role;
commit;
