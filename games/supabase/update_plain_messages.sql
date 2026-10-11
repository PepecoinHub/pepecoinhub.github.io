-- PEP Games: komunikaty z gry bez emotikon (tekst w czacie i błędy). Uruchom RAZ w Supabase → SQL Editor (New query → wklej całość → Run).
-- Bezpieczne do powtórzenia, niczego nie kasuje. Jeśli pojawi się „Potential issues detected”, wybierz „Run and enable RLS”.

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
    raise exception 'Slow down a little'; end if;
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
      raise exception 'Don''t give away the answer!';
    end if;
    if is_guesser and now() < r.turn_started_at then
      raise exception 'Wait for the picture!';
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
      perform games.sys(r.code, case rnk when 1 then '1st' when 2 then '2nd' else '3rd' end || ' guessed it! ' || me.nick || ' (+' || pts || case when mult > 1 then ', ×' || mult else '' end || ')', 'correct');
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
    perform games.sys(r.code, 'Last question!' || case when m > 1 then ' Points ×' || m else '' end);
  end if;
  perform games.notify(r.code, 'state');
end $$;

create or replace function public.gry_room_sticker(p_code text, p_sticker text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; sid text := games.sticker_ok(p_sticker); m jsonb; v_scope text := 'all';
        cd int := greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0);
        scd int := greatest(coalesce((select sticker_cooldown_seconds from games.config where id = 1), 0), 0);
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if r.phase = 'turn' and ((r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host)) then
    raise exception 'No stickers during your turn'; end if;
  if scd > 0 and me.last_sticker_at is not null and me.last_sticker_at > now() - make_interval(secs => scd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_sticker_at + make_interval(secs => scd) - now()))::int); end if;
  if r.mode = 'kalambury' and cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int); end if;
  if me.last_msg_at is not null and me.last_msg_at > now() - interval '600 milliseconds' then raise exception 'Slow down a little'; end if;
  if me.msg_window_start is null or me.msg_window_start < now() - interval '10 seconds' then
    update games.players set msg_window_start = now(), msg_window_count = 1, last_msg_at = now(), last_sticker_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  else
    if me.msg_window_count >= 10 then raise exception 'Too many messages. Take a short break.'; end if;
    update games.players set msg_window_count = msg_window_count + 1, last_msg_at = now(), last_sticker_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  end if;
  if r.phase = 'turn' and me.guessed_turn = r.turn_id then v_scope := 'guessed'; end if;
  insert into games.messages(room_code, turn_id, user_id, nick, kind, scope, body)
  values (r.code, r.turn_id, u, me.nick, 'sticker', v_scope, sid)
  returning jsonb_build_object('id', messages.id, 'kind', messages.kind, 'scope', messages.scope, 'nick', messages.nick, 'user_id', messages.user_id, 'body', messages.body, 'at', messages.created_at) into m;
  if v_scope = 'all' then
    perform realtime.send(jsonb_build_object('code', r.code, 'msg', m), 'msg', 'room:' || r.code, true);
  else
    perform realtime.send(jsonb_build_object('code', r.code, 'private', true), 'msg', 'room:' || r.code, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gry_img_need(p_code text, p_tid text, p_missing int[]) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; miss int[];
begin
  if p_tid is null or p_tid !~ '^[a-z0-9-]{1,80}$' then raise exception 'Bad request'; end if;
  select array_agg(distinct x order by x) into miss from unnest(coalesce(p_missing, '{}')) x where x between 0 and 63;
  if miss is null or cardinality(miss) = 0 then return; end if;
  select * into r from games.rooms where code = upper(p_code);
  if not found or r.mode <> 'obrazek' then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if me.img_need_at is not null and me.img_need_at > now() - interval '2 seconds' then raise exception 'Slow down a little'; end if;
  update games.players set img_need_at = now(), last_seen = now() where room_code = r.code and user_id = u;
  perform realtime.send(jsonb_build_object('code', r.code, 'tid', p_tid, 'miss', to_jsonb(miss)), 'imgneed', 'room:' || r.code, true);
end $$;

