-- PEP Games: limity anty-flood + sprzątanie starych pokoi. Uruchom RAZ w Supabase → SQL Editor (New query → wklej całość → Run).
-- Bezpieczne do powtórzenia; sam plik niczego nie kasuje (od teraz games.cleanup() usuwa nieużywane pokoje po godzinie).
-- Jeśli Supabase pokaże ostrzeżenie „Potential issues detected”, wybierz „Run and enable RLS” (jak przy schema.sql).
--  • wejście / wyjście z pokoju lub stołu: komunikat „X joined / left” najwyżej raz na 60 s na gracza,
--    powiadomienie 'joined' (wszyscy odświeżają stan, rysujący wysyła cały obrazek) najwyżej raz na 5 s na gracza
--  • gry_img_need: max 6 próśb o brakujące kawałki na gracza na jeden obrazek (turę), dalej po cichu pomijane
--  • kod hosta: bez globalnego limitu (obcy nie zablokuje prawdziwego hosta); 5 błędów / 10 min na konto, 10 / godz. z jednej sieci
--  • sprzątanie pokoi i stołów najwyżej raz na 30 s; nieużywane pokoje kasowane po godzinie (ranking zostaje)

alter table games.config add column if not exists cleanup_at timestamptz;          -- ostatnie sprzątanie pokoi (games.cleanup)
alter table games.config add column if not exists tables_cleanup_at timestamptz;   -- ostatnie sprzątanie stołów (games.tables_cleanup)
alter table games.host_attempts add column if not exists ip text;                  -- skrót IP (games.client_ip_hash), tylko do limitu prób
alter table games.players add column if not exists sys_at timestamptz;             -- ostatni komunikat „X joined / left” tego gracza
alter table games.players add column if not exists join_at timestamptz;            -- ostatnie powiadomienie o wejściu / wyjściu tego gracza
alter table games.players add column if not exists img_need_at timestamptz;
alter table games.players add column if not exists img_need_turn uuid;             -- tura (obrazek), której dotyczy licznik img_need_n
alter table games.players add column if not exists img_need_n int not null default 0;
alter table games.table_members add column if not exists sys_at timestamptz;       -- ostatni komunikat „X is watching / sat down / left”

-- sprzątanie (zamiast crona; wołane z lobby i przy zakładaniu pokoju). gry_lobby woła każdy (także niezalogowani),
-- więc właściwe sprzątanie biegnie najwyżej raz na 30 s: update … where … na wierszu konfiguracji = atomowa blokada.
create or replace function games.cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare em int := (select empty_room_minutes from games.config where id = 1);
begin
  update games.config set cleanup_at = now()
   where id = 1 and (cleanup_at is null or cleanup_at < now() - interval '30 seconds');
  if not found then return; end if;
  -- pokoje Draw & Guess zamykają się same, gdy nikt w nich nie jest aktywny
  update games.rooms r set status = 'closed', updated_at = now()
   where r.status = 'open' and r.mode = 'kalambury' and r.created_at < now() - make_interval(mins => em)
     and not exists (select 1 from games.players p where p.room_code = r.code and games.active(p))
     and r.updated_at < now() - make_interval(mins => em);
  update games.rooms set status = 'closed' where status = 'open' and updated_at < now() - interval '24 hours';
  -- nieużywane pokoje są kasowane po godzinie (hasło, gracze i czat razem z nimi: on delete cascade).
  -- Ranking, Hall of Fame i „ostatnie gry” nie potrzebują wiersza pokoju: games.matches / results / guesses są osobno
  -- (matches.room_code bez klucza obcego). Kasujemy zamknięte pokoje godzinę po zamknięciu (updated_at) oraz otwarte,
  -- w których od godziny nic się nie dzieje i nikt nie zagląda. Wyjątki (Guess the Picture): pokój z niedokończoną grą
  -- (host może ją jeszcze zakończyć i zapisać wyniki) zostaje do zamknięcia regułą 24 h; pokój podpięty pod wydarzenie
  -- z harmonogramu zostaje do 3 h po jego starcie.
  delete from games.rooms r
   where r.updated_at < now() - interval '1 hour'
     and (r.status = 'closed'
          or (not exists (select 1 from games.players p where p.room_code = r.code and not p.kicked and p.left_at is null
                            and p.last_seen > now() - interval '1 hour')
              and not (r.mode = 'obrazek' and (r.phase in ('turn','reveal','waiting')
                       or exists (select 1 from games.events e where e.room_code = r.code and e.starts_at > now() - interval '3 hours')))));
  delete from games.messages where created_at < now() - interval '7 days';
  delete from games.host_attempts where at < now() - interval '1 day';
  delete from games.used_words w where not exists (select 1 from games.matches m where m.id = w.match_id)
     and not exists (select 1 from games.rooms x where x.match_id = w.match_id and x.status = 'open');
