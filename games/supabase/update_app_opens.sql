-- Pepecoin Hub: what people use in PondOS, without tracking anyone. Run ONCE in Supabase → SQL Editor
-- (New query → paste all → Run). Safe to run again. If Supabase shows "Potential issues detected",
-- pick "Run and enable RLS". Needs update_page_stats.sql (games.owners, games.is_owner) to be run first.
--
--  • PondOS adds +1 for an app when a window opens (once per app per page load), plus 'desktop' once per visit.
--    Stored: day + app name + count. No IP, no user ID, no cookie, no random browser number.
--  • games.usage_report(days): what people did, counted from the game tables we already have.
--  • The owner sees both on games/stats.html (gry_usage). Hosts do not.
--
-- Quick report in the SQL Editor after running this file:
--   select * from games.usage_report(30) order by day desc, feature;
--   select app, sum(opens) from games.app_daily where day > current_date - 30 group by app order by 2 desc;

create table if not exists games.app_daily (            -- per day (Polish time) and app: how many times it was opened
  day date not null,
  app text not null,
  opens int not null default 0,
  primary key (day, app)
);
alter table games.app_daily enable row level security;  -- no policies: only the functions below touch it

-- One window opened. Called by PondOS for everyone (guests too), so it is careful:
-- a short lowercase name only, and at most 120 different names per day (a spammer cannot fill the table).
create or replace function public.gry_open(p_app text) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; a text := lower(trim(coalesce(p_app, '')));
begin
  if a !~ '^[a-z0-9][a-z0-9-]{0,31}$' then return; end if;
  update games.app_daily set opens = opens + 1 where day = d and app = a;
  if found then return; end if;
  if (select count(*) from games.app_daily where day = d) >= 120 then return; end if;
  insert into games.app_daily(day, app, opens) values (d, a, 1)
  on conflict (day, app) do update set opens = games.app_daily.opens + 1;
end $$;

-- What people did, per day and feature, from the tables that already exist.
-- actions / people mean a different thing per feature (see the 'note' column).
-- Some tables keep only recent rows (chat: 24 h, arcade: top 300, board tables: until closed),
-- so their history is short; the 'note' says so. Tables that are not there yet are skipped.
create or replace function games.usage_report(p_days int default 30)
returns table(day date, feature text, actions bigint, people bigint, note text)
language plpgsql stable security definer set search_path = '' as $$
declare n int := least(greatest(coalesce(p_days, 30), 1), 400);
        since timestamptz := ((now() at time zone 'Europe/Warsaw')::date - (n - 1))::timestamp at time zone 'Europe/Warsaw';
begin
  if to_regclass('games.wp_plays') is not null then
    return query select (p.started_at at time zone 'Europe/Warsaw')::date, 'Pepe Guesser'::text,
      count(p.guessed_at), count(distinct p.user_id), 'guesses sent / players who opened the photo'::text
      from games.wp_plays p where p.started_at >= since group by 1;
  end if;
  if to_regclass('games.pp_results') is not null then
    return query select (r.finished_at at time zone 'Europe/Warsaw')::date, 'PEPaint'::text,
      count(distinct r.match_id), count(distinct r.user_id), 'finished games / players (since 9 Nov)'::text
      from games.pp_results r where r.finished_at >= since group by 1;
  end if;
  if to_regclass('games.results') is not null and to_regclass('games.matches') is not null then
    return query select (r.finished_at at time zone 'Europe/Warsaw')::date, 'Pepe Pictures'::text,
      count(distinct r.match_id), count(distinct r.user_id), 'finished games / players'::text
      from games.results r join games.matches m on m.id = r.match_id
      where m.mode = 'obrazek' and r.finished_at >= since group by 1;
  end if;
  if to_regclass('games.lobby_chat') is not null then
    return query select (c.created_at at time zone 'Europe/Warsaw')::date, 'LAN Party chat'::text,
      count(*), count(distinct c.user_id), 'messages / people (chat keeps only 24 h)'::text
      from games.lobby_chat c where c.created_at >= since group by 1;
  end if;
  if to_regclass('games.tables') is not null then
    return query select (t.created_at at time zone 'Europe/Warsaw')::date, 'Board games: ' || t.game,
      count(distinct t.code), count(distinct x.u), 'tables / players (closed tables are deleted after 1 h)'::text
      from games.tables t left join lateral (values (t.p1), (t.p2)) x(u) on true
      where t.created_at >= since group by 1, 2;
  end if;
  if to_regclass('games.arcade_scores') is not null then
    return query select (s.created_at at time zone 'Europe/Warsaw')::date,
      case s.game when 'fud' then 'FUD Invaders' else 'PEP Snake' end,
      count(*), count(distinct coalesce(s.user_id::text, s.ip_hash, s.nick)), 'saved scores / players (only the top 300 are kept)'::text
      from games.arcade_scores s where s.created_at >= since group by 1, 2;
  end if;
  if to_regclass('games.yeet_records') is not null then
    return query select (y.last_attempt_at at time zone 'Europe/Warsaw')::date, 'YEET THE PEP'::text,
      null::bigint, count(*), 'Discord players by their LAST throw day'::text
      from games.yeet_records y where y.last_attempt_at >= since group by 1;
  end if;
  if to_regclass('games.miner_saves') is not null then
    return query select (m.updated_at at time zone 'Europe/Warsaw')::date, 'Pepe Miner (cloud save)'::text,
      null::bigint, count(*), 'Discord players by their LAST save day'::text
      from games.miner_saves m where m.updated_at >= since group by 1;
  end if;
  if to_regclass('games.letters') is not null then
    return query select (l.created_at at time zone 'Europe/Warsaw')::date, 'Letters to the Editor'::text,
      count(*), count(distinct l.user_id), 'letters / writers'::text
      from games.letters l where l.created_at >= since group by 1;
  end if;
  if to_regclass('games.poll_votes') is not null then
    return query select (v.voted_at at time zone 'Europe/Warsaw')::date, 'Pond Poll'::text,
      count(*), count(distinct v.user_id), 'votes / voters'::text
      from games.poll_votes v where v.voted_at >= since group by 1;
  end if;
  if to_regclass('games.passport_days') is not null then
    return query select p.day, 'Fren Passport'::text,
      null::bigint, count(distinct p.user_id), 'passport holders active that day'::text
      from games.passport_days p where p.day >= (since at time zone 'Europe/Warsaw')::date group by 1;
  end if;
end $$;

-- For the owner's statistics page: window opens per day and app + the report above.
create or replace function public.gry_usage(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; n int := least(greatest(coalesce(p_days, 30), 1), 400);
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can see the statistics'; end if;
  return jsonb_build_object(
    'today', d,
    'opens', coalesce((select jsonb_agg(jsonb_build_object('day', a.day, 'app', a.app, 'opens', a.opens) order by a.day, a.app)
                       from games.app_daily a where a.day > d - n), '[]'::jsonb),
    'report', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'feature', r.feature, 'actions', r.actions, 'people', r.people, 'note', r.note)
                                         order by r.day, r.feature)
                        from games.usage_report(n) r), '[]'::jsonb));
end $$;

revoke all on function games.usage_report(int) from public, anon, authenticated;
revoke all on function public.gry_open(text), public.gry_usage(int) from public, anon;
grant execute on function public.gry_open(text) to anon, authenticated;
grant execute on function public.gry_usage(int) to authenticated;
