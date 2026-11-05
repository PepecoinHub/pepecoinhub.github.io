-- Wipes all game/test data (rooms, players, scores, events, host sessions, profiles) and anonymous auth users.
-- Keeps: schema, words, badwords, host code (games.config), host_discord list.
begin;
delete from games.results;
delete from games.used_words;
delete from games.matches;
delete from games.messages;
delete from games.players;
delete from games.secrets;
delete from games.rooms;
delete from games.tables;          -- table games (cascade: members, chat)
delete from games.events;
delete from games.profiles;
delete from games.host_sessions;
delete from games.host_attempts;
delete from auth.users where is_anonymous;
delete from realtime.messages;   -- broadcast copies (Realtime also drops old daily partitions by itself)
commit;
select (select count(*) from games.results) results, (select count(*) from games.matches) matches, (select count(*) from games.rooms) rooms,
       (select count(*) from games.profiles) profiles, (select count(*) from games.events) events, (select count(*) from auth.users) auth_users,
       (select count(*) from games.words) words, (select count(*) from games.badwords) badwords, (select host_code_hash is not null from games.config) host_code_set;
