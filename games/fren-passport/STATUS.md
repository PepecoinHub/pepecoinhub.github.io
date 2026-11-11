# Fren Passport: status (one place, kept up to date)

Last update: 2026-11-11, ChatGPT (approved V3 browser sprite). Update this file in every Passport PR.

- **Rules for each stamp:** `games/FREN_PASSPORT_RECONCILIATION_2026-11-08.md` (owner decisions of 2026-11-08 below win)
- **Art rules for ChatGPT:** `games/fren-passport/GPT_MASTER_PROMPT.md`
- **Art in progress:** Draft PR #233 (the only art PR)

## 1. Where things stand

| Area | State |
|---|---|
| Public site | Passport **hidden**. Only browsers that opened `/meme/?beta=fren` see it. |
| Server (Supabase) | The three passport migrations are **drafts, not run**: `update_fren_passport.sql` → `update_fren_avatar.sql` → `update_passport_awards.sql`. Until then no stamp is real. |
| Stamps | **40 of 48 have a rule** (+ BALI). 8 wait: 5 PepeGochi stamps and Beta Tester (features not built), Picasso Fren and The Secret Pond (no data yet). |
| Album | 40 shown, 3 `???` teasers (Picasso Fren, First Hatch, Beta Tester), 5 hidden. |
| Secrets | 11 findable (none advertised; a short Gazette note later) + 2 event days for everyone. Map pieces dropped. |
| Special avatars | 16, each behind a secret, a stamp or an event day. Own **Avatars** tab in the Passport (section 5). |
| Art | 47 of 48 achievement stamps now display approved V3 art, and 2 event avatars also have V3-style stamps. No Lily drawings are used at runtime. Beta Tester remains a neutral placeholder pending the game feature; BALI is a separate ticket. |


### Owner-only local QA sandbox (deployed in PR #255/#256)

