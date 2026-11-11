# Launch kit: the SQL to run, in order

For the launch of the Fren Passport, Create Your Fren (Avatar Maker), PepeGochi and the Pepe Guesser Hall of Fame,
plus the Pepe Guesser and PEPaint updates already merged into `main`. Everything is in `games/supabase/`.

**How:** Supabase > SQL Editor > New query > paste the whole file > Run. One file at a time, top to bottom.
Every file is safe to run twice. **Stop at the first error** and send it to Claude (file name + the red message).

## Step 0: what is already there (read only)
Run `deploy/00_check.sql`. It lists every file below as `done` or `missing`. Skip the `done` ones (running them again
does no harm). The last row shows whether the Passport has launched (the Pond Pioneer snapshot time).

## A. Game and chat updates (merged into `main` or approved: #251, #246)
1. `update_wheres_pepe_1km.sql`: full 5000 points only within 1 km, from the 2026-11-10 puzzle.
2. `update_wheres_pepe_monday_reset.sql`: the PEP reward week resets Monday 00:00 UTC.
3. `update_wheres_pepe_paid_by_bot.sql`: "Paid" without a txid, for the Filippy tip bot.
4. `update_wheres_pepe_hide_host.sql`: the host's Pepe Guesser score is hidden from others (#251).
5. `update_pepaint_first_wins.sql`: PEPaint, the first right guess wins the turn.
6. `update_pepaint_top.sql`: PEPaint top of the week (after 5).
7. `update_words_pepaint.sql`: 84 new PEPaint words.
8. `update_lobby_who.sql`: LAN Party chat, who is online (#246).

## B. The launch
9. `update_fren_passport.sql`
10. `update_fren_avatar.sql`
11. `update_passport_awards.sql`: **its first run is the launch moment**: everyone with Discord linked right then gets
    Pond Pioneer, and the Hall of Fame starts on the first Monday on or after this moment.
12. `update_passport_public.sql`: other frens' passports, read only.
13. `update_wheres_pepe_hall_of_fame.sql`: Days at #1, Weekly Champion, Pond Dominator, Hall of Fame (#258). Last, so
    the week board is Monday-Sunday and still hides the host.

## All at once
`deploy/LAUNCH_ALL.sql` is files 1-13 in this order in ONE transaction (built by `scripts/build_launch_sql.py`, the
files' own begin/commit lines taken out): paste it, Run, and either everything is in or, on any error, nothing is.
Use it instead of the 13 files, not as well (running both is harmless, only slower).

Then run `deploy/00_check.sql` again: all rows `done`, and the last row shows the launch time.

## Optional, after B
- Supabase > Database > Extensions > `pg_cron` on, then run step 15 again: the Hall of Fame closes each day at 00:01 UTC
  by itself. Without it, days close on the next Passport visit or Hall of Fame view (same result, a bit later).

## Later: PepeGochi day (owner, 2026-11-09: PepeGochi launches after the Passport)
Not in LAUNCH_ALL.sql. On PepeGochi day, in this order: `update_pepegochi_v2.sql`, `update_pepegochi_passport.sql`,
`update_pepegochi_room_v1.sql`, `update_pepegochi_rewards.sql`; then its five stamps go `live` and the `?beta=gochi` gate
comes off. Until then its API does not exist, so nobody can adopt a frog before the window is public.

## Included decisions
- #253 (Pond Pioneer V3, Share Fren as a secret) is merged into the launch branch: step 11 is that file.
- #251, #246 and #258 ship with the launch; their PondOS code comes with the release merge.
