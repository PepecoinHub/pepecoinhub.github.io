-- PEPaint (Draw & Guess): "who draws" in the room settings. Run once in Supabase → SQL Editor (New query → paste → Run).
-- Safe to run again. Needs schema.sql, update_picture_plan.sql and update_pepaint_first_wins.sql (all live).
--  • 'turns' (the default, as before): everybody draws in turn, round after round.
--  • 'volunteers': after each turn the word is shown for 10 s with an "I'll draw!" button. The first fren to press it
--    draws next (not the one who just drew). Nobody pressed it: the next one in line draws, so the game never stalls.
--    A game is rounds × players turns, as in 'turns'. The first turn of a game goes to the first player in line.
--  • Only the moderator changes it, in the lobby or after a game (gry_draw_mode).
alter table games.rooms add column if not exists draw_mode text not null default 'turns';
alter table games.rooms drop constraint if exists rooms_draw_mode_check;
alter table games.rooms add constraint rooms_draw_mode_check check (draw_mode in ('turns', 'volunteers'));
alter table games.rooms add column if not exists volunteer_id uuid;

create or replace function games.end_turn(p_code text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  select answer into a from games.secrets where room_code = p_code;
  -- kalambury: 2,5 s odsłonięcia hasła + 4 s przerywnika „Next round”; obrazek: 5 s pełnego obrazka
  update games.rooms set phase = 'reveal', last_answer = a, volunteer_id = null,
         next_at = now() + case when mode = 'kalambury' and draw_mode = 'volunteers' then interval '10 seconds'
                                when mode = 'kalambury' then interval '6.5 seconds'
                                when games.final_turn(last_turn_no, question_total) is not null and turn_no >= games.final_turn(last_turn_no, question_total) then interval '9 seconds'
                                else interval '5 seconds' end
   where code = p_code;
  delete from games.secrets where room_code = p_code;
  perform games.sys(p_code, coalesce(p_reason || ' ', '') || 'The word was: ' || coalesce(a, '?'));
  perform games.notify(p_code, 'state');
end $$;

create or replace function games.next_turn(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; cur_seq bigint; nxt uuid; n_act int;
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
  if r.draw_mode = 'volunteers' then
    -- a game of rounds x players turns; whoever said "I'll draw!" first draws, otherwise the next one in line
    n_act := (select count(*) from games.players p where p.room_code = p_code and games.active(p));
    if n_act < 2 or r.turn_no >= r.rounds * n_act then perform games.finish(p_code); return; end if;
    if r.volunteer_id is not null and r.volunteer_id is distinct from r.drawer_id
       and exists (select 1 from games.players p where p.room_code = p_code and p.user_id = r.volunteer_id and games.active(p)) then
      nxt := r.volunteer_id;
    else
      select seq into cur_seq from games.players where room_code = p_code and user_id = r.drawer_id;
      select p.user_id into nxt from games.players p where p.room_code = p_code and games.active(p) and p.seq > coalesce(cur_seq, 0) order by p.seq limit 1;
      if nxt is null then select p.user_id into nxt from games.players p where p.room_code = p_code and games.active(p) order by p.seq limit 1; end if;
    end if;
    update games.rooms set round_no = least(r.rounds, r.turn_no / n_act + 1), volunteer_id = null where code = p_code;
    perform games.start_turn(p_code, nxt);
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

create or replace function games.next_info(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r games.rooms; cur_seq bigint; nxt games.players; rnd int; n_act int;
begin
  select * into r from games.rooms where code = p_code;
  if r.draw_mode = 'volunteers' then
    n_act := (select count(*) from games.players p where p.room_code = p_code and games.active(p));
    if n_act < 2 or r.turn_no >= r.rounds * n_act then return jsonb_build_object('final', true); end if;
    select * into nxt from games.players p where p.room_code = p_code and p.user_id = r.volunteer_id;
    return jsonb_build_object('final', false, 'volunteers', true, 'nick', nxt.nick, 'user_id', nxt.user_id,
                              'round_no', least(r.rounds, r.turn_no / n_act + 1), 'rounds', r.rounds, 'last_drawer', r.drawer_id);
  end if;
  select seq into cur_seq from games.players where room_code = p_code and user_id = r.drawer_id;
  rnd := r.round_no;
  select * into nxt from games.players p where p.room_code = p_code and games.active(p) and p.seq > coalesce(cur_seq, 0)
   order by p.seq limit 1;
  if nxt.user_id is null then
    if r.round_no >= r.rounds then return jsonb_build_object('final', true); end if;
    rnd := r.round_no + 1;
    select * into nxt from games.players p where p.room_code = p_code and games.active(p) order by p.seq limit 1;
  end if;
  if nxt.user_id is null then return jsonb_build_object('final', true); end if;
  return jsonb_build_object('final', false, 'nick', nxt.nick, 'user_id', nxt.user_id, 'round_no', rnd, 'rounds', r.rounds);
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
        'match_id', r.match_id, 'creator_id', r.creator_id, 'draw_mode', r.draw_mode, 'volunteer_id', r.volunteer_id,
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

-- the moderator picks how the next drawer is chosen (between games only)
create or replace function public.gry_draw_mode(p_code text, p_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  if r.mode <> 'kalambury' then raise exception 'Only PEPaint rooms have this setting'; end if;
  if r.host_id is distinct from u then raise exception 'Only the room moderator can change that'; end if;
  if p_mode not in ('turns', 'volunteers') then raise exception 'Unknown setting'; end if;
  if r.phase not in ('lobby', 'finished') then raise exception 'Change it before the game starts'; end if;
  update games.rooms set draw_mode = p_mode where code = r.code;
  perform games.sys(r.code, case when p_mode = 'volunteers' then 'Who draws: volunteers. After each word, press "I''ll draw!" to draw next.'
                                 else 'Who draws: everybody in turn.' end);
  perform games.notify(r.code, 'state');
  return jsonb_build_object('ok', true, 'draw_mode', p_mode);
end $$;

-- "I'll draw!": while the last word is shown, the first fren to press it draws next (not the one who just drew)
create or replace function public.gry_volunteer(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  if r.mode <> 'kalambury' or r.draw_mode <> 'volunteers' or r.phase <> 'reveal' or r.next_at is null or now() >= r.next_at then
    return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.user_id is null or me.kicked or me.left_at is not null or not games.active(me) then raise exception 'You are not in this room'; end if;
  if u = r.drawer_id then return jsonb_build_object('ok', false, 'error', 'just_drew'); end if;
  if r.volunteer_id is not null then return jsonb_build_object('ok', false, 'error', 'taken', 'volunteer_id', r.volunteer_id); end if;
  update games.rooms set volunteer_id = u where code = r.code;
  perform games.sys(r.code, me.nick || ' volunteers to draw next!');
  perform games.notify(r.code, 'state');
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.gry_draw_mode(text, text), public.gry_volunteer(text) from public, anon;
grant execute on function public.gry_draw_mode(text, text), public.gry_volunteer(text) to authenticated;
