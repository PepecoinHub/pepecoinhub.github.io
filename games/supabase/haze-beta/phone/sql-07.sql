-- Haze install, part 7 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
create or replace function games.haze_group_entry(p_id uuid,p_user uuid,p_correct boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;l games.haze_links;n text;
begin
 select * into g from games.haze_groups where id=p_id for update;
 if not found or g.state<>'open' or clock_timestamp()>=g.closes_at or p_user=g.owner or games.discord_identity(p_user) is null then return false;end if;
 select * into l from games.haze_links where user_id=p_user;
 if l.address is null or exists(select 1 from games.lobby_mutes where user_id=p_user and until>clock_timestamp()) then return false;end if;
 if not exists(select 1 from games.haze_group_eligible where group_id=p_id and user_id=p_user) then return false;end if;
 select nick into n from games.profiles where user_id=p_user;
 insert into games.haze_group_entries(group_id,user_id,nick,address,qualified) values(p_id,p_user,coalesce(n,'Fren'),l.address,p_correct) on conflict do nothing;
 if (select count(*) from games.haze_group_entries where group_id=p_id and qualified)>=g.max_winners then perform games.haze_group_seal(p_id);end if;
 return exists(select 1 from games.haze_group_entries where group_id=p_id and user_id=p_user);
end $$;
create or replace function public.gry_haze_group_join(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();
begin
 if not exists(select 1 from games.haze_groups where id=p_id and mode='airdrop') then raise exception 'Choose an airdrop to join.';end if;
 if exists(select 1 from games.haze_group_entries where group_id=p_id and user_id=u) then return jsonb_build_object('joined',true);end if;
 if not games.haze_group_entry(p_id,u,true) then raise exception 'This round is closed, or your receiving wallet is not eligible.';end if;
 return jsonb_build_object('joined',true);
end $$;
create or replace function games.haze_group_chat_answer() returns trigger language plpgsql security definer set search_path='' as $$
declare g games.haze_groups;answer text;correct boolean;
begin
 if not (games.haze_open(new.user_id) and coalesce((select groups_enabled from games.haze_settings where id),false)) then return new;end if;
 if not new.verified or new.hidden_at is not null or games.discord_identity(new.user_id) is null then return new;end if;
 for g in select * from games.haze_groups where state='open' and mode in ('trivia','word') and closes_at>clock_timestamp() and created_at<=new.created_at loop
   if g.mode='trivia' then if new.body !~* '^/answer\s+' then continue;end if;answer:=games.haze_answer(regexp_replace(new.body,'^/answer\s+','','i'));
   else answer:=games.haze_answer(new.body);end if;
   correct:=encode(sha256(convert_to(g.answer_salt||answer,'UTF8')),'hex')=g.answer_hash;
   if g.mode='trivia' or correct then perform games.haze_group_entry(g.id,new.user_id,correct);end if;
 end loop;
 return new;
end $$;
drop trigger if exists haze_group_chat_answer on games.lobby_chat;
create trigger haze_group_chat_answer after insert on games.lobby_chat for each row execute function games.haze_group_chat_answer();
create or replace function public.gry_haze_groups() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();expired record;
begin
 insert into games.lobby_seen(visitor,user_id,seen_at) values('haze:'||u::text,u,clock_timestamp()) on conflict(visitor) do update set seen_at=excluded.seen_at,user_id=excluded.user_id;
 for expired in select id from games.haze_groups where state='open' and closes_at<=clock_timestamp() order by closes_at limit 20 loop perform games.haze_group_seal(expired.id);end loop;
 return jsonb_build_object('now',clock_timestamp(),'member_count',(select count(*) from games.haze_group_members(u,'all')),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'nick',m.nick,'online',m.online) order by m.nick,m.user_id) from(select * from games.haze_group_members(u,'all') limit 2000)m),'[]'::jsonb),
 'drops',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'owner',g.owner,'creator',g.creator,'mode',g.mode,'audience',g.audience,'title',g.title,'note',g.note,'total_atomic',g.total_atomic::text,'state',g.state,
 'created_at',g.created_at,'closes_at',g.closes_at,'expires_at',g.expires_at,'max_winners',g.max_winners,
 'entries',(select count(*) from games.haze_group_entries e where e.group_id=g.id),
 'joined',exists(select 1 from games.haze_group_entries e where e.group_id=g.id and e.user_id=u),
 'eligible',exists(select 1 from games.haze_group_eligible e where e.group_id=g.id and e.user_id=u),
 'count',(select count(*) from games.haze_group_recipients r where r.group_id=g.id),
 'recipients',coalesce((select jsonb_agg(jsonb_build_object('nick',r.nick,'amount',r.amount_atomic::text)) from(select * from games.haze_group_recipients where group_id=g.id order by ordinal limit 12)r),'[]'::jsonb),
 'txid',case when g.state='confirmed' then g.txid else null end,'submitted_txid',case when g.owner=u and g.state='ready' then g.submitted_txid else null end) order by g.created_at desc)
 from(select * from games.haze_groups where created_at>clock_timestamp()-interval '24 hours' order by created_at desc limit 30)g),'[]'::jsonb));
end $$;
commit;
