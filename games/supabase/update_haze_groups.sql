-- Review-only native PEP group payments. Run after update_haze_tips.sql.
-- No custody or automatic payout. All recipients and splits are server-owned.
begin;
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
create or replace function public.gry_haze_group_create(p_options jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();g games.haze_groups;md text:=p_options->>'mode';aud text:=coalesce(p_options->>'audience','all');
 total text:=p_options->>'total_atomic';cnt integer:=coalesce((p_options->>'count')::integer,1);secs integer:=coalesce((p_options->>'seconds')::integer,60);
 winners integer:=coalesce((p_options->>'winners')::integer,1);ttl text:=trim(coalesce(p_options->>'title',''));nt text:=trim(coalesce(p_options->>'note',''));
 answer text:=games.haze_answer(p_options->>'answer');salt text:=replace(gen_random_uuid()::text,'-','');ids uuid[];n integer;sa text;
begin
 perform 1 from auth.users where id=u for no key update;
 if jsonb_typeof(p_options)<>'object' or length(p_options::text)>32768 or exists(select 1 from jsonb_object_keys(p_options) k where k not in ('mode','audience','total_atomic','count','seconds','winners','title','note','answer','selected')) then raise exception 'Unsupported group options.';end if;
 if md not in ('all','online','offline','random','selected','airdrop','trivia','word') or aud not in ('all','online','offline') or total !~ '^[1-9][0-9]{0,13}$' or total::numeric not between 100000000 and 10000000000000 then raise exception 'Choose a group mode and 1–100000 native PEP.';end if;
 if md in ('all','selected') then aud:='all';elsif md in ('online','offline') then aud:=md;end if;
 if exists(select 1 from games.lobby_mutes where user_id=u and until>clock_timestamp()) then raise exception 'Group tips are unavailable while muted.';end if;
 select address into sa from games.haze_links where user_id=u;if sa is null then raise exception 'Link your Haze wallet first.';end if;
 if (select count(*) from games.haze_groups where owner=u and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'Group creation limit reached. Try again later.';end if;
 if exists(select 1 from games.haze_groups where owner=u and created_at>clock_timestamp()-interval '10 seconds') then raise exception 'Wait 10 seconds before starting another group.';end if;
 if length(ttl)>120 or length(nt)>160 or (ttl||nt) ~ '[[:cntrl:]]' or (ttl||nt) ~* '(https?://|www\.|discord\.gg)' or games.is_profane(ttl||nt) or games.is_blocked(ttl||nt) then raise exception 'Use a short, friendly question/title and note without links.';end if;
 if md in ('trivia','word') then
   perform pg_advisory_xact_lock(442198231);
   if exists(select 1 from games.haze_groups where mode in ('trivia','word') and state='open' and closes_at>clock_timestamp()) then raise exception 'Finish the current chat question/word round first.';end if;
   if length(answer)<1 or length(answer)>120 or (md='word' and length(answer)>40) or answer ~ '[[:cntrl:]]' or games.is_profane(answer) or games.is_blocked(answer) then raise exception 'Choose a short answer or word.';end if;
   if md='trivia' and length(ttl)<5 then raise exception 'Write the trivia question.';end if;
   if md='word' then ttl:='Say “'||answer||'”';end if;
 end if;
 if ttl='' then ttl:=case md when 'all' then 'PEP for the whole pond' when 'online' then 'PEP for online frens' when 'offline' then 'A surprise for away frens' when 'random' then 'Lucky frens' when 'selected' then 'A little group appreciation' else 'Join the PEP airdrop' end;end if;
 if md in ('airdrop','trivia','word') and (secs<10 or secs>300 or winners<1 or winners>200) then raise exception 'Rounds last 10–300 seconds with up to 200 winners.';end if;
 if md='airdrop' then winners:=least(200,trunc(total::numeric/100000000)::integer);else winners:=least(winners,trunc(total::numeric/100000000)::integer);end if;
 insert into games.haze_groups(owner,sender_address,creator,mode,audience,title,note,total_atomic,max_winners,closes_at,answer_salt,answer_hash)
 values(u,sa,coalesce((select nick from games.profiles where user_id=u),'Fren'),md,aud,ttl,nt,total::numeric,winners,clock_timestamp()+make_interval(secs=>case when md in ('airdrop','trivia','word') then secs else 0 end),
 case when md in ('trivia','word') then salt else null end,case when md in ('trivia','word') then encode(sha256(convert_to(salt||answer,'UTF8')),'hex') else null end) returning * into g;
 if md in ('airdrop','trivia','word') then
   select count(*) into n from games.haze_group_members(u,aud);
   if n=0 or n>2000 then raise exception 'Choose an audience with 1–2000 eligible linked members.';end if;
   insert into games.haze_group_eligible(group_id,user_id) select g.id,m.user_id from games.haze_group_members(u,aud)m;
   update games.haze_groups set max_winners=least(max_winners,n) where id=g.id;
   return jsonb_build_object('id',g.id,'state','open','closes_at',g.closes_at);
 end if;
 if md in ('online','offline') then aud:=md;end if;
 if md='selected' then
   if jsonb_typeof(p_options->'selected')<>'array' or jsonb_array_length(p_options->'selected') not between 1 and 200 then raise exception 'Choose 1–200 linked members.';end if;
   select array_agg(x::uuid) into ids from jsonb_array_elements_text(p_options->'selected') x;
   if cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'Choose each member once.';end if;
 end if;
 select count(*) into n from games.haze_group_members(u,aud) m where md<>'selected' or m.user_id=any(ids);
 if md='selected' and n<>cardinality(ids) then raise exception 'Some selected members are no longer eligible. Refresh the list.';end if;
 if md='random' then if cnt<1 or cnt>200 or cnt>n then raise exception 'Choose 1–200 random recipients, up to the % eligible members.',n;end if;n:=cnt;end if;
 if n=0 then raise exception 'No eligible linked members in that audience.';end if;
 if n>200 then raise exception '% eligible members. One payment supports 200; choose a smaller audience or random selection.',n;end if;
 if total::numeric<n::numeric*100000000 then raise exception 'Choose at least % PEP for % recipients.',n,n;end if;
 insert into games.haze_group_recipients(group_id,user_id,nick,address,amount_atomic,ordinal)
 select g.id,s.user_id,s.nick,s.address,100000000,row_number()over(order by s.draw,s.user_id)::integer
 from (select m.*,case when md='random' then gen_random_uuid() else m.user_id end draw from games.haze_group_members(u,aud)m where md<>'selected' or m.user_id=any(ids) order by draw,m.user_id limit n)s;
 perform games.haze_group_split(g.id);return jsonb_build_object('id',g.id,'state','ready');
end $$;

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
