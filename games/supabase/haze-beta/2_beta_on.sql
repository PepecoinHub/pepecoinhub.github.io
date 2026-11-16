-- Haze closed beta, step 2: turn the beta ON for the two testers only.
-- Before: update_haze_tips.sql and update_haze_groups.sql were run (in that order) on this project.
-- Replace the two placeholders with the user IDs from 1_find_testers.sql. The same two IDs go into the
-- Edge Function secret HAZE_ACCESS (comma-separated). Nobody else can link, tip or join rounds: the database
-- (games.haze_testers + beta_only) and the Edge Function (HAZE_ACCESS) both refuse everyone else.
begin;
insert into games.haze_testers(user_id,label) values
  ('BYL_USER_ID'::uuid,'Byl'),
  ('LEWISBONG_USER_ID'::uuid,'Lewisbong')
on conflict (user_id) do update set label=excluded.label;
update games.haze_settings set beta_only=true, enabled=true, groups_enabled=true where id;
select s.*, (select count(*) from games.haze_testers) as testers from games.haze_settings s;
commit;
