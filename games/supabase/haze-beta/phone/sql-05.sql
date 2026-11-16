-- Haze install, part 5 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
create or replace function games.haze_group_members(p_sender uuid,p_audience text)
 returns table(user_id uuid,nick text,address text,online boolean) language sql stable security definer set search_path='' as $$
 select l.user_id,p.nick,l.address,exists(select 1 from games.lobby_seen s where s.user_id=l.user_id and s.seen_at>clock_timestamp()-interval '90 seconds')
 from games.haze_links l join games.profiles p on p.user_id=l.user_id
 where l.user_id<>p_sender and games.discord_identity(l.user_id) is not null
 and not exists(select 1 from games.lobby_mutes m where m.user_id=l.user_id and m.until>clock_timestamp())
 and (p_audience='all' or (exists(select 1 from games.lobby_seen s where s.user_id=l.user_id and s.seen_at>clock_timestamp()-interval '90 seconds'))=(p_audience='online'))
$$;
create or replace function games.haze_group_manifest(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',g.id,'sender',g.sender_address,'title',g.title,'mode',g.mode,'note',g.note,'total_atomic',g.total_atomic::text,
   'created_at',g.created_at,'expires_at',g.expires_at,'recipients',coalesce((select jsonb_agg(jsonb_build_object('address',r.address,'nick',r.nick,'amount',r.amount_atomic::text) order by r.ordinal) from games.haze_group_recipients r where r.group_id=g.id),'[]'::jsonb))
 from games.haze_groups g where g.id=p_id
$$;
create or replace function games.haze_group_split(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;n integer;q numeric;rem numeric;
begin
 select * into g from games.haze_groups where id=p_id for update;
 select count(*) into n from games.haze_group_recipients where group_id=p_id;
 if n=0 then update games.haze_groups set state='empty' where id=p_id;return;end if;
 if n>200 or g.total_atomic<n::numeric*100000000 then raise exception 'Choose at least 1 PEP for each of the % recipients.',n;end if;
 q:=trunc(g.total_atomic/n);rem:=mod(g.total_atomic,n);
 update games.haze_group_recipients set amount_atomic=q+case when ordinal<=rem then 1 else 0 end where group_id=p_id;
 update games.haze_groups set state='ready',expires_at=clock_timestamp()+interval '30 minutes' where id=p_id;
end $$;
create or replace function games.haze_group_seal(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;
begin
 select * into g from games.haze_groups where id=p_id for update;
 if not found or g.state<>'open' then return;end if;
 if clock_timestamp()<g.closes_at and (select count(*) from games.haze_group_entries where group_id=p_id and qualified)<g.max_winners then return;end if;
 insert into games.haze_group_recipients(group_id,user_id,nick,address,amount_atomic,ordinal)
 select p_id,e.user_id,e.nick,e.address,100000000,row_number()over(order by e.created_at,e.user_id)::integer
 from games.haze_group_entries e join games.haze_links l on l.user_id=e.user_id and l.address=e.address
 where e.group_id=p_id and e.qualified and games.discord_identity(e.user_id) is not null
 and not exists(select 1 from games.lobby_mutes m where m.user_id=e.user_id and m.until>clock_timestamp())
 order by e.created_at,e.user_id limit g.max_winners;
 perform games.haze_group_split(p_id);
end $$;
commit;
