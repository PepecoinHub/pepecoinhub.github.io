-- Adaptive polling for HazeWallet phone alerts (2026-11-22). Run after update_haze_mentions.sql. Optional:
-- the Edge Function works with or without it (without it the hint is guessed from the batch size).
--
-- What changes, and what does not:
--  * "take" with p_args.hint=true returns {items:[...], poll_after:N} instead of the bare array. The Edge Function
--    unwraps it, so the worker still receives the same array. Without hint the reply is the old array.
--  * poll_after: 1 s when a full batch (10) was claimed, 5 s while items are in flight, otherwise the seconds until
--    the next queued retry becomes due (min 1), and 60 s when the queue is empty.
--  * The sender heartbeat row is rewritten at most every 20 s (it used to be rewritten on every poll), and the
--    60-day / 1-day cleanup runs only together with that heartbeat write. Registration still requires a
--    heartbeat younger than 3 minutes (community_v1_mentions is untouched), which a 60 s poll keeps fresh.
--  * Leases, retry back-off, the 8-attempt cap, the 128-per-device cap, skip-locked claiming, opt-outs and the
--    beta/allowlist gates are byte-for-byte the same as in update_haze_mentions.sql.
begin;
create or replace function public.haze_mention_delivery(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item games.haze_mention_queue; result jsonb; platform_name text; fresh int:=0; next_due timestamptz; wait int;
begin
 if p_args->>'action'='finish' then
  select * into item from games.haze_mention_queue where event=(p_args->>'event')::bigint
   and install=p_args->>'install' and lease=(p_args->>'lease')::uuid for update;
  if not found then return '{}'::jsonb;end if;
  if p_args->>'result'='gone' then delete from games.haze_mention_devices where install=item.install and token=p_args->>'token';end if;
  if p_args->>'result' in ('sent','gone') then delete from games.haze_mention_queue where event=item.event and install=item.install;
  else update games.haze_mention_queue set available=now()+least(900,15*(2^least(attempt,6))::int)*interval '1 second',lease=null where event=item.event and install=item.install; end if;
  return '{}'::jsonb;
 end if;
 if p_args->>'action'<>'take' then raise exception 'Invalid operation';end if;
 for platform_name in select value from jsonb_array_elements_text(p_args->'platforms') where value in ('ios','android') loop
  insert into games.haze_mention_sender as s values(platform_name,now()) on conflict(platform) do update set seen=excluded.seen
   where s.seen<now()-interval '20 seconds';
  if found then fresh:=fresh+1; end if;
 end loop;
 if fresh>0 then
  delete from games.haze_mention_devices where updated<now()-interval '60 days';
  delete from games.haze_mention_queue where created<now()-interval '1 day' or attempt>=8;
 end if;
 with batch as (
  select q.event,q.install,d.platform,d.token from games.haze_mention_queue q join games.haze_mention_devices d using(install)
  where q.available<=now() and (p_args->'platforms') ? d.platform
  and exists(select 1 from games.community_clients c where c.id='haze-native' and c.enabled and 'chat:read'=any(c.scopes)
    and (c.allowed_users is null or d.owner=any(c.allowed_users)))
  and exists(select 1 from games.community_settings where id and enabled and (not beta_only or exists(select 1 from games.haze_testers where user_id=d.owner)))
  and not exists(select 1 from games.mention_optout o where o.user_id=d.owner)
  order by q.available limit 10 for update of q skip locked
 ), claimed as (
  update games.haze_mention_queue q set attempt=q.attempt+1,lease=gen_random_uuid(),available=now()+interval '2 minutes'
   from batch b where (b.event,b.install)=(q.event,q.install) returning q.event::text,q.install,q.lease,b.platform,b.token
 ) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 if coalesce((p_args->>'hint')::boolean,false) is not true then return result; end if;
 if jsonb_array_length(result)>=10 then wait:=1;
 elsif jsonb_array_length(result)>0 then wait:=5;
 else
  select min(q.available) into next_due from games.haze_mention_queue q join games.haze_mention_devices d using(install)
   where (p_args->'platforms') ? d.platform;
  wait:=case when next_due is null then 60 else greatest(1,least(60,ceil(extract(epoch from next_due-now()))::int)) end;
 end if;
 return jsonb_build_object('items',result,'poll_after',wait);
end $$;
revoke all on function public.haze_mention_delivery(jsonb) from public,anon,authenticated;
grant execute on function public.haze_mention_delivery(jsonb) to service_role;
commit;
