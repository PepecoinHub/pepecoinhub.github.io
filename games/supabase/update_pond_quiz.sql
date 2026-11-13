-- Pond Quiz: PepeGochi's fact of the day with points (owner idea, 2026-11-13).
--
-- DRAFT. Not applied anywhere. Test on a local database only (tests/pond-quiz-sql.test.mjs).
-- Do NOT run in the production SQL editor without the owner's explicit approval.
--
-- Rules:
--  * Discord accounts only. One question a UTC day per account, picked by the server from that account's own pool.
--  * A right answer: +1 point, and the question leaves that account's pool for good.
--  * A wrong answer: no point, the question stays in the pool and comes back on another day.
--  * The right answer and the order of the answers live only on the server: the browser sends one number (0-3),
--    once a day. Answering again the same day changes nothing.
--  * The ranking shows the top 10 by points (a tie goes to whoever got there first) and the caller's own place.
--  * No stamps yet: the thresholds come after the owner has checked the questions.
--  * Only after the account's PepeGochi has hatched from its egg (the 'hatched' milestone, any frog so far).
--  * The questions and answers are NOT in the public repo: they are loaded from a private file with
--    scripts/build_pond_quiz_sql.mjs (games/supabase/private/update_pond_quiz_questions.sql, git-ignored), and the
--    browser only ever gets today's question from these RPCs.
--
-- Dependency: PH-games schema.sql (games.discord_identity) and update_pepegochi_v2.sql (games.pepegochi_milestones).
-- Then the private update_pond_quiz_questions.sql (the questions).
-- Safe to run twice.
begin;

create table if not exists games.quiz_questions (
  id         text primary key,
  question   text not null,
  answers    text[] not null check (cardinality(answers) = 4),
  correct    smallint not null check (correct between 0 and 3),
  source     text,
  active     boolean not null default true
);

create table if not exists games.quiz_players (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  points         integer not null default 0,
  answered       integer not null default 0,
  day            date,                                   -- the UTC day of the current question
  question_id    text references games.quiz_questions(id),
  perm           smallint[],                             -- shown answer i = answers[perm[i] + 1]
  picked         smallint,                               -- shown index picked today, null = not answered yet
  last_point_at  timestamptz,                            -- ranking tie-break: who reached the score first
  created_at     timestamptz not null default now()
);

create table if not exists games.quiz_solved (
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_id  text not null references games.quiz_questions(id),
  solved_at    timestamptz not null,
  primary key (user_id, question_id)
);

alter table games.quiz_questions enable row level security;
alter table games.quiz_players enable row level security;
alter table games.quiz_solved enable row level security;
revoke all on games.quiz_questions, games.quiz_players, games.quiz_solved from public, anon, authenticated;

create index if not exists quiz_players_board on games.quiz_players (points desc, last_point_at) where points > 0;

-- the server's time (tests replace this function with a virtual clock)
create or replace function games.quiz_clock()
returns timestamptz language sql volatile set search_path = '' as $$
  select clock_timestamp()
$$;

