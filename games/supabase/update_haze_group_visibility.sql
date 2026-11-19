-- Expose authoritative completion deadlines; hide cards only, preserve payment records.
begin;
alter table games.haze_groups add column if not exists finished_at timestamptz;
create or replace function games.haze_group_finished_at() returns trigger language plpgsql set search_path='' as $$
begin
 if new.state in ('confirmed','empty','cancelled') and old.state is distinct from new.state then
   new.finished_at=coalesce(new.confirmed_at,clock_timestamp());
 end if;
 return new;
end $$;
drop trigger if exists haze_group_finished_at on games.haze_groups;
create trigger haze_group_finished_at before update on games.haze_groups for each row execute function games.haze_group_finished_at();
update games.haze_groups set finished_at=coalesce(confirmed_at,closes_at) where state in ('confirmed','empty','cancelled') and finished_at is null;
create or replace function public.gry_haze_groups() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();expired record;
begin
 insert into games.lobby_seen(visitor,user_id,seen_at) values('haze:'||u::text,u,clock_timestamp()) on conflict(visitor) do update set seen_at=excluded.seen_at,user_id=excluded.user_id;
 for expired in select id from games.haze_groups where state='open' and closes_at<=clock_timestamp() order by closes_at limit 20 loop perform games.haze_group_seal(expired.id);end loop;
 return jsonb_build_object('now',clock_timestamp(),'member_count',(select count(*) from games.haze_group_members(u,'all')),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'nick',m.nick,'online',m.online) order by m.nick,m.user_id) from(select * from games.haze_group_members(u,'all') limit 2000)m),'[]'::jsonb),
 'drops',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'owner',g.owner,'creator',g.creator,'mode',g.mode,'audience',g.audience,'title',g.title,'note',g.note,'total_atomic',g.total_atomic::text,'state',g.state,
 'ended_at',case when g.state='confirmed' then g.confirmed_at when g.state in ('empty','cancelled') then g.finished_at when g.state='ready' and g.submitted_txid is null and g.expires_at<=clock_timestamp() then g.expires_at else null end,'created_at',g.created_at,'closes_at',g.closes_at,'expires_at',g.expires_at,'max_winners',g.max_winners,
 'entries',(select count(*) from games.haze_group_entries e where e.group_id=g.id),
 'joined',exists(select 1 from games.haze_group_entries e where e.group_id=g.id and e.user_id=u),
 'eligible',exists(select 1 from games.haze_group_eligible e where e.group_id=g.id and e.user_id=u),
 'count',(select count(*) from games.haze_group_recipients r where r.group_id=g.id),
 'recipients',coalesce((select jsonb_agg(jsonb_build_object('nick',r.nick,'amount',r.amount_atomic::text)) from(select * from games.haze_group_recipients where group_id=g.id order by ordinal limit 12)r),'[]'::jsonb),
 'txid',case when g.state='confirmed' then g.txid else null end,'submitted_txid',case when g.owner=u and g.state='ready' then g.submitted_txid else null end) order by g.created_at desc)
 from(select * from games.haze_groups where created_at>clock_timestamp()-interval '24 hours' order by created_at desc limit 30)g),'[]'::jsonb));
end $$;

commit;
