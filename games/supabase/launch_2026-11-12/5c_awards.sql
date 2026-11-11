-- update_passport_awards.sql, part 3 of 4 (run after 5b)
begin;
-- ---------- daily rules, run by the check-in (once a visit) ----------
-- Pepe Guesser points of one player in a date range (verified plays only), and the same for a whole board
create or replace function games.passport_daily(u uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  wk date := (date_trunc('week', (now() at time zone 'utc'))::date) - 7;   -- last finished Monday-Sunday week
  joined timestamptz;
  games_played integer := 0;
  mine numeric;
  se jsonb := games.season_at(now());
  cur integer := (se->>'no')::int;
  w record;
  sn integer;
  tg date;
  st timestamptz := games.passport_start();
  sd date := games.passport_start_day();
begin
  if not games.passport_open() then return; end if;
  -- Certified Fren: 100 different UTC days
  if (select count(*) from games.passport_days where user_id = u) >= 100 then perform games.passport_award(u, 'certified_fren'); end if;
  -- Old Frog: one year since the first Discord log-on (the Discord identity's creation time)
  select min(coalesce((to_jsonb(i)->>'created_at')::timestamptz, au.created_at)) into joined
    from auth.identities i join auth.users au on au.id = i.user_id where i.user_id = u and i.provider = 'discord';
  if joined is not null and joined <= now() - interval '365 days' then perform games.passport_award(u, 'old_frog'); end if;
  -- BALI: the owner opened it (gry_passport_bali), so every fren gets it on the next visit
  if exists (select 1 from games.passport_meta m where m.k = 'bali_open') then perform games.passport_award(u, 'bali'); end if;
  -- Event days for every fren who visits (each unlocks a special avatar, not a stamp):
  -- Pepecoin's birthday, 30 January (UTC 30-31, so every time zone has its 30th), and US Thanksgiving,
  -- the fourth Thursday of November, through that Sunday
  if extract(month from today) = 1 and extract(day from today) between 30 and 31 then
    insert into games.passport_secrets (user_id, secret_id) values (u, 'pep_birthday') on conflict (user_id, secret_id) do nothing;
  end if;
  tg := make_date(extract(year from today)::int, 11, 1);
  tg := tg + ((4 - extract(dow from tg)::int + 7) % 7) + 21;
  if today between tg and tg + 3 then
    insert into games.passport_secrets (user_id, secret_id) values (u, 'thanksgiving_fren') on conflict (user_id, secret_id) do nothing;
  end if;
  -- Frogmas: a visit on 24, 25 or 26 December (UTC)
  if extract(month from today) = 12 and extract(day from today) between 24 and 26 then perform games.passport_award(u, 'frogmas'); end if;
  -- Arcade Hopper: a score kept by the server in 5 different games
  games_played :=
      (case when exists (select 1 from games.yeet_records y where y.user_id = u and y.best > 0 and y.achieved_at >= st)
              or exists (select 1 from games.passport_progress p where p.user_id = u and p.yeet_flights > 0) then 1 else 0 end)
    + (case when exists (select 1 from games.wp_plays x where x.user_id = u and x.verified and x.guessed_at >= st) then 1 else 0 end)
    + (case when to_regclass('games.arcade_scores') is not null
              and exists (select 1 from games.arcade_scores a where a.user_id = u and a.game = 'fud' and a.created_at >= st) then 1 else 0 end)
    + (case when to_regclass('games.arcade_scores') is not null
              and exists (select 1 from games.arcade_scores a where a.user_id = u and a.game = 'snake' and a.created_at >= st) then 1 else 0 end)
    + (case when exists (select 1 from games.miner_saves s where s.user_id = u and s.updated_at >= st) then 1 else 0 end)
    + (case when exists (select 1 from games.results r join games.matches m on m.id = r.match_id
                          where r.user_id = u and r.verified and m.mode = 'obrazek' and r.finished_at >= st) then 1 else 0 end)
    + (case when exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = 'good_game') then 1 else 0 end);
  if games_played >= 5 then perform games.passport_award(u, 'arcade_hopper'); end if;
  -- Top 10: YEET board, Pepe Guesser week board (last 7 days), Pepe Pictures season ranking
  select y.best into mine from games.yeet_records y where y.user_id = u and y.achieved_at >= st;
  if coalesce(mine, 0) > 0 and (select count(*) from games.yeet_records y where y.best > mine) < 10 then
    perform games.passport_award(u, 'top_ten');
  end if;
  select sum(x.points) into mine from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
   where x.user_id = u and x.verified and x.guessed_at is not null and q.day > today - 7 and q.day >= sd;
  if coalesce(mine, 0) > 0 and (select count(*) from (
        select x.user_id from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
         where x.guessed_at is not null and q.day > today - 7 and q.day >= sd
         group by x.user_id having sum(x.points) > mine) z) < 10 then
    perform games.passport_award(u, 'top_ten');
  end if;
  if cur is not null then
    select sum(4 - g.place) into mine from games.guesses g join games.matches m on m.id = g.match_id
     where g.user_id = u and g.verified and m.ranked and m.season_no = cur and m.mode = 'obrazek' and m.started_at >= st;
    if coalesce(mine, 0) > 0 and (select count(*) from (
          select 1 from games.guesses g join games.matches m on m.id = g.match_id
           where m.ranked and m.season_no = cur and m.mode = 'obrazek' and m.started_at >= st
           group by case when g.verified then 'u:' || g.user_id::text else 'g:' || g.nick_key end
          having sum(4 - g.place) > mine) z) < 10 then
      perform games.passport_award(u, 'top_ten');
    end if;
  end if;
  -- Frog of the Week: settle the last finished week once (Monday-Sunday, UTC). Only weeks from the season
  -- start count. A tie at the top means no winner that week (owner decision: no tie-breakers).
  if wk >= sd then
    insert into games.passport_weeks (week_start) values (wk) on conflict (week_start) do nothing;
  end if;
  if wk >= sd and found then
    for w in select z.user_id from (
        select y.user_id, y.r, count(*) over (partition by y.r) nr from (
          select x.user_id, rank() over (order by sum(x.points) desc) r
            from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
           where x.verified and x.guessed_at is not null and q.day between wk and wk + 6
           group by x.user_id) y) z
       where z.r = 1 and z.nr = 1 loop
      if games.discord_identity(w.user_id) is not null then
        insert into games.passport_badges (user_id, badge_id, earned_at, times) values (w.user_id, 'frog_of_the_week', clock_timestamp(), 1)
        on conflict (user_id, badge_id) do update set times = games.passport_badges.times + 1, earned_at = excluded.earned_at, notified_at = null;
      end if;
    end loop;
  end if;
  -- Season Champion: first place of each finished ranked Pepe Pictures season (settled once, held once)
  for sn in select distinct m.season_no from games.matches m
             where m.ranked and m.mode = 'obrazek' and m.season_no is not null
               and (m.season_no < coalesce(cur, 0) or (m.season_no = cur and se->>'phase' = 'break'))
               -- only seasons played wholly from the season start (no head starts)
               and not exists (select 1 from games.matches m0 where m0.season_no = m.season_no and m0.ranked
                                 and m0.mode = 'obrazek' and m0.started_at < st)
               and not exists (select 1 from games.passport_seasons p where p.season_no = m.season_no) loop
    insert into games.passport_seasons (season_no) values (sn) on conflict (season_no) do nothing;
    if found then
      for w in select z.uid from (
          select (array_agg(g.user_id))[1] uid, bool_or(g.verified) ver,
                 rank() over (order by sum(4 - g.place) desc, count(*) filter (where g.place = 1) desc,
                                       count(*) filter (where g.place = 2) desc, max(g.at) asc) r
            from games.guesses g join games.matches m on m.id = g.match_id
           where m.ranked and m.mode = 'obrazek' and m.season_no = sn
           group by case when g.verified then 'u:' || g.user_id::text else 'g:' || g.nick_key end) z
         where z.r = 1 and z.ver loop
        perform games.passport_award(w.uid, 'season_champion');
      end loop;
    end if;
  end loop;
end
$$;
revoke all on function games.passport_daily(uuid) from public, anon, authenticated;

create or replace function public.gry_passport_checkin()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  n integer;
  fresh jsonb;
begin
  if u is null or games.discord_identity(u) is null then
    return jsonb_build_object('signed_in', false);
  end if;
  if not games.passport_open() then
    -- public beta: Pond Pioneer for every Discord fren who opens PondOS. Nothing else is counted yet.
    perform games.passport_award(u, 'pond_pioneer');
  else
  insert into games.passport_days (user_id, day) values (u, today) on conflict (user_id, day) do nothing;
  if found then
    -- Welcome Back!: the first visit was yesterday, and this is the second one
    if (select count(*) from games.passport_days where user_id = u) = 2
       and exists (select 1 from games.passport_days where user_id = u and day = today - 1) then
      perform games.passport_award(u, 'welcome_back');
    end if;
    -- days are unique, so 14 rows in the last 14 days are 14 days in a row (and 30 in 30)
    select count(*) into n from games.passport_days where user_id = u and day > today - 14;
    if n >= 14 then perform games.passport_award(u, 'streak_14'); end if;
    select count(*) into n from games.passport_days where user_id = u and day > today - 30;
    if n >= 30 then perform games.passport_award(u, 'like_it_here'); end if;
  end if;
  -- the daily rules (Certified Fren, Old Frog, BALI, Frogmas, Arcade Hopper, Top 10, Frog of the Week, Season Champion)
  begin
    perform games.passport_daily(u);
  exception when others then
    raise warning 'passport daily hook: %', sqlerrm;
  end;
  end if;
  -- Fresh Fren has its own notice in the Avatar Maker
  with shown as (
    update games.passport_badges b set notified_at = clock_timestamp()
     where b.user_id = u and b.notified_at is null and b.badge_id <> 'first_avatar'
    returning b.badge_id, b.earned_at)
  select coalesce(jsonb_agg(jsonb_build_object('id', badge_id, 'earned_at', earned_at) order by earned_at), '[]'::jsonb)
    into fresh from shown;
  return jsonb_build_object('signed_in', true, 'new_badges', fresh);
end
$$;
revoke all on function public.gry_passport_checkin() from public, anon, authenticated;
grant execute on function public.gry_passport_checkin() to authenticated;

-- ---------- Passport read path ----------
-- The newest definition (update_fren_avatar.sql had the previous one). Changes: Moonwalker is a stored
-- stamp now, and 'progress' carries the server's own counters for the Next Milestone bar.
create or replace function public.gry_passport_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb;
  joined timestamptz;
  best_distance integer := 0;
  extra_badges jsonb;
  discovered jsonb;
  owned_items jsonb;
  earned_count integer;
  badge_catalog jsonb;
  look jsonb;
  pr games.passport_progress%rowtype;
  login_streak integer := 0;
  day0 date := (now() at time zone 'utc')::date;
  progress jsonb;
begin
  -- Anonymous Supabase users also have auth.uid(). Require Discord specifically.
  if u is null then
    return jsonb_build_object('signed_in', false);
  end if;
  d := games.discord_identity(u);
  if d is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select au.created_at into joined
    from auth.users au where au.id = u;

  select coalesce(y.best, 0) into best_distance
    from games.yeet_records y where y.user_id = u;
  best_distance := coalesce(best_distance, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.badge_id,
           'title', case b.badge_id when 'first_avatar' then 'Fresh Fren' else b.badge_id end,
           'description', 'Awarded by a PepecoinHub game',
           'earned_at', b.earned_at, 'times', b.times) order by b.earned_at), '[]'::jsonb)
    into extra_badges
    from games.passport_badges b where b.user_id = u and b.badge_id <> 'certified_fren';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.secret_id, 'discovered_at', s.discovered_at)
           order by s.discovered_at), '[]'::jsonb)
    into discovered
    from games.passport_secrets s where s.user_id = u;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.item_id, 'quantity', i.quantity, 'earned_at', i.earned_at)
           order by i.earned_at), '[]'::jsonb)
    into owned_items
    from games.passport_items i where i.user_id = u;

  select jsonb_build_object('schema_version', a.schema_version,
           'bg', a.bg, 'clothing', a.clothing,
           'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'accessory', a.accessory, 'special', a.special)
    into look
    from games.passport_avatars a where a.user_id = u;

  select * into pr from games.passport_progress p where p.user_id = u;
  -- current run of PondOS days, ending today (or yesterday, before today's first visit)
  if not exists (select 1 from games.passport_days x where x.user_id = u and x.day = day0) then day0 := day0 - 1; end if;
  while login_streak < 400 and exists (select 1 from games.passport_days x where x.user_id = u and x.day = day0 - login_streak) loop
    login_streak := login_streak + 1;
  end loop;
  progress := jsonb_build_object(
    'yeet_5k_flights', (select count(*) from games.passport_yeet_5k f where f.user_id = u),
    'yeet_5k_total', coalesce(pr.yeet_5k_total, 0),
    'login_days', (select count(*) from games.passport_days x where x.user_id = u),
    'letters', coalesce(pr.letters, 0),
    'miner_minutes', coalesce(pr.miner_seconds, 0) / 60,
    'chat_days', (select count(*) from games.passport_chat_days c where c.user_id = u),
    'login_streak', login_streak,
    'wp_days', (select count(*) from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                 where x.user_id = u and x.verified and x.g_lat is not null and q.day >= games.passport_start_day()),
    'wp_perfect_days', (select count(*) from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id
                 where x.user_id = u and x.verified and x.g_lat is not null and x.points = 5000 and q.day >= games.passport_start_day()),
    'wp_streak', games.passport_wp_streak(u));

  badge_catalog := jsonb_build_array(
    jsonb_build_object('id', 'first_fren', 'title', 'First Fren',
      'description', 'Joined the pond with Discord.',
      'earned_at', case when games.passport_open() then greatest(joined, games.passport_start()) end),
    jsonb_build_object('id', 'certified_fren', 'title', 'Certified Fren',
      'description', '100 distinct days of signed-in PondOS activity.',
      'earned_at', (select b.earned_at from games.passport_badges b
                    where b.user_id = u and b.badge_id = 'certified_fren'))
  );
  select count(*) into earned_count from jsonb_array_elements(badge_catalog) x
    where x->>'earned_at' is not null;
  earned_count := earned_count + jsonb_array_length(extra_badges);

  return jsonb_build_object(
    'signed_in', true,
    'nickname', coalesce(nullif(d->>'name', ''), 'Discord fren'),
    'member_since', joined,
    'yeet_best', best_distance,
    'achievements', badge_catalog || extra_badges,
    'achievements_earned', earned_count,
    'secrets', discovered,
    'items', owned_items,
    'avatar', look,
    'progress', progress,
    'care_days', null
  );
end
$$;
revoke all on function public.gry_passport_state() from public, anon, authenticated;
grant execute on function public.gry_passport_state() to authenticated;

-- internal helpers: never callable by the browser
revoke all on function games.passport_award(uuid, text, timestamptz), games.passport_yeet_flight(uuid, integer),
  games.passport_wp_check(uuid), games.passport_wp_streak(uuid), games.passport_wp_after(),
  games.passport_chat_after(), games.passport_mention_after(), games.passport_letter_after(),
  games.passport_miner_after() from public, anon, authenticated;

commit;
