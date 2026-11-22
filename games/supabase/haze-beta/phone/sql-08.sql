-- Haze install, part 8 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
create or replace function public.gry_haze_group_review(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();g games.haze_groups;
begin
 select * into g from games.haze_groups where id=p_id and owner=u for update;
 if not found then raise exception 'Only the host can review this payout.';end if;
 perform games.haze_group_seal(p_id);select * into g from games.haze_groups where id=p_id;
 if g.state<>'ready' or g.submitted_txid is not null or g.expires_at<=clock_timestamp() then raise exception 'This payout is not ready, expired, or already submitted. Follow its status in chat.';end if;
 -- Haze accepts a review that is valid for at most ~31 minutes. Long airdrops give the host 12 hours, so each review
 -- gets its own 30-minute window inside that deadline; the stored window (used by group-check) is unchanged.
 return games.haze_group_manifest(p_id)||jsonb_build_object(
   'created_at',date_trunc('milliseconds',clock_timestamp()-interval '30 seconds'),
   'expires_at',least(g.expires_at,date_trunc('milliseconds',clock_timestamp()+interval '30 minutes')));
end $$;
create or replace function public.gry_haze_group_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();
begin
 update games.haze_groups set state='cancelled' where id=p_id and owner=u and state in ('open','ready','empty') and submitted_txid is null;
 if not found then raise exception 'This event cannot be cancelled after submission.';end if;
 return jsonb_build_object('cancelled',true);
end $$;
create or replace function public.haze_group_context(p_user uuid,p_intent uuid,p_txid text) returns jsonb language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;
begin
 if not (games.haze_open(p_user) and coalesce((select groups_enabled from games.haze_settings where id),false)) or games.discord_identity(p_user) is null then raise exception 'Haze group tips are unavailable.';end if;
 perform 1 from auth.users where id=p_user for no key update;
 select * into g from games.haze_groups where id=p_intent and owner=p_user for update;
 if not found or p_txid !~ '^[a-f0-9]{64}$' or (g.txid is not null and g.txid<>p_txid) then raise exception 'Group payment not found or already bound to a transaction.';end if;
 if g.state<>'confirmed' then
   if g.state<>'ready' or clock_timestamp()>g.expires_at+interval '2 hours' then raise exception 'This group payment cannot be checked.';end if;
   if g.checks>=120 or g.last_checked_at>clock_timestamp()-interval '15 seconds' then raise exception 'Wait at least 15 seconds before checking again.';end if;
   if (select coalesce(sum(checks),0) from games.haze_groups where owner=p_user and created_at>clock_timestamp()-interval '24 hours')>=200 then raise exception 'Daily group check limit reached.';end if;
   update games.haze_groups set submitted_txid=p_txid,last_checked_at=clock_timestamp(),checks=checks+1 where id=g.id;
 end if;
 return games.haze_group_manifest(g.id)||jsonb_build_object('txid',p_txid,'confirmed',g.state='confirmed');
end $$;
create or replace function public.haze_group_confirm(p_user uuid,p_intent uuid,p_txid text,p_block text,p_time bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;
begin
 if not (games.haze_open(p_user) and coalesce((select groups_enabled from games.haze_settings where id),false)) then raise exception 'Haze group tips unavailable.';end if;
 select * into g from games.haze_groups where id=p_intent and owner=p_user for update;
 if not found or p_txid is null or p_txid !~ '^[a-f0-9]{64}$' or p_block is null or p_block !~ '^[a-f0-9]{64}$' or p_time is null or
 p_time<extract(epoch from g.created_at)::bigint-30 or p_time>extract(epoch from g.expires_at)::bigint+7200 or (g.txid is not null and g.txid<>p_txid) or g.state not in ('ready','confirmed') then raise exception 'The verified group payment does not match.';end if;
 if g.state<>'confirmed' then
   insert into games.haze_transactions(txid,kind,intent) values(p_txid,'group',p_intent);
   update games.haze_groups set state='confirmed',txid=p_txid,block_hash=p_block,block_time=p_time,confirmed_at=clock_timestamp() where id=g.id;
   insert into games.passport_badges(user_id,badge_id) values(p_user,'haze_first_tip') on conflict do nothing;
   begin perform realtime.send('{}'::jsonb,'tip','lobby-chat',true);exception when others then null;end;
 end if;
 return jsonb_build_object('id',g.id,'state','confirmed','txid',p_txid);
end $$;
revoke all on function games.haze_groups_require_user(),games.haze_answer(text),games.haze_group_members(uuid,text),games.haze_group_manifest(uuid),games.haze_group_split(uuid),games.haze_group_seal(uuid),games.haze_group_entry(uuid,uuid,boolean),games.haze_group_chat_answer() from public,anon,authenticated;
revoke all on function public.gry_haze_group_create(jsonb),public.gry_haze_group_join(uuid),public.gry_haze_groups(),public.gry_haze_group_review(uuid),public.gry_haze_group_cancel(uuid) from public,anon,authenticated;
grant execute on function public.gry_haze_group_create(jsonb),public.gry_haze_group_join(uuid),public.gry_haze_groups(),public.gry_haze_group_review(uuid),public.gry_haze_group_cancel(uuid) to authenticated;
revoke all on function public.haze_group_context(uuid,uuid,text),public.haze_group_confirm(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.haze_group_context(uuid,uuid,text),public.haze_group_confirm(uuid,uuid,text,text,bigint) to service_role;
commit;