- URL after review/merge: `/meme/?beta=fren-test`. This **does not** persist the flag in localStorage; `?beta=fren` keeps its existing behavior.
- Requires a real Discord login and a successful server-side owner check via the already existing `gry_letters` RPC (the same protection as the Editor's desk). An arbitrary visitor with the URL **cannot** use the sandbox.
- Controls in the Passport: unlock a selected special avatar (by simulating its stamp/secret), simulate any stamp, simulate any secret/event, toggle all special avatar/part unlocks, and reset the local QA state.
- Real clicking of supported PondOS secrets also writes to the **QA sandbox only** in this mode. QA does not set production discovery markers.
- Simulated records and saved looks are stored under `pondos-fren-owner-sandbox-v1:<Discord user UUID>` in browser localStorage. `Reset sandbox` removes only this key; **no production badges, secrets, avatar saves, or migrations are touched**.
- Return to ordinary `/meme/?beta=fren` to see the unmodified beta behavior. Close and reopen the Maker after a simulated unlock so it refreshes available parts.
- Manual acceptance checks: non-owner denied, logged-out denied, mobile UI, all special avatars selectable in Maker, look restored on refresh, test discovery and manual stamp displayed in Passport, reset clears sandbox, ordinary beta unchanged, no `gry_passport_avatar_save`/`gry_passport_discover` network calls in sandbox mode.


### Approved V3 art integration (2026-11-11)

- One WebP sprite: `docs/meme/passport-assets/stamps-v3.webp`, 49 tiles, 138 × 150 each.
- Art source: owner-approved V3 PNGs in draft PR #233, plus exclusive Pond Pioneer accepted in PR #253. The updated builder `scripts/build_v3_stamps.py` lists the exact sprite order used by `docs/meme/meme.js`.
- Runtime no longer refers to `stamps-lily.webp` or `PP_LILY`. Historical Lily files are retained for archival purposes only and are not loaded by the Passport.
- `frogageddon_beta` has no approved picture, so the neutral placeholder is shown instead of an unrelated stamp. Locked stamps remain locked; no grants, Supabase SQL or achievement rules changed.
- The image is a single optimized atlas for mobile; native PNG source files are not loaded by the browser.

## 2. All 48 stamps

Art: ✅ integrated V3 · ⬜ no approved drawing. The optimized 49-tile V3 sprite replaces the 14 runtime Lily references.
Album: **shown** · **???** (teaser) · hidden.

| # | ID | Label | How it is earned (server) | Album | Art |
|---:|---|---|---|---|---|
| 1 | `first_fren` | First Fren | Discord sign-in | shown | ✅ v3 |
| 2 | `pond_pioneer` | Pond Pioneer | Discord linked on launch day (one-time snapshot) | shown | ✅ v3 |
| 3 | `first_avatar` | Fresh Fren | first saved avatar | shown | ✅ v3 |
| 4 | `welcome_back` | Welcome Back! | back the day after the first visit | shown | ✅ v3 |
| 5 | `first_words` | First Words | first lobby chat message | shown | ✅ v3 |
| 6 | `hey_fren` | Hey @Fren | first @mention | shown | ✅ v3 |
| 7 | `community_fren` | Community Fren | chat on 5 different days | shown | ✅ v3 |
| 8 | `dear_editor` | Dear Editor | first letter to the editor | shown | ✅ v3 |
| 9 | `junior_editor` | Junior Editor | 1 letter marked **Printed** by the owner | shown | ✅ v3 |
| 10 | `senior_editor` | Senior Editor | 5 letters marked Printed | shown | ✅ v3 |
| 11 | `vox_populi` | Vox Populi | 10 letters marked Printed | shown | ✅ v3 |
| 12 | `i_voted` | I Voted | a verified vote in a Pond Poll | shown | ✅ v3 |
| 13 | `streak_14` | 14-Day Streak | PondOS 14 days in a row | shown | ✅ v3 |
| 14 | `like_it_here` | 30-Day Streak | PondOS 30 days in a row | shown | ✅ v3 |
| 15 | `certified_fren` | Certified Fren | 100 different PondOS days | shown | ✅ v3 |
| 16 | `old_frog` | Old Frog | one year since the first Discord log-on | shown | ✅ v3 |
| 17 | `pepe_guesser` | Pepe Guesser | first Pepe Guesser guess | shown | ✅ v3 |
| 18 | `sharp_eye` | Sharp Eye | first perfect 5000 | shown | ✅ v3 |
| 19 | `detective_fren` | Detective Fren | 5000 on 5 different days | shown | ✅ v3 |
| 20 | `week_scout` | Week Scout | Pepe Guesser 7 days in a row | shown | ✅ v3 |
| 21 | `scout_fren` | Scout Fren | Pepe Guesser 14 days in a row | shown | ✅ v3 |
| 22 | `frog_of_the_week` | Frog of the Week | the Weekly Champion: alone at #1 of the Pepe Guesser week (Mon–Sun UTC); a tie has no winner (from `wp_hof_start`, `games.wp_settle`); the only repeatable stamp (×2, ×3…) | shown | ✅ v3 |
| 23 | `yeet_adept` | Adept | YEET 3000 m | shown | ✅ v3 |
| 24 | `nasa_is_hiring` | NASA Is Hiring | 3 YEET flights over 5000 m | shown | ✅ v3 |
| 25 | `moonwalker` | Moonwalker | YEET 6000 m | shown | ✅ v3 |
| 26 | `rookie_miner` | Happy Mining! | first Pepe Miner cloud save | shown | ✅ v3 |
| 27 | `good_game` | Good Game | board game finished with another Discord player, 10+ moves, no resign/leave | shown | ✅ v3 |
| 28 | `checkmate` | Checkmate! | chess win by mate (same rules) | shown | ✅ v3 |
| 29 | `picasso_fren` | Picasso Fren | no data yet (Draw & Guess saves nothing) | ??? | ✅ v3 |
| 30 | `podium` | Podium | top 3 in Pepe Pictures | shown | ✅ v3 |
| 31 | `game_night` | Game Night | Pepe Pictures during a scheduled event (±3 h) | shown | ✅ v3 |
| 32 | `season_champion` | Season Champion | winner of a ranked Pepe Pictures season | shown | ✅ v3 |
| 33 | `quiz_master` | Quiz Master | hosted a Pepe Pictures game with 4+ ranked players | shown | ✅ v3 |
| 34 | `top_ten` | Top 10 | top 10 in YEET, the Pepe Guesser week or the Pictures season | shown | ✅ v3 |
| 35 | `arcade_hopper` | Arcade Hopper | a server score in 5 different games | shown | ✅ v3 |
| 36 | `fud_buster` | FUD Buster | 2000 points in FUD Invaders | shown | ✅ v3 |
| 37 | `long_snake` | Long Snake | 40 blocks in PEP Snake | shown | ✅ v3 |
| 38 | `bug_hunter` | Bug Hunter | given by the owner from the mailbox | shown | ✅ v3 |
| 39 | `frogageddon_beta` | Beta Tester | waits for online FROGAGEDDON | ??? | ⬜ (later) |
| 40 | `first_hatch` | First Hatch | waits for PepeGochi | ??? | ✅ v3 |
| 41 | `little_fren` | Little Fren | waits for PepeGochi | hidden | ✅ v3 |
| 42 | `grown_fren` | One Small Step | waits for PepeGochi | hidden | ✅ v3 |
| 43 | `good_parent` | Good Parent | waits for PepeGochi | hidden | ✅ v3 |
| 44 | `interior_designer` | Pond Decorator | waits for PepeGochi | hidden | ✅ v3 |
| 45 | `secret_starter` | Secret Starter | first secret | shown | ✅ v3 |
| 46 | `treasure_hunter` | Treasure Hunter | 6 secrets | shown | ✅ v3 |
| 47 | `the_secret_pond` | The Secret Pond | no data yet | hidden | ✅ v3 |
| 48 | `frogmas` | Frogmas | a visit on 24–26 December | shown | ✅ v3 |
| 49 | `pond_dominator` | Pond Dominator | alone at #1 of the Pepe Guesser week at the end of all 7 days (`games.wp_settle`, `games/WP_HALL_OF_FAME.md`); once per account | shown | ✅ owner art, own file `pond-dominator.webp` |
| — | `bali` | BALI | the owner opens it when PEP hits $0.01; every fren gets it on the next visit | printed on the page | ✅ ticket + postmark |

**Totals.** Rules: 40 + BALI. Browser art: 47/48 achievement stamps use approved V3; Beta Tester remains a neutral placeholder. Two event-day art assets also live in the V3 sprite. BALI retains its approved ticket.

Stamps without approved art use a neutral question-mark placeholder if earned. Un-earned stamps use the locked tile. No Lily or category-themed illustration is substituted for an earned stamp.

## 3. Owner tools (in Frog Mail → Editor's desk, with `?beta=fren`)

- **🖨 Mark printed** on a letter whose writer ticked "OK to print". Counts per Discord writer: 1 → Junior Editor,
  5 → Senior Editor, 10 → Vox Populi. Clicking again unmarks it (a mis-click), and a stamp the count no longer
  reaches is taken back. The marks survive the mailbox clean-up.
- **🐞 Give Bug Hunter** on a Discord letter. Clicking again takes it back (asks first).
- **🏝 PEP hit $0.01? Open BALI…** at the top of the desk, two clicks, only on the day PEP really reaches $0.01. Tapping the BALI ticket in the Passport never gives the stamp (it only finds the Bali Dreamer secret). From then on every Discord fren gets BALI on the next
  visit; the owner gets it at once. "Close BALI" stops new awards and takes nothing back.

These buttons call the new RPCs, so they work only after the migrations run.

## 4. What is left

**Owner**
1. Launch day: run the three migrations in Supabase, then the `?beta=fren` gate comes off.

**ChatGPT:** All currently owner-approved V3 illustrations are integrated in the album. 
`frogageddon_beta` (Beta Tester) has no approved source and uses the neutral placeholder until the game feature arrives.
High-resolution redraws of any other stamp remain optional art-quality improvements, not blockers for V3 display.

**Claude**
1a. **New-reward notice** (owner, 2026-11-09): an animated Windows 98 style notice for a new stamp, secret or avatar
   that nobody can miss. Today a plain tray balloon shows new stamps only. Plan: the tray balloon with a stamp
   "thump" animation, a blinking Passport icon in the tray until the Passport is opened, and the same notice for
   secrets and avatars. Not in Frog Mail (that stays for letters and the Gazette).
1b. **Incognito avatar** (`games/fren-passport/source/avatars/incognito_original.png`): for the "invisible" status,
   once the bigger chat window with statuses (available / back soon / invisible) exists.
2. Scene blocks in `GPT_MASTER_PROMPT.md` for the stamps above, and each new upload into #233 and the sprite.
3. A short Gazette note about secrets, when the owner asks.
4. Launch-day removal of the beta gate.

## 5. Special avatars (2026-11-08, more on 2026-11-09)

Whole-character avatars in Create Your Fren (the `special` slot), locked until earned. The Passport's **Avatars**
tab (where Achievements used to be) lists all of them with how each one opens (secrets keep their hiding place):

| Avatar | Unlock | How |
|---|---|---|
| Batfren | secret `why_tho` | copy a tip address in About me |
| Vampire | secret `midnight_fren` | the screensaver runs between 23:30 and 00:30 local time (desktop only) |
| Smiley | secret `happy_fren` | a `:)` in the lobby chat (server trigger, not claimable) |
| Nerd | secret `nerd_alert` | open README_NERD.txt in NERDS ONLY |
| Born to Fren | secret `born_to_fren` | the word "fren" in the lobby chat (@mentions do not count; server trigger) |
| Bali Dreamer | secret `bali_dreamer` | tap the BALI stamp in the Passport |
| Knight | stamp `good_game` | finish a board game with another Discord fren |
| Explorer Pepe | stamp `scout_fren` | Pepe Guesser 14 days in a row |
| Secret Seeker | stamp `secret_starter` | find any secret |
| Looking Glass | secret `find_fren` | open a result in the Find app |
| Sherlock | secret `address_check` | check a valid PEP address in AddressCheck.exe |
| Scribe | stamp `dear_editor` | send a letter to the editor |
| Old Editor | stamp `senior_editor` | 5 letters printed |
| Birthday Fren | event `pep_birthday` | visit on 30 January, Pepecoin's birthday (UTC 30–31) |
| Santa Fren | stamp `frogmas` | visit on 24–26 December |
| Turkey Fren | event `thanksgiving_fren` | visit on US Thanksgiving weekend (4th Thursday of November to Sunday) |

Live secrets: 11 (Wrong Frog, Why Do You Need This?, The Magic Word, Blue Screen of Fren, Midnight Fren, Nerds Only,
Bali Dreamer, Happy Fren, Born to Fren, Looking Glass, Trust But Verify). The two event days are listed with the secrets
but are not "found": they do not count for Secret Starter or Treasure Hunter.
