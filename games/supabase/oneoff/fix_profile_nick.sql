-- Give a Discord player their name back. Change the two names below, then Run. Safe to run again.
-- (A table made from PondOS with "with a fren" sent the browser's old guest nickname and renamed the profile.)
update games.profiles set nick = 'Byl', nick_key = games.nick_key('Byl') where nick_key = games.nick_key('Test12');
