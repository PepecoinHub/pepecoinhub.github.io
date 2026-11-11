# Pepe Guesser: weekly ranking, Days at #1, Longest Guessing Streak, Pond Dominator, Hall of Fame

SQL: `games/supabase/update_wheres_pepe_hall_of_fame.sql`. Client: `docs/meme/meme.js` (`wpHallOfFame`, `wpStats`, the
Passport Journey panel and Stats tab). Tests: `tests/wp-hall-of-fame-sql.test.mjs` (PostgreSQL), `tests/wp-hall-of-fame.test.mjs`.

## Rules
- **Week:** Monday 00:00 UTC to Sunday 23:59:59 UTC. The live board (`gry_wp_top('week')`, the "This week" tab) counts
  this week only. Nothing about guessing or scoring changed: a day still gives at most 5000 points.
- **Official plays:** Discord-verified, finished (`guessed_at`), not the host (the host approves the photos). Guests
  stay on the live board, as before, but never in the settlement (they have no Passport).
- **Days at #1:** at the end of every UTC day the player with the most points since Monday gets +1, if exactly one
  player has the most (and more than 0). A tie at the top: nobody. Lifetime count, never reset.
- **Weekly Champion:** the Sunday leader, the same rule. A tie on Sunday: no winner ("No Winner - Tie"). The winner
  gets one more Frog of the Week (the existing, repeatable stamp). No new champion stamp.
- **Pond Dominator** (`pond_dominator`): the week's winner was the only leader at the end of all seven days. Once per
  account. Points do not matter (no 35,000 or 5000-a-day rule). No Perfect Week.
- **Longest Guessing Streak:** the longest run of UTC days with a Discord-verified play with a pin, the same rule as
  the Passport's current streak (`passport_wp_streak`). Worked out from the plays, so it stays when a streak breaks.
  Existing streak stamps (Week Scout, Scout Fren) are unchanged.

## Settlement
`games.wp_settle()` closes finished days (`games.wp_days`, key: the day) and weeks (`games.wp_weeks`, key: the Monday)
from `games.config.wp_hof_start`, oldest first, under an advisory lock. Rows are inserted "on conflict do nothing" and
stamps are given only by the call that inserted the week, so running it again never pays twice. Pond Dominator is
given from `wp_weeks.dominator` by `games.wp_dominator_stamps()` (`passport_award`, once per account).

It runs: every night at 00:01 UTC through pg_cron (when the extension is on), on every Passport check-in
(`passport_daily`), and on every Hall of Fame / stats read. A late run gives the same answer: a day's points are fixed
once its puzzle is over.

**No history is rebuilt.** The first run of the file sets `wp_hof_start` to the next Monday. To start with the current
week instead, before that week's first day is settled: `update games.config set wp_hof_start = '<that Monday>' where id = 1;`
Weeks before the start keep the old Frog of the Week rule in `passport_daily` (every tied first place won).

## Reads
- `gry_wp_hof(p_limit)` (anyone): the last 52 settled weeks and three separate all-time boards (weeks won, Days at #1,
  longest streak). Nick and saved Fren avatar only; the user id that opens a Passport goes only to Discord frens.
- `gry_wp_stats(p_user)` (Discord frens): Days at #1, weeks won, longest streak of yourself or another Discord fren.
- Names in the Hall of Fame open the existing read-only Passport (`gry_passport_public`), behind the Passport beta flag.

## Run order (owner)
1. `update_wheres_pepe_hall_of_fame.sql` (after the Pepe Guesser and Passport files; if PR #251's
   `update_wheres_pepe_hide_host.sql` runs later, run this one again: both replace `gry_wp_top`).
2. `update_passport_awards.sql` again (the `pond_dominator` allowlist entry and the `passport_daily` hand-over).
   Do this within the first Hall of Fame week.
3. Optional: Database > Extensions > `pg_cron`, then run step 1 again to add the nightly job.

## Art (owner)
- Pond Dominator stamp: source `games/fren-passport/source/stamps-new/pond_dominator.png`, shipped as
  `docs/meme/passport-assets/pond-dominator.webp` (138 × 150, like a V3 tile). A new version: replace both files and
  bump `?v=` on `.is-dominator` in `passport.css`.
- Hall of Fame icon (gold cup + open Pepe passport): put it at `docs/meme/img/ico/hall-of-fame.webp` (square, 64 × 64
  like the other icons) and change `HOF_ICON` in `meme.js` to `'img/ico/hall-of-fame.webp'`. Until then the LEADERS
  trophy stands in.
