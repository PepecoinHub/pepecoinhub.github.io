# Fren Passport — confirmed stamp rules (2026-11-06)

Status: **built in Draft PR #191, not deployed.** The server side is `games/supabase/update_passport_awards.sql`. Apply it only after review, after `update_fren_passport.sql` and `update_fren_avatar.sql`, and **on launch day** (it takes the Pond Pioneer snapshot on its first run). Do not run SQL on production or merge without owner approval.

## Owner rules

1. **Only stamps the server can verify.** If only the browser could know about something (opening the NERDS ONLY folder, starting FROGAGEDDON, playing PEPE SWEEPER), it is **not** a stamp. Those ideas were dropped.
2. **Discord accounts only.** Guests and accounts without Discord never collect stamps. Every award goes through `games.passport_award()`, which checks `games.discord_identity()`.
3. **Stamps not designed yet show as `???` / "Coming soon"**, without their name or rule.
4. Stamps are cosmetic: no PEP, no points, nothing to sell or trade.

## Live stamps (20)

| Badge ID | Name | Rule | Server source | Backfilled |
|---|---|---|---|---|
| `first_fren` | First Fren | Signed in with Discord | `auth.users.created_at` | yes (always) |
| `pond_pioneer` | Pond Pioneer | Discord linked when the stamps migration first runs. Closed afterwards. | one-time snapshot of `auth.identities` | snapshot |
| `first_avatar` | Fresh Fren | First saved avatar | `gry_passport_avatar_save` | — |
| `welcome_back` | Welcome Back! | Back in PondOS on the day after the first visit (only then) | `gry_passport_checkin` → `games.passport_days` | no |
| `pepe_guesser` | Pepe Guesser | First guess with a pin | `games.wp_plays` (verified, pin) | yes |
| `sharp_eye` | Sharp Eye | First perfect 5000 | `wp_plays.points` (server scored) | yes |
| `detective_fren` | Detective Fren | 5000 on 5 different puzzle days. Unlocks detective hat + suit. | `wp_plays` | yes |
| `week_scout` | Week Scout | A guess on 7 puzzle days in a row (UTC) | `wp_plays` | yes |
| `scout_fren` | Scout Fren | A guess on 14 puzzle days in a row (UTC). Unlocks the PEP pin. | `wp_plays` | yes |
| `first_words` | First Words | First lobby chat message | trigger on `games.lobby_chat` | no (chat kept 24 h) |
| `hey_fren` | Hey @Fren | First @mention of another fren | trigger on `games.lobby_mentions` | no |
| `community_fren` | Community Fren | Lobby chat on 5 different UTC days | `games.passport_chat_days` | no |
| `dear_editor` | Dear Editor | First letter to the editor | trigger on `games.letters` (`discord = true`) | yes |
| `junior_editor` | Junior Editor | 5 letters to the editor | `games.passport_progress.letters` | yes |
| `senior_editor` | Senior Editor | 10 letters to the editor | same | yes |
| `like_it_here` | Guess You Like It Here | PondOS opened signed in on 30 UTC days in a row (replaced 7 Day Fren, then 10 Day Fren) | `gry_passport_checkin` → `games.passport_days` | no |
| `rookie_miner` | Rookie Miner | 10 minutes of Pepe Miner | server clock between cloud saves | no |
| `miner_fren` | Miner Fren | 1 hour of Pepe Miner. Unlocks the hard hat. | same | no |
| `nasa_is_hiring` | NASA Is Hiring | Three accepted YEET flights strictly above 5000 m | first three kept in `games.passport_yeet_5k` | no (only the best flight was stored before) |
| `moonwalker` | Moonwalker | A 6000 m YEET flight (the maximum). Very rare. | `gry_yeet_submit` hook | yes (`yeet_records.best = 60000`) |

