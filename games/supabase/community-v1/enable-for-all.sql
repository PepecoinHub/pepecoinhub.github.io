-- Haze Community: open to EVERY Discord account (no tester list). Run after update_haze_community_v1.sql.
-- Enables only the Haze web client. Mobile (haze-native) and Chrome (haze-chrome) stay off until their builds
-- are agreed (mobile should log in through an https app link, not the hazewallet:// scheme).
-- PH moderation, mutes and limits still apply to every request; users can revoke on /games/haze-community.html.
update games.community_settings set enabled = true, beta_only = false where id;
update games.community_clients set enabled = (id = 'haze-web');
-- Check: settings enabled=true, beta_only=false; only haze-web enabled.
select (select enabled from games.community_settings) as community_on,
       (select beta_only from games.community_settings) as testers_only,
       id, enabled from games.community_clients order by id;
-- Undo: run games/supabase/community-v1/disable-beta.sql (turns it off and revokes every Haze token).
