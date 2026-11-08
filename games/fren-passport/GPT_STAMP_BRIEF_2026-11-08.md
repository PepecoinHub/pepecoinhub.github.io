# Fren Passport stamps: brief for ChatGPT (2026-11-08)

You (ChatGPT) own the **stamp art**. Claude owns the code: catalog, server rules, sprite build and the Passport UI.
This brief tells you what to draw, in what order, and what changed today.

Read together with:
- **Art rules (unchanged):** PR #231, `games/fren-passport/STAMP_ART_SPEC_FOR_GPT.md`, §1–§8 (frame, Pepe, colours,
  small size, not allowed, gold, delivery). Everything there still applies.
- **Stamp rules (new, final):** `games/FREN_PASSPORT_RECONCILIATION_2026-11-08.md` on `main`. If a rule in the
  v3 spec §9 differs from that file, **that file wins**.

## 1. What is fixed

- The list is **48 regular stamps + BALI**, exactly the IDs in the v3 spec appendix. Do not add, rename or drop an ID,
  and do not invent badge names (cut out any extra badges a generator adds to a sheet).
- Labels are exactly those in the v3 appendix (`rookie_miner` → **Happy Mining!**, `like_it_here` → **30-Day Streak**,
  `interior_designer` → **Pond Decorator**).
- Lily's 15 stamps stay as they are. The only Lily change is the `rookie_miner` label text.
- Visual baseline: the owner's favourites `frog_of_the_week` and `moonwalker` (detailed, slightly irregular cartoon).
  Not the old AI concepts in PR #230 and not clean geometric SVGs.

## 2. Owner decisions today that affect pictures

| Stamp | Decision | What it means for the picture |
|---|---|---|
| `good_game` | A resigned or abandoned game does **not** count | Show a game played to the end (handshake over a finished board, both frogs content). No white flag, no tipped-over king. |
| `checkmate` | Win by checkmate only | A clear checkmate moment on a chess board. Not a resignation. |
| `podium` | **Pepe Pictures only** (the photo quiz), not Draw & Guess | Podium with photo/picture cards or a quiz buzzer. **No easel, no drawing, no pencil.** |
| `game_night` | Pepe Pictures game nights | An evening quiz night: CRT with picture cards, snacks, a clock or moon. No drawing. |
| `season_champion` | **Once**, not repeated. One winner of a whole Pepe Pictures season | One distinctive champion moment (the v3 rejection of generic trophies still stands). No ×2/×3 on the art. |
| `frogmas` | **Once**, not repeated | No year anywhere on the stamp. |
| `frog_of_the_week` | The only repeatable stamp | Keep the approved art. The ×2/×3 counter is drawn by the UI, never on the art. |
| `old_frog` | One year from the first Discord log-on | Approved art (cane, rocker, one candle) still fits. |
| `top_ten` | Top 10 on the Pepe Guesser week board, YEET or the Pepe Pictures season | A generic Win98 leaderboard with a highlighted row. No game logo, no specific game. |
| `fud_buster` | 2,000 points in FUD Invaders | A hero moment against FUD. **No number on the stamp.** |
| `long_snake` | 40 blocks in PEP Snake | A very long snake made of blocks/coins. **No number on the stamp.** |
| `treasure_hunter` | 6 secrets (was 10) | If a count is visible in the scene, it is 6. Better: no count at all. |
| `rookie_miner` | First Pepe Miner cloud save, label **Happy Mining!** | Label edit only. Keep Lily's picture. |

## 3. What to draw, in this order

The album will show earnable stamps plus only **3 to 4 `???` teasers**. Everything else stays hidden, so stamps for
features that do not exist yet are the **last** priority.

### Priority 1: stamps players can earn on launch day (needed first)

| ID | Current art | Your job |
|---|---|---|
| `first_fren` | AI concept (#230) | **Redraw** in the v3 style (spec §14 scene). It is the first stamp everyone gets. |
| `first_avatar` | AI concept (#230) | **Redraw** (§14) |
| `sharp_eye` | AI concept (#230) | **Redraw** (§14) |
| `community_fren` | AI concept (#230) | **Redraw** (§14) |
| `detective_fren` | accepted, 303 px | Same accepted scene at **900+ px native**. No redesign. |
| `like_it_here` | candidate 1173×1341 | Final QA (§8), then mark ready |
| `nasa_is_hiring` | candidate 1173×1341 | Final QA, check joins and 34–78 px legibility |
| `moonwalker` | approved 1173×1341 | Final QA (6000 m sign, real YEET pilot costume) |
| `rookie_miner` | Lily | Label "Happy Mining!" only (preview exists) |

The #230 redraws are no longer optional: those four stamps are live on day one and must match the rest.

### Priority 2: the next stamps Claude builds (data already on the server)

`i_voted` (finish WIP at 900+ px), `yeet_adept`, `good_game`, `checkmate`, `fud_buster`, `long_snake`,
`arcade_hopper`, `secret_starter`, plus QA of the approved `certified_fren` and `old_frog`.

### Priority 3: after the owner tools and weekly/season logic

`vox_populi` (QA), `bug_hunter` (finish WIP at 900+ px), `frog_of_the_week` (QA), `season_champion` (**redraw**,
current file is reference only), `podium`, `game_night`, `quiz_master`, `top_ten` (finish WIP at 900+ px),
`frogmas`, `treasure_hunter`.

### Priority 4: later, do not start now

`picasso_fren` and `the_secret_pond` (accepted scenes, need 900+ px later), `good_parent` (done, QA later),
`frogageddon_beta`, `interior_designer`. These features are not built yet; they will appear as `???` or stay hidden.
BALI postmark and the Secret Pond wallpaper also wait. Special avatars stay paused (owner decision).

## 4. Delivery (same as spec §8, short version)

- One PNG per stamp, **native ≥ 900 px wide** (the approved files are 1173×1341), transparent outside the stamp,
  cream `#FCEDD5` paper, 7×8 scallops, grey `#C7BEAF` label with the exact text. Never upscale a small cutout and call
  it a source.
- Check every stamp at **34, 52, 64 and 78 px** next to `docs/meme/passport-assets/stamps-lily.webp`.
- No gold frames, counters, dates, locks or `???` in the art: the UI adds them.
- Put finished files in `games/fren-passport/source/stamps-new/<id>.png` and list them in a manifest JSON
  (`id`, `file`, `width`, `height`, `status`: `candidate` / `owner-approved`, `notes`).
- Keep **one** Draft art PR (#233). Do not open a new PR per batch.

## 5. Do not

- Edit anything in `docs/`, `games/supabase/`, `passport-catalog.json`, `avatar-options.json`, tests or UI code.
- Change rules, thresholds, labels or IDs. Ask the owner, and Claude updates the reconciliation file.
- Merge a PR, or mark art as production-ready yourself. The owner approves the picture; Claude checks it in the
  browser and builds the sprite.
- Draw hearts on `good_parent`, an astronaut suit on YEET stamps, the NASA logo, real brand logos, or text other
  than the label.

## 6. Hand-off back to Claude

When a stamp is owner-approved, write in the PR: the ID, the file path, "owner-approved" and the date. Claude then
cuts the 138×150 tile, adds it to the new sprite, maps it to its ID and keeps Lily's art first. Ready art does not
make a stamp earnable: it appears only when its server rule is built.