end $$;

-- Kod hosta. Limity nieudanych prób: 5 / 10 min na konto i 10 / godz. z jednej sieci (skrót IP; bez nagłówków IP tylko limit konta).
-- Bez limitu globalnego (obcy mógłby nim zablokować prawdziwego hosta). Wiersz games.config jest blokowany (for update)
-- przed liczeniem, więc równoległe próby liczą się po kolei i seria naraz nie przeskoczy limitu.
create or replace function public.gry_host_login(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); c games.config; v_ok boolean; v_ip text := games.client_ip_hash();
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into c from games.config where id = 1 for update;
  if (select count(*) from games.host_attempts a where a.user_id = u and not a.ok and a.at > now() - interval '10 minutes') >= 5
     or (v_ip is not null
         and (select count(*) from games.host_attempts a where a.ip = v_ip and not a.ok and a.at > now() - interval '1 hour') >= 10) then
    raise exception 'Too many attempts. Try again in a few minutes.';
  end if;
  v_ok := c.host_code_hash is not null
        and c.host_code_hash = encode(sha256(convert_to(c.host_code_salt || coalesce(p_code, ''), 'UTF8')), 'hex');
  insert into games.host_attempts(user_id, ok, ip) values (u, v_ok, v_ip);
  if v_ok then
    insert into games.host_sessions values (u, now() + interval '12 hours')
      on conflict (user_id) do update set until = excluded.until;
  end if;
  return v_ok;
end $$;

