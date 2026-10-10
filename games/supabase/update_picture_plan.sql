-- PEP Games: plan wieczoru Guess the Picture (liczba pytań, punktacja 3/2/1 albo tylko pierwszy, „ostatnie pytanie” z mnożnikiem).
-- Uruchom RAZ w Supabase → SQL Editor (New query → wklej całość → Run). Bezpieczne do powtórzenia, nie kasuje żadnych danych.
-- Jeśli Supabase pokaże ostrzeżenie „Potential issues detected”, wybierz „Run and enable RLS” (jak przy schema.sql).

-- Plan wieczoru Guess the Picture (host zmienia w trakcie): liczba pytań (null = wolna gra), punktacja, „ostatnie pytanie” z mnożnikiem
alter table games.rooms add column if not exists question_total int check (question_total is null or question_total between 1 and 100);
alter table games.rooms add column if not exists scorers int not null default 3 check (scorers in (1, 3));
alter table games.rooms add column if not exists last_turn_no int;
alter table games.rooms add column if not exists last_mult int not null default 1 check (last_mult between 1 and 10);
create or replace function games.final_turn(a int, b int) returns int
language sql immutable as $$ select case when a is null then b when b is null then a else least(a, b) end $$;

create or replace function games.end_turn(p_code text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  select answer into a from games.secrets where room_code = p_code;
  -- kalambury: 2,5 s odsłonięcia hasła + 4 s przerywnika „Next round”; obrazek: 5 s pełnego obrazka
  update games.rooms set phase = 'reveal', last_answer = a,
         next_at = now() + case when mode = 'kalambury' then interval '6.5 seconds'
                                when games.final_turn(last_turn_no, question_total) is not null and turn_no >= games.final_turn(last_turn_no, question_total) then interval '9 seconds'
                                else interval '5 seconds' end
   where code = p_code;
  delete from games.secrets where room_code = p_code;
  perform games.sys(p_code, coalesce(p_reason || ' ', '') || 'The word was: ' || coalesce(a, '?'));
  perform games.notify(p_code, 'state');
end $$;

create or replace function games.next_turn(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; cur_seq bigint; nxt uuid;
begin
  select * into r from games.rooms where code = p_code for update;
  if r.mode = 'obrazek' then
    if games.final_turn(r.last_turn_no, r.question_total) is not null and r.turn_no >= games.final_turn(r.last_turn_no, r.question_total) then
      perform games.finish(p_code); return;
    end if;
    update games.rooms set phase = 'waiting', next_at = null where code = p_code;
    perform games.notify(p_code, 'state');
    return;
  end if;
  select seq into cur_seq from games.players where room_code = p_code and user_id = r.drawer_id;
  select p.user_id into nxt from games.players p
   where p.room_code = p_code and games.active(p) and p.seq > coalesce(cur_seq, 0) order by p.seq limit 1;
  if nxt is null then
    if r.round_no >= r.rounds then perform games.finish(p_code); return; end if;
    update games.rooms set round_no = round_no + 1 where code = p_code;
    select p.user_id into nxt from games.players p where p.room_code = p_code and games.active(p) order by p.seq limit 1;
  end if;
  if nxt is null or (select count(*) from games.players p where p.room_code = p_code and games.active(p)) < 2 then
    perform games.finish(p_code); return;
  end if;
  perform games.start_turn(p_code, nxt);
end $$;

create or replace function public.gry_state(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; sec text; can_see_private boolean; res jsonb;
begin
  select * into r from games.rooms where code = upper(p_code);
  if not found then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.user_id is not null and not me.kicked and me.left_at is null then
    update games.players set last_seen = now() where room_code = r.code and user_id = u;
  end if;
  if r.phase = 'turn' and me.user_id is not null and not me.kicked
     and ((r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host)) then
    select answer into sec from games.secrets where room_code = r.code;
  end if;
  can_see_private := r.phase <> 'turn' or sec is not null or me.guessed_turn = r.turn_id;
  res := jsonb_build_object(
    'now', now(),
    'room', jsonb_build_object('code', r.code, 'mode', r.mode, 'title', r.title, 'status', r.status, 'phase', r.phase,
        'rounds', r.rounds, 'turn_seconds', r.turn_seconds, 'round_no', r.round_no, 'turn_no', r.turn_no,
        'turn_id', r.turn_id, 'drawer_id', r.drawer_id, 'turn_started_at', r.turn_started_at,
        'turn_ends_at', r.turn_ends_at, 'next_at', r.next_at, 'host_id', r.host_id, 'version', r.version,
        'match_id', r.match_id, 'creator_id', r.creator_id,
        'ranked', coalesce((select m.ranked from games.matches m where m.id = r.match_id), false),
        'last_answer', case when r.phase in ('reveal','waiting','finished') then r.last_answer end,
        'question_total', r.question_total, 'scorers', r.scorers, 'last_turn_no', r.last_turn_no, 'last_mult', r.last_mult,
        'final_turn', games.final_turn(r.last_turn_no, r.question_total)),
    'next', case when r.phase = 'reveal' and r.mode = 'kalambury' then games.next_info(r.code) end,
    'mask', games.mask(r.code),
    'secret', sec,
    'podium', case when r.mode = 'obrazek' and r.phase in ('turn','reveal') then
        coalesce((select jsonb_agg(jsonb_build_object('place', g.place, 'nick', g.nick, 'user_id', g.user_id) order by g.place)
                  from games.guesses g where g.turn_id = r.turn_id), '[]'::jsonb) end,
    'spots', case when r.mode = 'obrazek' then least((select picture_scorers from games.config where id = 1), r.scorers, 3) end,
    'cooldown', case when r.mode = 'kalambury' then greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0) else 0 end,
    'me', jsonb_build_object('user_id', u, 'joined', me.user_id is not null and not me.kicked and me.left_at is null,
        'kicked', coalesce(me.kicked, false), 'is_host', coalesce(me.is_host, false) or (u = r.host_id),
        'nick', me.nick, 'guessed', me.guessed_turn is not null and me.guessed_turn = r.turn_id,
        'cooldown_left', case when r.mode = 'kalambury' and me.last_msg_at is not null then
            greatest(0, extract(epoch from me.last_msg_at + make_interval(secs => greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0)) - now()))::float8 else 0 end),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nick', p.nick, 'verified', p.verified,
          'is_host', p.is_host, 'score', p.score, 'active', games.active(p),
          'guessed', r.phase = 'turn' and p.guessed_turn = r.turn_id,
          'place', case when r.mode = 'obrazek' and r.phase in ('turn','reveal') then
                     (select g.place from games.guesses g where g.turn_id = r.turn_id and g.user_id = p.user_id) end) order by p.score desc, p.seq)
        from games.players p where p.room_code = r.code and not p.kicked and p.left_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(m order by (m->>'id')::bigint) from (
        select jsonb_build_object('id', x.id, 'kind', x.kind, 'scope', x.scope, 'nick', x.nick, 'user_id', x.user_id,
                                  'body', x.body, 'at', x.created_at) m
        from games.messages x
        where x.room_code = r.code
          and (x.scope = 'all' or x.turn_id is distinct from r.turn_id or can_see_private)
        order by x.id desc limit 40) s), '[]'::jsonb),
    'results', case when r.phase = 'finished' and r.mode = 'kalambury' then
        (select jsonb_agg(jsonb_build_object('place', q.place, 'nick', q.nick, 'verified', q.verified, 'points', q.score) order by q.place, q.nick)
         from (select p.nick, p.verified, p.score, rank() over (order by p.score desc) place from games.players p
               where p.room_code = r.code and not p.kicked and (p.score > 0 or p.left_at is null)) q)
      when r.phase = 'finished' and r.match_id is not null then
        (select jsonb_agg(jsonb_build_object('place', place, 'nick', nick, 'verified', verified, 'points', points) order by place, nick)
         from games.results where match_id = r.match_id) end
  );
  return res;
