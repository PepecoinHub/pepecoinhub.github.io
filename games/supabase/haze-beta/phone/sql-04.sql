-- Haze install, part 4 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
-- Only receipts for visible messages in this batch; never expose addresses or pending tips.
create or replace function public.gry_haze_chat(p_messages bigint[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(array_length(p_messages,1),0)>120 then raise exception 'Too many messages.'; end if;
  if not games.haze_open(auth.uid()) then return jsonb_build_object('linked_users','[]'::jsonb,'receipts','[]'::jsonb); end if;
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
alter table games.haze_settings add column if not exists groups_enabled boolean not null default false;
create index if not exists haze_lobby_presence on games.lobby_seen(user_id,seen_at);
create or replace function games.haze_groups_require_user() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_require_user();
begin
 if not coalesce((select groups_enabled from games.haze_settings where id),false) then raise exception 'Community tips are not enabled yet.';end if;
 return u;
end $$;
create table if not exists games.haze_groups(
 id uuid primary key default gen_random_uuid(),owner uuid not null references auth.users(id),sender_address text not null,
 creator text not null,mode text not null check(mode in ('all','online','offline','random','selected','airdrop','trivia','word')),
 audience text not null check(audience in ('all','online','offline')),title text not null,note text not null default '',
 total_atomic numeric(20,0) not null check(total_atomic between 100000000 and 10000000000000),
 max_winners integer not null check(max_winners between 1 and 200),state text not null default 'open' check(state in ('open','ready','empty','cancelled','confirmed')),
 answer_hash text,answer_salt text,created_at timestamptz not null default clock_timestamp(),closes_at timestamptz not null,
 expires_at timestamptz,submitted_txid text check(submitted_txid ~ '^[a-f0-9]{64}$'),txid text unique check(txid ~ '^[a-f0-9]{64}$'),
 confirmed_at timestamptz,checks integer not null default 0,last_checked_at timestamptz,block_hash text,block_time bigint
);
create table if not exists games.haze_group_entries(
 group_id uuid not null references games.haze_groups(id) on delete cascade,user_id uuid not null references auth.users(id),
 nick text not null,address text not null,qualified boolean not null,created_at timestamptz not null default clock_timestamp(),primary key(group_id,user_id)
);
create table if not exists games.haze_group_eligible(group_id uuid not null references games.haze_groups(id) on delete cascade,user_id uuid not null references auth.users(id),primary key(group_id,user_id));
create table if not exists games.haze_group_recipients(
 group_id uuid not null references games.haze_groups(id) on delete cascade,user_id uuid not null references auth.users(id),nick text not null,
 address text not null,amount_atomic numeric(20,0) not null check(amount_atomic>=100000000),ordinal integer not null,
 primary key(group_id,user_id),unique(group_id,address),unique(group_id,ordinal)
);
create index if not exists haze_groups_live on games.haze_groups(state,closes_at);
create index if not exists haze_groups_owner on games.haze_groups(owner,created_at);
alter table games.haze_groups enable row level security;
alter table games.haze_group_entries enable row level security;
alter table games.haze_group_eligible enable row level security;
alter table games.haze_group_recipients enable row level security;
revoke all on games.haze_groups,games.haze_group_entries,games.haze_group_recipients,games.haze_group_eligible from public,anon,authenticated;
create or replace function games.haze_answer(t text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(trim(coalesce(t,'')),'\s+',' ','g'))
$$;
commit;
