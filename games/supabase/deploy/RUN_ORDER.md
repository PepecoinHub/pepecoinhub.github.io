# Launch kit: the SQL to run, in order

For the launch of the Fren Passport, Create Your Fren (Avatar Maker), PepeGochi and the Pepe Guesser Hall of Fame,
plus the Pepe Guesser and PEPaint updates already merged into `main`. Everything is in `games/supabase/`.

**How:** Supabase > SQL Editor > New query > paste the whole file > Run. One file at a time, top to bottom.
Every file is safe to run twice. **Stop at the first error** and send it to Claude (file name + the red message).

## Step 0: what is already there (read only)
Run `deploy/00_check.sql`. It lists every file below as `done` or `missing`. Skip the `done` ones (running them again
does no harm). The last row shows whether the Passport has launched (the Pond Pioneer snapshot time).

## A. Updates already in `main` (can run any day, before the launch)
1. `update_wheres_pepe_1km.sql`: full 5000 points only within 1 km, from the 2026-11-10 puzzle.
2. `update_wheres_pepe_monday_reset.sql`: the PEP reward week resets Monday 00:00 UTC.
3. `update_wheres_pepe_paid_by_bot.sql`: "Paid" without a txid, for the Filippy tip bot.
4. `update_pepaint_first_wins.sql`: PEPaint, the first right guess wins the turn.
5. `update_pepaint_top.sql`: PEPaint top of the week (after 4).
6. `update_words_pepaint.sql`: 84 new PEPaint words.

## B. Launch day (in one go, then the release commit opens the beta flags)
7. `update_fren_passport.sql`
8. `update_fren_avatar.sql`
9. `update_passport_awards.sql`: **its first run is the launch moment**: everyone with Discord linked right then gets
   Pond Pioneer, and the Hall of Fame starts on the first Monday on or after this moment.
10. `update_passport_public.sql`: other frens' passports, read only.
11. `update_pepegochi_v2.sql`
12. `update_pepegochi_passport.sql`
13. `update_pepegochi_room_v1.sql`
14. `update_pepegochi_rewards.sql`
15. `update_wheres_pepe_hall_of_fame.sql`: Days at #1, Weekly Champion, Pond Dominator, Hall of Fame.

Then run `deploy/00_check.sql` again: all rows `done`, and the last row shows the launch time.

## Optional, after B
- Supabase > Database > Extensions > `pg_cron` on, then run step 15 again: the Hall of Fame closes each day at 00:01 UTC
  by itself. Without it, days close on the next Passport visit or Hall of Fame view (same result, a bit later).

## Not in this kit (open PRs, not decided yet)
- #251 `update_wheres_pepe_hide_host.sql` (host's score hidden). Step 15 already hides the host on the week board; if
  #251 is merged and run after step 15, run step 15 again.
- #246 `update_lobby_who.sql` (chat: who's online). #253 (Pond Pioneer V3, Share Fren as a secret) changes
  `update_passport_awards.sql`: if it is merged before the launch, step 9 is the merged file.
