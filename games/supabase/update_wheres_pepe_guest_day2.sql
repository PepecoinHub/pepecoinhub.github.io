-- Where's Pepe? guest PEP rewards start on day 2 of a streak (was day 3). Safe to run again.
-- The host can also change this any time: Host tools > Payouts > "from streak day".
update games.config set wp_guest_streak = 2 where id = 1;
