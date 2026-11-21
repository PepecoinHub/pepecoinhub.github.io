-- Stops only the new community integration and revokes its limited sessions.
-- Existing PH chat, games, wallet links and legacy tips remain unchanged.
begin;
update games.community_settings set enabled=false where id;
update games.community_sessions set revoked_at=clock_timestamp() where revoked_at is null;
commit;
