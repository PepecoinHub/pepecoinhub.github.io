# Launch day: Fren Passport + Create Your Fren + Pepe Guesser Hall of Fame (PepeGochi later)

Everything ships from the release PR (`claude/launch-release` → `main`): the launch branch (#236, with #253), `main`,
#251, #246, #258 and the notice fix. **Nothing is public until that PR is merged** (the site is published from `main` only).
PepeGochi launches after the Passport (owner, 2026-11-09): it stays behind `?beta=gochi` and its SQL waits.

## On the owner's command, in this order
1. Supabase > SQL Editor: `games/supabase/deploy/00_check.sql` (read only).
2. Supabase > SQL Editor: `games/supabase/deploy/LAUNCH_ALL.sql` (13 files, one transaction: all or nothing).
   The first run of `update_passport_awards.sql` inside it is the launch moment (Pond Pioneer snapshot; the Hall of
   Fame starts the first Monday on or after it).
3. `00_check.sql` again: every row `done`, the last row shows the launch time.
4. Claude merges the release PR into `main`. The Passport and Create Your Fren are on for everyone (`FREN = true`);
   `?beta=fren` only gives testers the local preview fallback; `?beta=fren-test` stays the owner sandbox.
5. Live checks: log on with Discord → the Passport opens, First Fren and Pond Pioneer are there, the reward dialog
   shows on top of every window; Create Your Fren saves (Fresh Fren); C:\Pond\Pepe Guesser has Hall of Fame;
   LAN Party shows who is online; a guest sees "Log on with Discord" in the Passport.

If step 2 fails, nothing was applied: send the red message to Claude. Do not merge before step 3 is all `done`.

## Later
- PepeGochi day: `deploy/RUN_ORDER.md` ("Later: PepeGochi day").
- BALI: the owner opens it on the day PEP reaches $0.01 (Frog Mail → 🏝 PEP hit $0.01? Open BALI…).
- Optional: Supabase > Database > Extensions > `pg_cron`, then run `update_wheres_pepe_hall_of_fame.sql` again.
