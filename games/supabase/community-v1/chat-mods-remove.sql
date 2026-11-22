-- Remove a chat moderator. Change the name (as in chat-mods-add.sql), then Run. Takes effect on their next chat refresh.
delete from games.chat_mods where lower(label) = lower('Lemon');
select label as moderator, added_at from games.chat_mods order by added_at;