-- Wejście do pokoju (także po odświeżeniu strony). Anty-flood: komunikat „X joined” najwyżej raz na 60 s na gracza (sys_at,
-- wspólne z „X left”); powiadomienie 'joined' (wszyscy odświeżają stan, rysujący / host obrazka wysyła cały obrazek)
-- najwyżej raz na 5 s na gracza (join_at) — w przeciwnym razie tylko zwracamy stan.
create or replace function public.gry_join(p_code text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; d jsonb; prof games.profiles;
        nick text := trim(coalesce(p_nick, '')); k text; is_ver boolean; v_sys boolean; v_ping boolean;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found or r.status <> 'open' then raise exception 'This room does not exist or is closed'; end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.kicked then raise exception 'The host removed you from this room'; end if;

  d := games.discord_identity(u);
  is_ver := d is not null;
  if is_ver then
    select * into prof from games.profiles where user_id = u;
    if prof.user_id is not null and (nick = '' or games.nick_key(nick) = prof.nick_key) then
      nick := prof.nick;
    end if;
  end if;
  if nick = '' then raise exception 'Enter a nickname'; end if;
  if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]{2,20}$' then
    raise exception 'Nickname: 2–20 characters, letters, digits, space, _ . -'; end if;
  if games.is_profane(nick) then raise exception 'That nickname did not pass the filter. Pick another one.'; end if;
  k := games.nick_key(nick);
  if char_length(k) < 2 then raise exception 'Nickname is too short'; end if;
  if exists (select 1 from games.profiles where nick_key = k and user_id <> u) then
    raise exception 'That nickname is reserved by a verified (Discord) player'; end if;
  if exists (select 1 from games.players p where p.room_code = r.code and p.nick_key = k and p.user_id <> u
             and not p.kicked and p.left_at is null) then
    raise exception 'Someone in this room already uses that nickname'; end if;
  if is_ver then
    insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
    values (u, nick, k, d->>'id', d->>'name')
    on conflict (user_id) do update set nick = excluded.nick, nick_key = excluded.nick_key, discord_name = excluded.discord_name;
  end if;
  if me.user_id is null and (select count(*) from games.players p where p.room_code = r.code and games.active(p))
       >= (select case when r.mode = 'kalambury' then casual_max_players else max_players end from games.config where id = 1) then
    raise exception 'This room is full'; end if;

  v_sys := (me.user_id is null or me.left_at is not null) and (me.sys_at is null or me.sys_at < now() - interval '60 seconds');
  v_ping := me.join_at is null or me.join_at < now() - interval '5 seconds';
  insert into games.players(room_code, user_id, nick, nick_key, verified, is_host, sys_at, join_at)
  values (r.code, u, nick, k, is_ver, u = r.host_id, case when v_sys then now() end, case when v_ping then now() end)
  on conflict (room_code, user_id) do update
    set nick = excluded.nick, nick_key = excluded.nick_key, verified = excluded.verified,
        left_at = null, last_seen = now(),
        sys_at = coalesce(excluded.sys_at, games.players.sys_at), join_at = coalesce(excluded.join_at, games.players.join_at);
  if v_sys then
    perform games.sys(r.code, nick || ' joined');
  end if;
  if v_ping then
    perform games.notify(r.code, 'joined', jsonb_build_object('user_id', u));
  end if;
  return public.gry_state(r.code);
end $$;

