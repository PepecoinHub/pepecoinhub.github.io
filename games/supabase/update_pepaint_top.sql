-- PEPaint: top of the week and player stats. Run once in Supabase → SQL Editor (New query → paste → Run).
-- Safe to run again. Run it AFTER update_pepaint_first_wins.sql.
--  • A finished PEPaint game counts when 3+ players took part and 3+ pictures were guessed.
--  • Top of the week: points from counted games since Monday 00:00 UTC. Discord accounts only.
--  • Every player gets their own numbers: games, wins, first guesses, pictures guessed, best game.
--  • Games played before this file was run are not counted (nothing was saved back then).
-- ---------- PEPaint: top of the week and player stats ----------
-- pp_firsts: who guessed first in each turn of the game being played (cleared when the game ends).
-- pp_results: one row per player per finished game that counted (3+ players and 3+ guessed pictures).
create table if not exists games.pp_firsts (
  turn_id uuid primary key,
  match_id uuid not null,
  guesser_id uuid not null,
  drawer_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists pp_firsts_match_idx on games.pp_firsts(match_id);
create table if not exists games.pp_results (
  match_id uuid not null,
  user_id uuid not null,
  nick text not null,
  verified boolean not null,
  points int not null,
  place int not null,
  firsts int not null default 0,      -- pictures this player guessed first
  drawn int not null default 0,       -- this player's own pictures that somebody guessed
  players int not null,
  finished_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists pp_results_time_idx on games.pp_results(finished_at);
create index if not exists pp_results_user_idx on games.pp_results(user_id);
alter table games.pp_firsts enable row level security;    -- no policies = no direct access from the API
alter table games.pp_results enable row level security;
revoke all on games.pp_firsts, games.pp_results from public, anon, authenticated;

create or replace function games.finish(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; n int; t int; counted boolean := false;
begin
  select * into r from games.rooms where code = p_code for update;
  delete from games.secrets where room_code = p_code;
  update games.rooms set phase = 'finished', drawer_id = null, turn_ends_at = null, next_at = null where code = p_code;
  if r.mode = 'kalambury' then
    -- PEPaint: a game counts for the top of the week when 3+ players took part and 3+ pictures were guessed
    delete from games.used_words where match_id = r.match_id;
    select count(*) into n from games.players p where p.room_code = p_code and not p.kicked and (p.score > 0 or p.left_at is null);
    select count(*) into t from games.pp_firsts f where f.match_id = r.match_id;
    counted := r.match_id is not null and n >= 3 and t >= 3;
    if counted then
      insert into games.pp_results(match_id, user_id, nick, verified, points, place, firsts, drawn, players)
      select r.match_id, p.user_id, p.nick, p.verified, p.score, rank() over (order by p.score desc),
             (select count(*) from games.pp_firsts f where f.match_id = r.match_id and f.guesser_id = p.user_id),
             (select count(*) from games.pp_firsts f where f.match_id = r.match_id and f.drawer_id = p.user_id), n
      from games.players p
      where p.room_code = p_code and not p.kicked and (p.score > 0 or p.left_at is null)
      on conflict do nothing;
    end if;
    delete from games.pp_firsts f where f.match_id = r.match_id or f.at < now() - interval '1 day';
  elsif r.match_id is not null then
    update games.matches set finished_at = now() where id = r.match_id;
    insert into games.results(match_id, user_id, nick, nick_key, verified, points, place, finished_at)
    select r.match_id, p.user_id, p.nick, p.nick_key, p.verified, p.score,
           rank() over (order by p.score desc, coalesce(gq.firsts, 0) desc, coalesce(gq.seconds, 0) desc, gq.last_at asc nulls last), now()
    from games.players p
    left join lateral (select count(*) filter (where g.place = 1) firsts, count(*) filter (where g.place = 2) seconds, max(g.at) last_at
                         from games.guesses g where g.match_id = r.match_id and g.user_id = p.user_id) gq on true
    where p.room_code = p_code and not p.kicked
      and not (r.mode = 'obrazek' and p.is_host)
      and (p.score > 0 or p.left_at is null)
    on conflict do nothing;
  end if;
  perform games.sys(p_code, case when r.mode = 'kalambury' and counted then 'Game over! This game counts for the top of the week.'
                                 when r.mode = 'kalambury' then 'Game over! Just for fun: a game counts for the top of the week with 3+ players and 3+ guessed pictures.'
                                 else 'Game over! Scores were added to the leaderboard.' end);
  perform games.notify(p_code, 'state');
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
      -- PEPaint (Draw & Guess): first come, first served. The first correct guess ends the turn.
      -- The guesser gets 50 to 100 points and the artist 25 to 50, both by how much time was left.
      remaining := least(r.turn_seconds, greatest(0, extract(epoch from r.turn_ends_at - now())));
      pts := 50 + ceil(50 * remaining / greatest(1, r.turn_seconds))::int;
      rnk := 25 + ceil(25 * remaining / greatest(1, r.turn_seconds))::int;   -- the artist's share
      update games.players set score = score + pts, guessed_turn = r.turn_id where room_code = r.code and user_id = u;
      update games.players set score = score + rnk where room_code = r.code and user_id = r.drawer_id;
      insert into games.pp_firsts(turn_id, match_id, guesser_id, drawer_id) values (r.turn_id, r.match_id, u, r.drawer_id) on conflict do nothing;
      perform games.sys(r.code, me.nick || ' got it first! (+' || pts || ', artist +' || rnk || ')', 'correct');
      perform games.end_turn(r.code);
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

-- PEPaint top list. p_period: 'week' (since Monday 00:00 UTC) | 'last' (the week before) | 'all'.
-- The list shows Discord accounts only (guests play, but a guest name can be anyone). 'me' = the caller's row in this
-- period, 'mine' = the caller's own numbers from all their counted games (guests see theirs too, on this device).
create or replace function public.gry_pp_top(p_period text default 'week') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); wk timestamptz := date_trunc('week', now() at time zone 'utc') at time zone 'utc';
        f timestamptz; t timestamptz; v_rows jsonb; v_me jsonb; v_mine jsonb;
begin
  if p_period = 'last' then f := wk - interval '7 days'; t := wk;
  elsif p_period = 'all' then f := '-infinity'; t := 'infinity';
  else p_period := 'week'; f := wk; t := 'infinity'; end if;
  with agg as (
    select r.user_id, sum(r.points)::int points, count(*)::int games, (count(*) filter (where r.place = 1))::int wins,
           sum(r.firsts)::int firsts, sum(r.drawn)::int drawn, max(r.finished_at) last_at,
           (array_agg(r.nick order by r.finished_at desc))[1] nick
      from games.pp_results r where r.verified and r.finished_at >= f and r.finished_at < t group by r.user_id),
  ranked as (
    select a.user_id, jsonb_build_object('place', rank() over (order by a.points desc, a.wins desc, a.last_at asc),
             'nick', coalesce(pr.nick, a.nick), 'points', a.points, 'games', a.games, 'wins', a.wins,
             'firsts', a.firsts, 'drawn', a.drawn, 'me', a.user_id = u) x
      from agg a left join games.profiles pr on pr.user_id = a.user_id)
  select coalesce(jsonb_agg(x order by (x->>'place')::int, x->>'nick') filter (where (x->>'place')::int <= 50), '[]'::jsonb),
         (jsonb_agg(x) filter (where user_id = u))->0
    into v_rows, v_me from ranked;
  select jsonb_build_object('games', count(*), 'wins', count(*) filter (where r.place = 1), 'points', coalesce(sum(r.points), 0),
           'firsts', coalesce(sum(r.firsts), 0), 'drawn', coalesce(sum(r.drawn), 0), 'best', coalesce(max(r.points), 0))
    into v_mine from games.pp_results r where u is not null and r.user_id = u;
  return jsonb_build_object('period', p_period, 'week_start', wk, 'week_end', wk + interval '7 days',
    'verified', u is not null and games.discord_identity(u) is not null, 'rows', v_rows, 'me', v_me, 'mine', v_mine);
end $$;
revoke all on function public.gry_pp_top(text) from public;
grant execute on function public.gry_pp_top(text) to anon, authenticated;
