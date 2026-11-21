-- Run after the existing community-v1 migration. Review before applying.
-- Prepare only the mobile client. Enable it separately after verified device testing.
begin;
update games.community_clients
set redirect_uri = 'https://hazewallet.com/app/community-auth', enabled = false
where id = 'haze-native';
delete from games.community_codes where client_id = 'haze-native';
update games.community_sessions set revoked_at = clock_timestamp()
where client_id = 'haze-native' and revoked_at is null;
commit;
