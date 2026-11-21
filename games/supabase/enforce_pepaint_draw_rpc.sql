-- Stage 2: ONLY after update_pepaint_viral_capacity.sql and the new client
-- are deployed, all old clients refreshed, and their sockets disconnected.
-- Existing Realtime authorizations can be cached until reconnect.
-- All actual drawing must use the guarded server RPC. Other topics unchanged.
begin;
drop policy if exists "PEPaint: drawing through RPC only" on realtime.messages;
create policy "PEPaint: drawing through RPC only" on realtime.messages
  as restrictive for insert to authenticated
  with check (split_part((select realtime.topic()), ':', 1) <> 'draw');
commit;

-- Rollback of stage 2 only (if necessary):
-- drop policy if exists "PEPaint: drawing through RPC only" on realtime.messages;