Details:
- **Pepe Guesser** counts plays with `verified = true` and a pin (`g_lat is not null`). A timeout without a pin is not a guess. Days are puzzle days (`wp_puzzles.day`, UTC). If no puzzle goes live on a day, the run breaks for everyone, the same as the game's own streak.
- **Pepe Miner time** is measured by the server: the game sends its cloud save every 60 s, and the time between two accepted saves at most 120 s apart counts. A longer gap starts a new session. The game's own numbers are ignored. A script that keeps calling the save RPC can still collect time; this is a cosmetic stamp, not anti-bot proof.
- **YEET** distances are client-reported with plausibility checks only (`update_yeet.sql`), so YEET stamps are as trustworthy as the leaderboard. Rate-limited submissions do not count. A flight above 5000 m counts even when it is not a new best.
- **Removed:** Frog Detective (10 Pepe Guesser days), on the owner's call.
- **Next Milestone** suggests the closest stamp with a real counter and says what is missing ("3 more perfect 5000s", "2 more flights over 5000 m", "29 more days in a row", minutes of Miner, metres to 6000). Letters, chat and @mentions are never suggested, so nobody is nudged to spam the editor or the lobby. Pond Pioneer and Welcome Back! are not suggested either.
- **Stamps added later keep current progress** when the data is already kept: PondOS days (`passport_days`), chat days, letters, Miner seconds, every accepted YEET flight and every one over 5000 m (`passport_progress.yeet_flights`, `yeet_5k_total`), and all Pepe Guesser plays. A new stamp needs its own backfill statement in its migration, like the ones at the end of `update_passport_awards.sql`.
- **Notices:** `gry_passport_checkin()` (no arguments) runs when a Discord player opens a PondOS page, at most every 5 minutes per tab. It returns each new stamp once (`passport_badges.notified_at`), and PondOS shows one balloon.
- **Safety:** every game hook catches its own errors and logs a warning, so a stamp bug cannot break a game, a chat message or a save.
- **Avatar reward parts** (`hat_detective`, `clothing_suit`, `accessory_pin`, `hat_hardhat`) become saveable when the player holds the stamp; the save RPC checks it again on the server. `bg_sunset` (Adept) and `accessory_headphones` (Gamer Fren) stay locked, because those stamps are not live.

## Still planned ("???" / Coming soon)

PepeGochi (needs PR #186 and a frontend): `first_hatch` (adopt the pet), `little_fren` (second care day: the tadpole becomes a froglet), `grown_fren` "One Small Step" (7th care day: adult; "one small step for a man, one giant leap for a frog"). These match the life cycle in `games/PEPEGOCHI_API.md` (tadpole 0-1 care days, froglet 2-6, adult 7+). Care days are distinct UTC days, not in a row.

Everything else in `docs/meme/passport-catalog.json` with `status: "planned"`, including `certified_fren`, `yeet_adept` (3000 m, rule already agreed), `hundred_day_fren`, the PepeGochi stamps and BALI. `games.passport_days` can serve Certified Fren later (100 distinct days).

## Cross-PR conflict to resolve before merge

Draft PR #186 (`games/supabase/update_pepegochi_passport_bridge.sql`) grants `certified_fren` after 100 PepeGochi care days. That conflicts with the agreed rule (100 days of PondOS activity). Before publishing #186, stop its bridge from minting `certified_fren` and pick a PepeGochi-specific stamp instead. Its `gry_passport_state` changes would also have to be rebased on the newest definition, which is now in `update_passport_awards.sql`.

## Tests

- `tests/passport-awards.test.mjs` (static, runs in CI): live catalog == award allowlist, no browser arguments, Discord-only award path, hooks catch errors, `gry_yeet_submit` equals `update_yeet.sql` plus the hook.
- `tests/passport-awards-sql.test.mjs` (real PostgreSQL, opt-in): loads `schema.sql` and all hooked game migrations, then plays through the real RPCs (`gry_yeet_submit`, `gry_wp_start`/`gry_wp_guess`, `gry_lobby_say`, `gry_letter_send`, `gry_miner_save`, `gry_passport_checkin`, `gry_passport_avatar_save`). It covers the Pioneer snapshot and a re-run, backfills, guests, an unlinked Discord account, thresholds, gaps, grants, one notice per stamp, reward parts, a failing hook, and account deletion. Eight deliberate bugs in the migration were each caught by it.
- `scripts/fren_avatar_e2e.mjs` (browser, opt-in): the stamp balloon, the Passport and album, reward parts in the maker, Pioneer "Closed" for a late account, the `pond_stamps.mpg` ad.
