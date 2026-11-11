-- Launch kit, step 0: what is already on this database? READ ONLY: it creates, changes and deletes nothing.
-- Supabase > SQL Editor > New query > paste > Run. One row per file of deploy/RUN_ORDER.md, in that order:
--   done    = this file (or a newer copy of it) has already run here: running it again is safe, but not needed
--   missing = not run yet: run it, in the order of RUN_ORDER.md
with checks(step, file, done) as (values
  (1,  'update_wheres_pepe_1km.sql',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'games' and p.proname = 'wp_finish' and p.prosrc like '%2026-11-10%')),
  (2,  'update_wheres_pepe_monday_reset.sql',
       to_regprocedure('games.wp_week_start()') is not null),
  (3,  'update_wheres_pepe_paid_by_bot.sql',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'gry_wp_host_paid' and p.prosrc like '%leave it empty%')),
  (4,  'update_wheres_pepe_hide_host.sql',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'gry_wp_count' and p.prosrc like '%is_host_user%')),
  (5,  'update_pepaint_first_wins.sql',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'gry_guess' and p.prosrc like '%50 + ceil(50 * remaining%')),
  (6,  'update_pepaint_top.sql',
       to_regclass('games.pp_results') is not null),
  (7,  'update_words_pepaint.sql',
       case when to_regclass('games.words') is null then false
            else (xpath('/row/n/text()', query_to_xml('select count(*) as n from games.words where word = ''sad frog''', false, true, '')))[1]::text::int > 0 end),
  (8,  'update_lobby_who.sql',
       to_regprocedure('public.gry_lobby_who(text)') is not null),
  (9,  'update_fren_passport.sql',
       to_regclass('games.passport_badges') is not null),
  (10, 'update_fren_avatar.sql',
       to_regclass('games.passport_avatars') is not null),
  (11, 'update_passport_awards.sql  (LAUNCH: the first run takes the Pond Pioneer snapshot)',
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'games' and p.proname = 'passport_award' and p.prosrc like '%pond_dominator%')),
  (12, 'update_passport_public.sql',
       to_regprocedure('public.gry_passport_public(uuid)') is not null),
  (13, 'update_wheres_pepe_hall_of_fame.sql',
       to_regclass('games.wp_days') is not null))
select step, file, case when done then 'done' else 'missing' end as state from checks
union all
select 99, 'Passport launch snapshot (Pond Pioneer, Hall of Fame start)',
       case when to_regclass('games.passport_meta') is null then 'not launched'
            else coalesce((xpath('/row/at/text()', query_to_xml('select at from games.passport_meta where k = ''pioneer_snapshot''', false, true, '')))[1]::text, 'not launched') end
order by step;