-- Wyjście z pokoju. „X left” najwyżej raz na 60 s na gracza (sys_at, wspólne z „X joined”); zwykłe powiadomienie 'state'
-- najwyżej raz na 5 s (join_at, wspólne z 'joined'). Zamknięcie pokoju, zmiana moderatora i koniec tury rysującego — zawsze.
create or replace function public.gry_leave(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; v_sys boolean; v_ping boolean;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  select * into me from games.players where room_code = r.code and user_id = u and left_at is null;
  if me.user_id is null then return; end if;
  v_sys := me.sys_at is null or me.sys_at < now() - interval '60 seconds';
  v_ping := me.join_at is null or me.join_at < now() - interval '5 seconds';
  update games.players set left_at = now(),
         sys_at = case when v_sys then now() else sys_at end, join_at = case when v_ping then now() else join_at end
   where room_code = r.code and user_id = u;
  if v_sys then perform games.sys(r.code, me.nick || ' left'); end if;
  if r.mode = 'kalambury' and not exists (select 1 from games.players p where p.room_code = r.code and games.active(p)) then
    update games.rooms set status = 'closed' where code = r.code;   -- ostatni wyszedł → pokój się zamyka
    perform games.notify(r.code, 'closed');
    return;
  end if;
  if r.mode = 'kalambury' and r.host_id = u then perform games.pass_host(r.code); end if;
  if r.phase = 'turn' and r.mode = 'kalambury' and r.drawer_id = u then
    perform games.end_turn(r.code, 'The drawer left.');
  elsif v_ping then
    perform games.notify(r.code, 'state');
  end if;
end $$;

-- Wejście do stołu. „X is watching / sat down as …” najwyżej raz na 60 s na osobę (sys_at, wspólne z „X left”).
create or replace function public.gry_table_join(p_code text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; me games.table_members; nk jsonb; seat int; specs int; v_sys boolean;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into t from games.tables where code = upper(p_code) for update;
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  select * into me from games.table_members where table_code = t.code and user_id = u;
  nk := games.valid_nick(u, coalesce(nullif(trim(coalesce(p_nick, '')), ''), me.nick));
  if exists (select 1 from games.table_members m where m.table_code = t.code and m.nick_key = nk->>'key' and m.user_id <> u
             and m.left_at is null and m.last_seen > now() - interval '45 seconds') then
    raise exception 'Someone at this table already uses that nickname'; end if;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null and t.status = 'waiting' then
    seat := case when t.p1 is null then 1 when t.p2 is null then 2 end;
  end if;
  if seat is null and (me.user_id is null or me.left_at is not null) then
    if not t.spectators then raise exception 'This table is full (no spectators allowed)'; end if;
    select count(*) into specs from games.table_members m where m.table_code = t.code and m.left_at is null
       and m.user_id is distinct from t.p1 and m.user_id is distinct from t.p2 and m.last_seen > now() - interval '45 seconds';
    if specs >= (select table_max_spectators from games.config where id = 1) then raise exception 'This table has too many spectators right now'; end if;
  end if;
  v_sys := (me.user_id is null or me.left_at is not null) and (me.sys_at is null or me.sys_at < now() - interval '60 seconds');
  insert into games.table_members(table_code, user_id, nick, nick_key, verified, sys_at)
  values (t.code, u, nk->>'nick', nk->>'key', (nk->>'verified')::boolean, case when v_sys then now() end)
  on conflict (table_code, user_id) do update set nick = excluded.nick, nick_key = excluded.nick_key, verified = excluded.verified,
    left_at = null, last_seen = now(), sys_at = coalesce(excluded.sys_at, games.table_members.sys_at);
  if seat = 1 and t.p1 is null then update games.tables set p1 = u where code = t.code; end if;
  if seat = 2 and t.p2 is null then update games.tables set p2 = u where code = t.code; end if;
  select * into t from games.tables where code = t.code;
  if v_sys then
    if seat is null then perform games.tsys(t.code, (nk->>'nick') || ' is watching');
    else perform games.tsys(t.code, (nk->>'nick') || ' sat down as ' || games.tseat_name(t.game, seat)); end if;
  end if;
  if t.status = 'waiting' and t.p1 is not null and t.p2 is not null then
    update games.tables set status = 'playing', move_at = now() where code = t.code;
    perform games.tsys(t.code, case when t.game = 'battleship' then 'Game on! Both players: place your ships.'
                                    else 'Game on! ' || games.tseat_name(t.game, 1) || ' moves first.' end);
  end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

-- Wyjście od stołu. „X left” najwyżej raz na 60 s na osobę (sys_at, jak w gry_table_join).
create or replace function public.gry_table_leave(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; n text; v_sys boolean;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  if not found then return; end if;
  select m.nick, m.sys_at is null or m.sys_at < now() - interval '60 seconds' into n, v_sys
    from games.table_members m where m.table_code = t.code and m.user_id = u and m.left_at is null;
  if n is null then return; end if;
  update games.table_members set left_at = now(), sys_at = case when v_sys then now() else sys_at end
   where table_code = t.code and user_id = u;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is not null and t.status = 'playing' then
    perform games.tfinish(t.code, case when seat = 1 then 'p2' else 'p1' end, n || ' left the table');
  elsif seat is not null and t.status = 'waiting' then
    update games.tables set p1 = case when seat = 1 then null else p1 end, p2 = case when seat = 2 then null else p2 end where code = t.code;
  end if;
  if v_sys then perform games.tsys(t.code, n || ' left'); end if;
  if not exists (select 1 from games.table_members m where m.table_code = t.code and m.left_at is null) then
    update games.tables set status = 'closed' where code = t.code;
  end if;
  perform games.tnotify(t.code);
end $$;

-- sprzątanie stołów (wołane z lobby stołów i przy zakładaniu stołu) — najwyżej raz na 30 s (games.config.tables_cleanup_at)
create or replace function games.tables_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare im int := (select table_idle_minutes from games.config where id = 1);
        fs int := (select table_forfeit_seconds from games.config where id = 1); c text;
begin
  update games.config set tables_cleanup_at = now()
   where id = 1 and (tables_cleanup_at is null or tables_cleanup_at < now() - interval '30 seconds');
  if not found then return; end if;
  for c in select t.code from games.tables t where t.status = 'playing' and exists (
             select 1 from games.table_members m where m.table_code = t.code and m.user_id in (t.p1, t.p2)
               and (m.left_at is not null or m.last_seen < now() - make_interval(secs => fs))) loop
    perform games.tcheck(c);
  end loop;
  for c in select t.code from games.tables t where t.status = 'playing' and (t.tc_base > 0 or t.tc_move > 0) loop
    perform games.tcheck(c);   -- flaga spada także wtedy, gdy nikt nie odświeża stołu
  end loop;
  -- nikt aktywny przy stole przez table_idle_minutes → zamknięty; czekający stół bez nikogo przy nim po 3 min też
  update games.tables t set status = 'closed', updated_at = now()
   where t.status in ('waiting','playing','finished')
     and not exists (select 1 from games.table_members m where m.table_code = t.code and m.left_at is null
                       and m.last_seen > now() - case when t.status = 'waiting' then make_interval(secs => fs) else make_interval(mins => im) end);
  -- dane minimalne: zamknięte stoły (z czatem i listą osób) usuwane po godzinie
  delete from games.tables where status = 'closed' and updated_at < now() - interval '1 hour';
end $$;

-- Guess the Picture: gracz, któremu brakuje kawałków pełnego obrazka, prosi hosta o ich ponowne wysłanie.
-- Kanał img: może pisać tylko host, więc prośba idzie przez serwer (kanał room:, na który klienci nie piszą).
-- Limit: 1 prośba / 2 s na gracza, max 64 numery kawałków, max 6 próśb na gracza na jeden obrazek (turę; licznik po stronie
-- serwera, więc zmiana p_tid go nie zeruje); ponad limit, w zamkniętym pokoju i przed pierwszym obrazkiem prośba jest po cichu
-- pomijana. Bez sprawdzania fazy: klucz do obrazka przychodzi przy odsłonięciu, więc prośby lecą głównie po turze (reveal / waiting).
create or replace function public.gry_img_need(p_code text, p_tid text, p_missing int[]) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; miss int[]; n int;
begin
  if p_tid is null or p_tid !~ '^[a-z0-9-]{1,80}$' then raise exception 'Bad request'; end if;
  select array_agg(distinct x order by x) into miss from unnest(coalesce(p_missing, '{}')) x where x between 0 and 63;
  if miss is null or cardinality(miss) = 0 then return; end if;
  select * into r from games.rooms where code = upper(p_code);
  if not found or r.mode <> 'obrazek' then raise exception 'Room not found'; end if;
  if r.status <> 'open' or r.turn_id is null then return; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  n := case when me.img_need_turn is not distinct from r.turn_id then coalesce(me.img_need_n, 0) else 0 end;
  if n >= 6 then return; end if;
  if me.img_need_at is not null and me.img_need_at > now() - interval '2 seconds' then raise exception 'Slow down a little'; end if;
  update games.players set img_need_at = now(), img_need_turn = r.turn_id, img_need_n = n + 1, last_seen = now()
   where room_code = r.code and user_id = u;
  perform realtime.send(jsonb_build_object('code', r.code, 'tid', p_tid, 'miss', to_jsonb(miss)), 'imgneed', 'room:' || r.code, true);
end $$;

-- uprawnienia: funkcje pomocnicze nie są wywoływalne z API, funkcje gry_* tylko dla zalogowanych (także gości)
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'games' loop
    execute format('revoke all on function %s from public', f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'gry\_%' loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.gry_lobby(), public.gry_ranking(text), public.gry_hall_of_fame(),
  public.gry_recent_games(int), public.gry_season(), public.gry_tables_lobby() to anon;
