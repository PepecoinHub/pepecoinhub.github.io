-- What chat moderators did, newest first (deletes and mutes). Read-only, safe to run any time.
select at, mod_nick, action, target_nick, body from games.mod_log order by at desc limit 100;
