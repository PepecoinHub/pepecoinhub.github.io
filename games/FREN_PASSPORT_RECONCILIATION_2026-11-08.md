# Fren Passport: final stamp table and v3 ↔ main reconciliation (2026-11-08)

Written by Claude for the owner, ChatGPT and Kiro. One table for all **48 regular stamps + BALI**: ID, rule,
where the data comes from, whether the server can check it, and what is built today.

Sources compared:
- **main**: `docs/meme/passport-catalog.json` (46 entries: 21 `live`, 25 `planned`), `games/supabase/update_fren_passport.sql`,
  `update_fren_avatar.sql`, `update_passport_awards.sql`, and the game tables in `schema.sql` and the other `update_*.sql` files.
- **v3**: PR #231 `games/fren-passport/STAMP_ART_SPEC_FOR_GPT.md` (owner-confirmed list of 48 + BALI) and the art branch
  `art/fren-passport-v3-handoff-20261108` (PR #233, `ART_V3_INVENTORY_2026-11-08.json`).

**v3 is the source of truth for which stamps exist and their labels.** This file decides how each one is checked.
Nothing here is built yet: no catalog, SQL or UI change is part of this file.

## Important before anything else

1. **`live` in the catalog means "coded", not "running".** All three passport migrations are still marked DRAFT
   in the repo, and `update_passport_awards.sql` says "run it on launch day". Claude cannot see Supabase from here.
   Owner check: in Supabase SQL Editor run `select count(*) from games.passport_badges;`. If the table does not exist,
   nothing has ever been awarded and the rule changes below cost nothing.
2. The passport is still hidden from everyone except browsers that opened `/meme/?beta=fren`.

## Status codes

| Code | Meaning |
|---|---|
| **CODED** | The award is written in the draft migrations and matches v3. |
| **CODED, RULE CHANGE** | Written, but v3 changed the rule; the SQL must change before launch. |
| **HOOK** | The server already keeps the data. A new hook (trigger or a line in an existing function) is enough. |
| **NEW DATA** | The server does not keep what the rule needs. A new column/table or logging comes first. |
| **OWNER** | Granted by hand by the owner through an owner-only function that does not exist yet. |
| **BLOCKED** | Depends on a feature that is not on `main`. Shows `???` until then. |

"Client score" = the number comes from the browser with plausibility checks only (YEET, FUD, Snake), like the
leaderboards today. Fine for a cosmetic stamp, never for anything of value.

## The table (48 + BALI)

| # | ID | Label | Rule (final) | Data source | Status | Art (v3) |
|---:|---|---|---|---|---|---|
| 1 | `first_fren` | First Fren | Discord linked to PepecoinHub | Discord identity; computed in `gry_passport_state`, no row | CODED | AI #230 (redraw optional) |
| 2 | `pond_pioneer` | Pond Pioneer | Discord linked on the day the awards migration first runs; never again | one-time snapshot in `update_passport_awards.sql` | CODED | Lily ✓ |
| 3 | `first_avatar` | Fresh Fren | First avatar saved | `passport_avatars` (`update_fren_avatar.sql`) | CODED | AI #230 |
| 4 | `welcome_back` | Welcome Back! | Back in PondOS the UTC day after the first visit | `passport_days` via `gry_passport_checkin` | CODED | Lily ✓ |
| 5 | `first_words` | First Words | First lobby chat message | trigger on `lobby_chat` | CODED | Lily ✓ |
| 6 | `hey_fren` | Hey @Fren | First @mention of another fren | `lobby_mentions` | CODED | Lily ✓ |
| 7 | `community_fren` | Community Fren | Lobby chat on 5 different UTC days | `passport_chat_days` | CODED | AI #230 |
| 8 | `dear_editor` | Dear Editor | First letter to the editor | `letters` | CODED | Lily ✓ |
| 9 | `junior_editor` | Junior Editor | **First letter printed in the Gazette** (was: 5 letters sent) | needs `letters.printed_at` | CODED, RULE CHANGE → NEW DATA | Lily ✓ |
| 10 | `senior_editor` | Senior Editor | **5 letters printed** (was: 10 sent) | needs `letters.printed_at` | CODED, RULE CHANGE → NEW DATA | Lily ✓ |
| 11 | `vox_populi` | Vox Populi | 10 letters printed | needs `letters.printed_at` | NEW DATA | B1, hi-res candidate, gold |
| 12 | `i_voted` | I Voted | First vote in a Pond Poll, signed in with Discord | `poll_votes` (`verified`), backfill possible | HOOK | B3 WIP (384 px) |
| 13 | `streak_14` | 14-Day Streak | PondOS opened on 14 UTC days in a row | `passport_days` | CODED | Lily ✓ |
| 14 | `like_it_here` | 30-Day Streak | PondOS opened on 30 UTC days in a row | `passport_days` | CODED (label changes only) | B2 candidate (hi-res) |
| 15 | `certified_fren` | Certified Fren | Active on 100 different UTC days | `passport_days` count | HOOK (in checkin) | B1 hi-res candidate, gold |
| 16 | `old_frog` | Old Frog | One year since the first Discord log-on to PepecoinHub | the Discord identity's creation time (`auth.identities`) | HOOK (in checkin) | B1 hi-res candidate |
| 17 | `pepe_guesser` | Pepe Guesser | First guess with a pin | `wp_plays` | CODED | Lily ✓ |
| 18 | `sharp_eye` | Sharp Eye | First perfect 5000 | `wp_plays` | CODED | AI #230 |
| 19 | `detective_fren` | Detective Fren | 5000 on 5 different days; unlocks detective hat + suit | `wp_plays` | CODED | B1, accepted, **low-res (303 px)** |
| 20 | `week_scout` | Week Scout | A guess on 7 UTC days in a row | `wp_plays` | CODED | Lily ✓ |
| 21 | `scout_fren` | Scout Fren | A guess on 14 UTC days in a row; unlocks explorer hat + Explorer Pepe | `wp_plays` | CODED | Lily ✓ |
| 22 | `frog_of_the_week` | Frog of the Week | #1 of the Pepe Guesser week (Mon–Sun UTC), Discord players only; repeatable | `wp_plays`, worked out after the week ends (at the next check-in) | HOOK + REPEAT | B1 hi-res, gold |
| 23 | `yeet_adept` | Adept | YEET flight of 3000 m; unlocks Sunset background | `gry_yeet_submit` (one line beside Moonwalker); client score | HOOK | B3 not drawn |
| 24 | `nasa_is_hiring` | NASA Is Hiring | Three YEET flights over 5000 m | `passport_yeet_5k`; client score | CODED | B2 candidate (hi-res) |
| 25 | `moonwalker` | Moonwalker | YEET flight of the full 6000 m | `yeet_records`; client score | CODED | B1 hi-res, gold |
| 26 | `rookie_miner` | Happy Mining! | **First Pepe Miner cloud save** (was: 10 min); unlocks hard hat | `miner_saves` | CODED, RULE CHANGE | Lily ✓, label edit only |
| 27 | `good_game` | Good Game | Finished a board game (chess, checkers, Connect Four, Sea Battle) against another Discord fren; **a resigned or abandoned game does not count** | `tables` (`status`, `result`) + `table_members.verified`; trigger when `result` is set | HOOK | B3 not drawn |
| 28 | `checkmate` | Checkmate! | Won chess by checkmate against another Discord fren (a resignation is not a checkmate) | `tables.reason = 'checkmate'` + winner seat | HOOK | B3 not drawn |
| 29 | `picasso_fren` | Picasso Fren | Other players guessed 10 of your drawings in Draw & Guess | **nothing kept**: Draw & Guess has no ranking and its matches are deleted | NEW DATA (count at turn end) | B1, accepted, **low-res (304 px)** |
| 30 | `podium` | Podium | Top 3 in a Pepe Pictures game (**Pepe Pictures only**) | `results.place ≤ 3` | HOOK | B3 not drawn |
| 31 | `game_night` | Game Night | Played in a scheduled Pepe Pictures game night | `events.room_code` + `starts_at` matched to `matches`/`results` | HOOK (Pictures nights only) | B3 not drawn |
| 32 | `season_champion` | Season Champion | #1 when a ranked Pepe Pictures season ends (held once, not repeated) | `seasons` + `results.points` | HOOK | B1, **reference only, must be redrawn**, gold |
| 33 | `quiz_master` | Quiz Master | Hosted a Pepe Pictures game with at least 4 ranked players | `rooms.host_id` at game end (host is not in `results`) | HOOK (in the game-end function) | B3 not drawn |
| 34 | `top_ten` | Top 10 | Top 10 on one of: Pepe Guesser week board, YEET board, Pepe Pictures season ranking; checked when the score is saved, kept after dropping out | `gry_wp_top('week')`, `yeet_records`, `gry_ranking('season')` | HOOK (three places) | B3 WIP (384 px) |
| 35 | `arcade_hopper` | Arcade Hopper | A server-recorded play in 5 different games; unlocks headphones | `yeet_records`, `wp_plays`, `arcade_scores` (fud, snake), `miner_saves`, `results`, `tables` | HOOK | B3 not drawn |
| 36 | `fud_buster` | FUD Buster | FUD Invaders score of **2,000** or more (about 8 full waves) | `arcade_scores` (`game='fud'`, `verified`); client score | HOOK | B3 not drawn |
| 37 | `long_snake` | Long Snake | PEP Snake score of **40 blocks** or more | `arcade_scores` (`game='snake'`); client score | HOOK | B3 not drawn |
| 38 | `bug_hunter` | Bug Hunter | Reported a real bug that got fixed | owner decision | OWNER | B3 WIP (384 px) |
| 39 | `frogageddon_beta` | Beta Tester | Played an online FROGAGEDDON match during the beta | FROGAGEDDON online matches are not stored on `main` | BLOCKED | B4 not drawn |
| 40 | `first_hatch` | First Hatch | First PepeGochi adopted | PepeGochi backend is only on branch `codex/pepegochi-secure-backend-v1` | BLOCKED | Lily ✓ |
| 41 | `little_fren` | Little Fren | PepeGochi cared for on a 2nd day | same | BLOCKED | Lily ✓ |
| 42 | `grown_fren` | One Small Step | PepeGochi grows up on its 7th care day | same | BLOCKED | Lily ✓ |
| 43 | `good_parent` | Good Parent | 30 days of good PepeGochi care | same | BLOCKED | B1 hi-res candidate |
| 44 | `interior_designer` | Pond Decorator | 10 decorations in the PepeGochi room | the room does not exist | BLOCKED | B4 not drawn |
| 45 | `secret_starter` | Secret Starter | First secret found | `passport_secrets` count, in `gry_passport_discover` | HOOK | B4 not drawn |
| 46 | `treasure_hunter` | Treasure Hunter | 6 secrets found (was: 10) | `passport_secrets` count | HOOK, **but only 3 secrets exist** | B4 not drawn |
| 47 | `the_secret_pond` | The Secret Pond | All 6 map pieces of the Lost Pond Files | the map pieces are not built | NEW DATA | B1, accepted, **low-res (300 px)**, gold |
| 48 | `frogmas` | Frogmas | Active on 24–26 December (UTC); held once, not repeated | `passport_days` | HOOK | B4 not drawn |
| — | `bali` | BALI | PEP reaches $0.01 | the server has no PEP price; the owner flips it once | OWNER (global) | exists; postmark to draw |

### Count by status

| Status | Stamps | How many |
|---|---|---:|
| CODED | 1–8, 13, 14, 17–21, 24, 25 | 17 |
| CODED, RULE CHANGE | 9, 10, 26 | 3 |
| HOOK (data already kept) | 12, 15, 16, 22, 23, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 45, 46, 48 | 18 |
| NEW DATA | 11, 29, 47 | 3 |
| OWNER | 38 | 1 |
| BLOCKED | 39–44 | 6 |
| **Total** | | **48** (+ BALI) |

**Good Game and Checkmate!**: the data is there (finished tables keep `result`, `reason` and both players), so
they are a HOOK. They are **not ready for integration**: no hook is written and no art is drawn.

## Differences between v3 and main, and what must change

### Removed in v3 (in the main catalog, not in the 48): 12

`miner_fren`, `curious_fren`, `gamer_fren`, `collector`, `one_month_fren`, `perfect_parent`, `lunar_decorator`, `no_panic`,
`game_collector`, `frog_mail_reader`, `trophy_shelf`, `hundred_day_fren`.

- `miner_fren` is **CODED** in `update_passport_awards.sql`: remove its award.
- Two avatar unlocks point at removed stamps (in `update_fren_avatar.sql` **and** `docs/meme/avatar-options.json`):
  - `hat_hardhat` ← `miner_fren` → change to `rookie_miner` (v3 rule);
  - `accessory_headphones` ← `gamer_fren` → change to `arcade_hopper` (v3 rule).
  Today both parts are unreachable.

### New in v3 (not in the main catalog): 15

`vox_populi`, `i_voted`, `frog_of_the_week`, `good_game`, `checkmate`, `picasso_fren`, `podium`, `season_champion`,
`quiz_master`, `top_ten`, `fud_buster`, `long_snake`, `bug_hunter`, `frogageddon_beta`, `frogmas`.

### Rule or label changes on IDs both have

| ID | main | v3 | What it needs |
|---|---|---|---|
| `junior_editor` | 5 letters sent | first letter printed | `printed_at` + owner "Printed" button; until then remove the old award from SQL |
| `senior_editor` | 10 letters sent | 5 letters printed | same |
| `rookie_miner` | 10 min of Miner, "Rookie Miner" | first cloud save, "Happy Mining!", hard hat | change the award and the label; move the hat unlock |
| `like_it_here` | "Guess You Like It Here" | label "30-Day Streak" | label only |
| `interior_designer` | "Interior Designer" | label "Pond Decorator" | label only |
| `treasure_hunter` | 10 secrets | 6 secrets | count only |

### Things the current database cannot do yet

1. **Repeatable stamps.** `passport_badges` has primary key `(user_id, badge_id)`, so a stamp can be held once.
   Only `frog_of_the_week` repeats (owner decision), so it alone needs a `times` counter column.
2. **"Printed in the Gazette"** is not stored. `letters.print_ok` is only the writer's permission. Needed:
   `letters.printed_at` and an owner-only button in "Letters to you". Blocks 3 stamps (9, 10, 11).
3. **Draw & Guess keeps nothing** after the game (no ranking by design, its matches are deleted). Only
   `picasso_fren` needs new counting at turn end (Podium and Game Night are Pepe Pictures only).
4. **Owner grant function.** `bug_hunter` (and BALI) need one owner-only RPC, checked with `games.is_owner()`.

### Farming and trust (cosmetic stamps, but worth closing the obvious holes)

- Board games: both players Discord-verified, different users, and a minimum length (e.g. chess ≥ 10 moves each,
  no resign/abandon in the first moves). One person with two Discord accounts can still do it; acceptable for a
  stamp that unlocks nothing.
- YEET, FUD, Snake: client scores, same trust as their leaderboards. Never attach anything of value.
- Secrets: the repo is public, so a secret found by reading `meme.js` can be claimed directly. The earlier
  proposal (a password drawn in a picture, checked as a hash on the server) still stands for the new secrets.

## Owner decisions (answered 2026-11-08)

1. **FUD Buster / Long Snake:** owner asked Claude to set a real challenge. FUD Buster = **2,000** points (FUD scores 10
   per receipt hit, 240 per wave, and each wave is faster, so that is about 8 cleared waves). Long Snake = **40 blocks**
   (the board is 20×15 and the snake reaches top speed after about 17 blocks). Revisit after a month of real scores.
2. **Top 10:** Pepe Guesser and YEET, plus (Claude's pick) the Pepe Pictures season ranking. Pepe Guesser uses the
   **week** board (the day board is too easy, all-time too closed to new players). FUD and Snake have their own stamps.
3. **Good Game:** a resigned or abandoned game does not count. Claude adds a minimum length so instant draws don't
   count either.
4. **Printed letters:** yes, add `letters.printed_at` and a "Printed" button in the owner's inbox.
5. **Repeatable:** only **Frog of the Week** repeats (×2, ×3 drawn by the UI). Season Champion and Frogmas are held once.
6. **Podium / Game Night:** Pepe Pictures only. No Draw & Guess counting for these.
7. **Old Frog:** one year from the first Discord log-on to PepecoinHub.
8. **`???`:** only **a few** locked teaser slots (3 to 4), so players know more is coming. Stamps that cannot be
   earned yet are otherwise **hidden**, not shown as a wall of `???`.

## Suggested order of work (each step a separate, small PR)

1. **Catalog + SQL reconciliation (no new hooks):** rewrite `passport-catalog.json` to the 48 + BALI above, remove
   `miner_fren` and the old editor awards from the SQL, change `rookie_miner`, move the two avatar unlocks, update the
   tests that check catalog IDs against the SQL.
2. **Cheap hooks on existing data:** `i_voted`, `yeet_adept`, `certified_fren`, `old_frog`, `secret_starter`,
   `good_game`, `checkmate`, `fud_buster`, `long_snake`, `arcade_hopper`.
3. **Owner tools:** `letters.printed_at` + button (unlocks 9, 10, 11) and the owner grant RPC (38, BALI).
4. **Weekly/season:** `times` column for `frog_of_the_week`, then `season_champion`, `frogmas`, `podium`,
   `game_night`, `quiz_master`, `top_ten`.
5. **Later, with their features:** PepeGochi (40–44), FROGAGEDDON online (39), Draw & Guess counting (29),
   map pieces and more secrets (46, 47).

Art can continue in parallel: nothing above changes which 48 stamps exist. The album shows earnable stamps and only
3 to 4 `???` teasers; the rest stay hidden until they can be earned. ChatGPT's art brief:
`games/fren-passport/GPT_STAMP_BRIEF_2026-11-08.md`.