-- What the browser sees: the question and its answers in today's order. The right answer and the source only after
-- the account has answered.
create or replace function games.quiz_view(u uuid, today date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p games.quiz_players%rowtype;
  q games.quiz_questions%rowtype;
  left_count integer;
begin
  select * into p from games.quiz_players where user_id = u;
  select count(*) into left_count from games.quiz_questions x
    where x.active and not exists (select 1 from games.quiz_solved s where s.user_id = u and s.question_id = x.id);
  if p.user_id is null or p.day is distinct from today or p.question_id is null then
    return jsonb_build_object('day', today, 'question', null, 'done', left_count = 0,
      'points', coalesce(p.points, 0), 'answered_total', coalesce(p.answered, 0), 'left', left_count);
  end if;
  select * into q from games.quiz_questions where id = p.question_id;
  return jsonb_build_object(
    'day', today, 'id', q.id, 'question', q.question,
    'answers', (select jsonb_agg(q.answers[p.perm[i] + 1] order by i) from generate_series(1, 4) i),
    'answered', p.picked is not null, 'picked', p.picked,
    'correct', case when p.picked is not null then (select i - 1 from generate_series(1, 4) i where p.perm[i] = q.correct) end,
    'right', case when p.picked is not null then p.perm[p.picked + 1] = q.correct end,
    'source', case when p.picked is not null then q.source end,
    'done', false, 'points', p.points, 'answered_total', p.answered, 'left', left_count);
end
$$;

-- Discord account whose PepeGochi has hatched; otherwise the call stops with a clear message.
create or replace function games.quiz_check(u uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  if not exists (select 1 from games.pepegochi_milestones m where m.user_id = u and m.milestone = 'hatched') then
    raise exception 'Hatch your PepeGochi first' using errcode = 'P0001';
  end if;
end
$$;

revoke all on function games.quiz_clock(), games.quiz_view(uuid, date), games.quiz_check(uuid) from public, anon, authenticated;

-- ---------- browser RPCs ----------

-- Today's question for the signed-in Discord account. The first call of a UTC day picks it: a random active question
-- the account has not answered right yet, not yesterday's when there is another choice.
create or replace function public.gry_quiz_today()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  today date;
  p games.quiz_players%rowtype;
  pick text;
begin
  perform games.quiz_check(u);
  today := (games.quiz_clock() at time zone 'UTC')::date;
  insert into games.quiz_players (user_id) values (u) on conflict (user_id) do nothing;
  select * into p from games.quiz_players where user_id = u for update;
  -- a new day, or no question yet today (the pool was empty, then new questions were added)
  if p.day is distinct from today or p.question_id is null then
    select x.id into pick from games.quiz_questions x
      where x.active and not exists (select 1 from games.quiz_solved s where s.user_id = u and s.question_id = x.id)
      order by (x.id = p.question_id), random() limit 1;
    update games.quiz_players set day = today, question_id = pick, picked = null,
      perm = (select array_agg(n::smallint order by random()) from generate_series(0, 3) n)
      where user_id = u;
  end if;
  return games.quiz_view(u, today);
end
$$;

-- The answer to today's question: p_choice is the index of the answer as shown (0-3). Once a day; later calls return
-- the same result and change nothing.
create or replace function public.gry_quiz_answer(p_choice integer)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  t timestamptz;
  today date;
  p games.quiz_players%rowtype;
  q games.quiz_questions%rowtype;
  is_right boolean;
begin
  perform games.quiz_check(u);
  if p_choice is null or p_choice < 0 or p_choice > 3 then
    raise exception 'Pick one of the four answers' using errcode = '22023';
  end if;
  t := games.quiz_clock();
  today := (t at time zone 'UTC')::date;
  select * into p from games.quiz_players where user_id = u for update;
  if p.user_id is null or p.day is distinct from today or p.question_id is null then
    raise exception 'Open today''s question first' using errcode = 'P0001';
  end if;
  if p.picked is not null then return games.quiz_view(u, today); end if;
  select * into q from games.quiz_questions where id = p.question_id;
  is_right := p.perm[p_choice + 1] = q.correct;
  update games.quiz_players set picked = p_choice, answered = answered + 1,
    points = points + case when is_right then 1 else 0 end,
    last_point_at = case when is_right then t else last_point_at end
    where user_id = u;
  if is_right then
    insert into games.quiz_solved (user_id, question_id, solved_at) values (u, q.id, t) on conflict do nothing;
  end if;
  return games.quiz_view(u, today);
end
$$;

-- The ranking: top 10 by points (ties: who got there first), Discord names only, and the caller's own place.
create or replace function public.gry_quiz_board()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  me jsonb := null;
begin
  if u is not null and games.discord_identity(u) is not null then
    select jsonb_build_object('points', p.points, 'rank', case when p.points > 0 then 1 + (
        select count(*) from games.quiz_players o
        where o.points > p.points or (o.points = p.points and o.last_point_at < p.last_point_at)) end)
      into me from games.quiz_players p where p.user_id = u;
  end if;
  return jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', r.rank, 'nick', r.nick, 'points', r.points) order by r.rank)
      from (select row_number() over (order by p.points desc, p.last_point_at) rank, p.points,
                   left(coalesce(games.discord_identity(p.user_id)->>'name', 'Discord fren'), 32) nick
            from games.quiz_players p
            where p.points > 0 and games.discord_identity(p.user_id) is not null
            order by p.points desc, p.last_point_at limit 10) r), '[]'::jsonb),
    'me', me);
end
$$;

revoke all on function public.gry_quiz_today(), public.gry_quiz_answer(integer), public.gry_quiz_board()
  from public, anon, authenticated;
grant execute on function public.gry_quiz_today(), public.gry_quiz_answer(integer) to authenticated;
grant execute on function public.gry_quiz_board() to anon, authenticated;

commit;
