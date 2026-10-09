-- Removes ONLY data created since __SINCE__ (an e2e run). Anything older (e.g. Byl's own test session) stays.
begin;
create temp table tu on commit drop as select id from auth.users where created_at >= '__SINCE__'::timestamptz and is_anonymous;
create temp table tm on commit drop as select id from games.matches where started_at >= '__SINCE__'::timestamptz;
delete from games.results where match_id in (select id from tm);
delete from games.used_words where match_id in (select id from tm);
delete from games.matches where id in (select id from tm);
delete from games.rooms where created_at >= '__SINCE__'::timestamptz;      -- cascade: players, messages, secrets
delete from games.tables where created_at >= '__SINCE__'::timestamptz;     -- cascade: table_members, table_messages, table_fleets
delete from games.events where created_at >= '__SINCE__'::timestamptz;
delete from games.profiles where user_id in (select id from tu);
delete from games.host_sessions where user_id in (select id from tu);
delete from games.host_attempts where at >= '__SINCE__'::timestamptz;
delete from realtime.messages where inserted_at >= '__SINCE__'::timestamptz;
delete from auth.users where id in (select id from tu);
commit;
select (select count(*) from games.rooms) rooms, (select count(*) from games.matches) matches, (select count(*) from games.results) results,
       (select count(*) from games.events) events, (select count(*) from games.tables) tables, (select count(*) from games.table_messages) table_msgs, (select count(*) from games.table_fleets) table_fleets, (select count(*) from games.profiles) profiles, (select count(*) from games.host_sessions) host_sessions,
       (select count(*) from auth.users) auth_users, (select count(*) from realtime.messages) rt_messages,
       (select count(*) from games.words) words, (select count(*) from games.badwords) badwords, (select host_code_hash is not null from games.config) host_code_set;
