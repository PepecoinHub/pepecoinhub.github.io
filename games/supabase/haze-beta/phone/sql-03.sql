-- Haze install, part 3 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
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
  if not games.haze_open(p_user) or games.discord_identity(p_user) is null then raise exception 'Haze tipping unavailable.'; end if;
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
  if not games.haze_open(p_user) then raise exception 'Haze tipping unavailable.'; end if;
  select * into t from games.haze_tips where id=p_intent and sender=p_user for update;
  if not found or p_txid is null or p_txid !~ '^[a-f0-9]{64}$' or (t.txid is not null and t.txid<>p_txid) or p_vout is null or p_vout<0 or p_block is null or p_block !~ '^[a-f0-9]{64}$' or p_time is null or
    p_time<extract(epoch from t.created_at)::bigint-30 or p_time>extract(epoch from t.expires_at)::bigint+7200 then raise exception 'The verified payment does not match this tip.'; end if;
  if t.confirmed_at is null then
    insert into games.haze_transactions(txid,kind,intent) values(p_txid,'single',p_intent);
    update games.haze_tips set txid=p_txid,output_index=p_vout,block_hash=p_block,block_time=p_time,confirmed_at=clock_timestamp() where id=t.id;
    insert into games.passport_badges(user_id,badge_id) values(p_user,'haze_first_tip') on conflict do nothing;
    begin perform realtime.send('{}'::jsonb,'tip','lobby-chat',true); exception when others then null; end;
  end if;
  return jsonb_build_object('id',t.id,'state','confirmed','txid',p_txid);
end $$;
commit;
