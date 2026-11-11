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

**Start: the launch** (owner, 2026-11-11). `wp_hof_start` is the first Monday (UTC) on or after the first run of
`update_passport_awards.sql` (the Pond Pioneer snapshot in `games.passport_meta`), whichever file runs first. Launch on a
Monday: that Monday. Before the launch nothing is settled. **No history is rebuilt** from older weeks.
To move the start (before its first day is settled): `update games.config set wp_hof_start = '<a Monday>' where id = 1;`
Weeks before the start keep the old Frog of the Week rule in `passport_daily` (every tied first place won).

## Reads
- `gry_wp_hof(p_limit)` (anyone): the last 52 settled weeks and three separate all-time boards (weeks won, Days at #1,
  longest streak). Nick and saved Fren avatar only; the user id that opens a Passport goes only to Discord frens.
- `gry_wp_stats(p_user)` (Discord frens): Days at #1, weeks won, longest streak of yourself or another Discord fren.
- Names in the Hall of Fame open the existing read-only Passport (`gry_passport_public`), behind the Passport beta flag.

## Run order (owner)
See `games/supabase/deploy/RUN_ORDER.md` (launch kit, step 15) and `deploy/00_check.sql`.

## Art (owner)
- Pond Dominator stamp and the Hall of Fame icon: in the PondOS PR for the Hall of Fame (#258). On this branch the
  stamp is in the catalog and the server, and shows as the neutral "?" placeholder until that UI lands here.
