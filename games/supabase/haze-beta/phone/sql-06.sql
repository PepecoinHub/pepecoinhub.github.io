-- Haze install, part 6 of 8. Run the parts IN ORDER (01, 02, ...). Repeatable.
begin;
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
commit;