end $$;

create or replace function public.gry_start(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; n int; first uuid; mid uuid; se jsonb;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the room moderator can start the game'; end if;
  if r.phase not in ('lobby','finished') then raise exception 'The game is already running'; end if;
  delete from games.players where room_code = r.code and left_at is not null;
  select count(*) into n from games.players p where p.room_code = r.code and games.active(p)
     and not (r.mode = 'obrazek' and p.is_host);
  if r.mode = 'kalambury' and n < 2 then raise exception 'You need at least 2 players'; end if;
  if r.mode = 'obrazek' and n < 1 then raise exception 'You need at least 1 player to guess'; end if;
  -- ranking sezonu: tylko Guess the Picture (event hosta) w tygodniach sezonu; Draw & Guess = casual
  -- Draw & Guess: nic nie trafia do games.matches/results; match_id = tylko id bieżącej gry (słowa bez powtórek)
  if r.mode = 'kalambury' then
    delete from games.used_words where match_id = r.match_id;
    mid := gen_random_uuid();
  else
    se := games.season_at(now());
    insert into games.matches(room_code, mode, title, ranked, season_no, season_name)
    values (r.code, r.mode, r.title, se->>'phase' = 'season',
            case when se->>'phase' = 'season' then (se->>'no')::int end,
            case when se->>'phase' = 'season' then se->>'name' end)
    returning id into mid;
  end if;
  update games.players set score = 0, guessed_turn = null where room_code = r.code;
  delete from games.messages where room_code = r.code;
  update games.rooms set match_id = mid, round_no = 1, turn_no = 0, last_answer = null, drawer_id = null, last_turn_no = null,
         phase = case when mode = 'obrazek' then 'waiting' else phase end where code = r.code;
  perform games.sys(r.code, 'Game on: ' || r.title || '!');
  if r.mode = 'kalambury' then
    select p.user_id into first from games.players p where p.room_code = r.code and games.active(p) order by p.seq limit 1;
    perform games.start_turn(r.code, first);
  else
    update games.rooms set round_no = 0 where code = r.code;
    perform games.notify(r.code, 'state');
  end if;
end $$;

create or replace function public.gry_guess(p_code text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; s games.secrets; txt text := trim(coalesce(p_text, ''));
        k text; is_guesser boolean; is_master boolean; pts int; rnk int; remaining float; v_scope text := 'all';
        eligible int; done int; m jsonb; nsc int := (select picture_scorers from games.config where id = 1); mult int := 1;
        cd int := greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0); wait_s int;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  nsc := least(nsc, r.scorers);
  if games.final_turn(r.last_turn_no, r.question_total) is not null and r.turn_no >= games.final_turn(r.last_turn_no, r.question_total) then mult := r.last_mult; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if txt = '' then return jsonb_build_object('ok', false); end if;
  if char_length(txt) > 120 then txt := left(txt, 120); end if;
  -- Draw & Guess: 1 wiadomość / cd s na gracza (config dg_message_cooldown_seconds); odrzucone próby nie przedłużają blokady odrzuconych prób
  if r.mode = 'kalambury' and cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    wait_s := greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int);
    raise exception 'Slow down — wait %s', wait_s;
  end if;
  -- limit ogólny (Guess the Picture bez zmian): 1 wiadomość / 0,6 s i max 10 na 10 s
  if me.last_msg_at is not null and me.last_msg_at > now() - interval '600 milliseconds' then
    raise exception 'Slow down a little 🙂'; end if;
  if me.msg_window_start is null or me.msg_window_start < now() - interval '10 seconds' then
    update games.players set msg_window_start = now(), msg_window_count = 1, last_msg_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  else
    if me.msg_window_count >= 10 then raise exception 'Too many messages. Take a short break.'; end if;
    update games.players set msg_window_count = msg_window_count + 1, last_msg_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  end if;

  if r.phase = 'turn' then
    select * into s from games.secrets where room_code = r.code;
    k := games.norm(txt);
    is_master := (r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host);
    is_guesser := not is_master and me.guessed_turn is distinct from r.turn_id;
    if is_master and s.keys is not null and exists (select 1 from unnest(s.keys) x where position(x in k) > 0) then
      raise exception 'Don''t give away the answer! 🤐';
    end if;
    if is_guesser and now() < r.turn_started_at then
      raise exception 'Wait for the picture! 👀';
    end if;
    if is_guesser and k = any(s.keys) and r.mode = 'obrazek' then
      -- pierwsze 3 poprawne odpowiedzi = 3 / 2 / 1 pkt, bez mnożnika czasu. Wiersz pokoju jest zablokowany (for update),
      -- więc zgłoszenia są szeregowane; unique(turn_id, place) to druga linia obrony.
      select count(*) + 1 into rnk from games.guesses where turn_id = r.turn_id;
      if rnk > least(nsc, 3) then
        perform games.end_turn(r.code, 'All ' || least(nsc, 3) || ' spots taken!');
        return jsonb_build_object('ok', true, 'correct', false, 'full', true);
      end if;
      insert into games.guesses(match_id, turn_id, user_id, nick, nick_key, verified, place)
      values (r.match_id, r.turn_id, u, me.nick, me.nick_key, me.verified, rnk);
      pts := (case when nsc = 1 then 1 else 4 - rnk end) * mult;
      update games.players set score = score + pts, guessed_turn = r.turn_id where room_code = r.code and user_id = u;
      perform games.sys(r.code, case rnk when 1 then '🥇 1st' when 2 then '🥈 2nd' else '🥉 3rd' end || ' guessed it! ' || me.nick || ' (+' || pts || case when mult > 1 then ', ×' || mult else '' end || ')', 'correct');
      select count(*) filter (where p.guessed_turn = r.turn_id), count(*) into done, eligible
        from games.players p where p.room_code = r.code and games.active(p) and not p.is_host;
      if rnk >= least(nsc, 3) then
        perform games.end_turn(r.code, 'Top ' || least(nsc, 3) || ' found!');
      elsif done >= eligible then
        perform games.end_turn(r.code, 'Everyone guessed it!');
      else
        perform games.notify(r.code, 'state');
      end if;
      return jsonb_build_object('ok', true, 'correct', true, 'points', pts, 'place', rnk);
    end if;
    if is_guesser and k = any(s.keys) then
      remaining := least(r.turn_seconds, greatest(0, extract(epoch from r.turn_ends_at - now())));
      select count(*) + 1 into rnk from games.players where room_code = r.code and guessed_turn = r.turn_id;
      pts := 20 + ceil(80 * remaining / greatest(1, r.turn_seconds))::int
             + case rnk when 1 then 15 when 2 then 8 when 3 then 4 else 0 end;
      update games.players set score = score + pts, guessed_turn = r.turn_id where room_code = r.code and user_id = u;
      if r.mode = 'kalambury' then
        update games.players set score = score + 10 where room_code = r.code and user_id = r.drawer_id;
      end if;
      perform games.sys(r.code, me.nick || ' guessed it! (+' || pts || ')', 'correct');
      select count(*) filter (where p.guessed_turn = r.turn_id), count(*) into done, eligible
        from games.players p where p.room_code = r.code and games.active(p)
         and not ((r.mode = 'kalambury' and p.user_id = r.drawer_id) or (r.mode = 'obrazek' and p.is_host));
      if done >= eligible then
        perform games.end_turn(r.code, 'Everyone guessed it!');
      else
        perform games.notify(r.code, 'state');
      end if;
      return jsonb_build_object('ok', true, 'correct', true, 'points', pts);
    end if;
    if is_guesser and s.keys is not null and char_length(k) >= 4
       and exists (select 1 from unnest(s.keys) x where games.lev(k, x) = 1) then
      return jsonb_build_object('ok', true, 'close', true);   -- „blisko!” widzi tylko zgadujący
    end if;
    if me.guessed_turn = r.turn_id or is_master then v_scope := 'guessed'; end if;
    if is_master then v_scope := 'all'; end if;
  end if;

  insert into games.messages(room_code, turn_id, user_id, nick, kind, scope, body)
  values (r.code, r.turn_id, u, me.nick, 'chat', v_scope, games.clean_text(txt))
  returning jsonb_build_object('id', messages.id, 'kind', messages.kind, 'scope', messages.scope, 'nick', messages.nick, 'user_id', messages.user_id, 'body', messages.body, 'at', messages.created_at) into m;
  if v_scope = 'all' then
    perform realtime.send(jsonb_build_object('code', r.code, 'msg', m), 'msg', 'room:' || r.code, true);
  else
    perform realtime.send(jsonb_build_object('code', r.code, 'private', true), 'msg', 'room:' || r.code, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gry_set_plan(p_code text, p_total int default null, p_scorers int default 3, p_last_mult int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the host can change the plan'; end if;
  if r.mode <> 'obrazek' then raise exception 'Only Guess the Picture rooms have a plan'; end if;
  if p_total is not null and p_total <> 0 and (p_total < 1 or p_total > 100) then raise exception 'Questions: 1–100, or free play'; end if;
  if p_scorers not in (1, 3) then raise exception 'Scoring: winner only or top 3'; end if;
  if p_last_mult is not null and (p_last_mult < 1 or p_last_mult > 10) then raise exception 'Multiplier: 1–10'; end if;
  update games.rooms set question_total = nullif(p_total, 0), scorers = p_scorers, last_mult = coalesce(p_last_mult, last_mult) where code = r.code;
  perform games.notify(r.code, 'state');
end $$;

create or replace function public.gry_last_question(p_code text, p_mult int default null, p_cancel boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; m int;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the host can do that'; end if;
  if r.mode <> 'obrazek' then raise exception 'Only Guess the Picture rooms have a last question'; end if;
  if r.phase not in ('turn','reveal','waiting') then raise exception 'The game is not running'; end if;
  if p_cancel then
    update games.rooms set last_turn_no = null where code = r.code;
    perform games.sys(r.code, 'Last question cancelled.');
  else
    m := coalesce(p_mult, r.last_mult);
    if m < 1 or m > 10 then raise exception 'Multiplier: 1–10'; end if;
    update games.rooms set last_turn_no = case when r.phase = 'turn' then r.turn_no else r.turn_no + 1 end, last_mult = m where code = r.code;
    perform games.sys(r.code, '⭐ Last question!' || case when m > 1 then ' Points ×' || m else '' end);
  end if;
  perform games.notify(r.code, 'state');
end $$;

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
