# Launch day: Fren Passport + Create Your Fren + Pepe Guesser Hall of Fame (PepeGochi later)

Everything ships from the release PR (`claude/launch-release` → `main`): the launch branch (#236, with #253), `main`,
#251, #246, #258 and the notice fix. **Nothing is public until that PR is merged** (the site is published from `main` only).
PepeGochi launches after the Passport (owner, 2026-11-09): it stays behind `?beta=gochi` and its SQL waits.

## Thursday 12 XI: the public beta (owner, 2026-11-11)
1. Supabase > SQL Editor: `games/supabase/deploy/00_check.sql` (read only).
2. Supabase > SQL Editor: `games/supabase/deploy/LAUNCH_ALL.sql` (14 files, one transaction: all or nothing).
   Its first run takes the Pond Pioneer snapshot (everyone with Discord linked right then).
3. `00_check.sql` again: every row `done`; row 100 says `BETA, opens 2026-11-16 ...`; row 101 says `2026-11-16`.
4. Merge the release PR into `main`. The Passport and Create Your Fren are on for everyone (`FREN = true`).
5. Live checks: log on with Discord → Pond Pioneer arrives (reward notice on top of every window), nothing else is
   earned; a secret shows "Secrets start counting on Monday"; Create Your Fren saves a look (no Fresh Fren yet);
   C:\Pond\Pepe Guesser has Hall of Fame (empty until the first day is settled); a guest sees "Log on with Discord".

Beta rules (games/supabase/update_passport_season.sql): until Monday 16 XI 00:00 Warsaw time the server gives only
Pond Pioneer (the snapshot + every Discord fren who opens PondOS). Secrets, visit and chat days, letters, YEET and
Miner counters and all other stamps wait. Nothing is backfilled from older records (version A).

## Monday 16 XI: the season starts by itself
No SQL to run. At 00:00 Warsaw time every stamp, secret and counter starts from zero; the Hall of Fame (Days at #1,
Weekly Champion, Pond Dominator, Longest Guessing Streak) counts from the 16 XI puzzle (UTC). Pond Pioneer closes.
Checks: `00_check.sql` row 100 says `OPEN since ...`; a secret now saves; Create Your Fren gives Fresh Fren on the
next save. The first Weekly Champion is settled on Monday 23 XI (a tie on Sunday = no winner).

If step 2 fails, nothing was applied: send the red message to Claude. Do not merge before step 3 is all `done`.

## Later
- PepeGochi day: `deploy/RUN_ORDER.md` ("Later: PepeGochi day").
- BALI: the owner opens it on the day PEP reaches $0.01 (Frog Mail → 🏝 PEP hit $0.01? Open BALI…).
- Optional: Supabase > Database > Extensions > `pg_cron`, then run `update_wheres_pepe_hall_of_fame.sql` again.
