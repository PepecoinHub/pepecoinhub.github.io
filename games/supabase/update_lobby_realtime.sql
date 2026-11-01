-- Lobby chat over Supabase Realtime (PEP Games and the PondOS "LAN Party").
-- Run once in the Supabase SQL editor after update_open_chat.sql. Safe to run again.
--
-- Before: every open chat asked the database every 4 seconds whether there was anything new.
-- Now: the database rings a "doorbell" on the private Realtime channel "lobby-chat" when a message is
-- written or hidden. Open chats then ask once for what is new, and otherwise only every 60 seconds
-- (for the "online" counter, and as a backup).
--
-- The doorbell carries only the message number (or "hidden"). Nicknames, text and network hashes never
-- go out on the channel; the page still reads messages through gry_lobby_chat, with all its checks.
-- Everyone can listen (signed in or not). Nobody can ring it from a browser: there is no insert policy
-- for this topic (the existing room policy, gry_can_access, returns false for a topic with no ":").
-- Pages that are not updated yet keep working as before.

create or replace function games.lobby_chat_ring() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform realtime.send(jsonb_build_object('id', new.id), 'new', 'lobby-chat', true);
  else
    perform realtime.send('{}'::jsonb, 'hidden', 'lobby-chat', true);
  end if;
  return null;
exception when others then
  return null;   -- a Realtime hiccup must never stop a chat message from being saved
end $$;
revoke all on function games.lobby_chat_ring() from public, anon, authenticated;

drop trigger if exists lobby_chat_ring_new on games.lobby_chat;
create trigger lobby_chat_ring_new after insert on games.lobby_chat
  for each row execute function games.lobby_chat_ring();

-- one ring per hide or mute, however many messages it hides
drop trigger if exists lobby_chat_ring_hidden on games.lobby_chat;
create trigger lobby_chat_ring_hidden after update of hidden_at on games.lobby_chat
  for each statement execute function games.lobby_chat_ring();

-- listening: open to everyone, for this one topic only
drop policy if exists "gry: lobby chat doorbell" on realtime.messages;
create policy "gry: lobby chat doorbell" on realtime.messages
  for select to anon, authenticated
  using ( (select realtime.topic()) = 'lobby-chat' and realtime.messages.extension = 'broadcast' );
