# Fren Passport v3: graphical handoff to Claude / Kiro (2026-11-08)

**Source of truth:** [approved art spec PR #231](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/231), file `games/fren-passport/STAMP_ART_SPEC_FOR_GPT.md`. This PR is an **ART REVIEW PR ONLY**. Do not merge, run SQL, alter the achievement catalog, integrate into production, or enable unlocks without the owner's approval.

## What is actually in this PR

- Six source-format PNGs in `games/fren-passport/source/stamps-new/`, each **1173×1341 px**, with transparency, cream perforated paper, grey label, and hand-drawn look. These are **not automatically production approved**; some need art QA.
- Four **WIP reference cutouts**, each only around 300×450 px, isolated under `games/fren-passport/stamps-review/art-v3-wip/`. Three depicted scenes were liked/accepted by owner **as concepts**, not as production-resolution sources; the fourth (`season_champion`) is **rejected for composition**.
- `games/fren-passport/stamps-review/art-v3-overview.jpg`: a contact sheet, expressly for review only.
- `ART_V3_INVENTORY_2026-11-08.json`: all IDs, statuses, missing work and image paths.

**Important:** all six full-size images in this branch were palette-optimized for GitHub size. They retain image dimensions and transparency. The uncompressed conversation originals are available in the external working package, if needed. Do not enlarge a 300px cutout and claim it meets the 900px source requirement.

## Main-page graphics, **10 new** stamps (two other featured stamps are already by Lily)

| Stamp ID | In this PR | Native PNG | Art status | Must verify/fix before production |
|---|---|---|---|---|
| `frog_of_the_week` | `source/stamps-new/` | 1173×1341 | owner-favorite; good reference | review alignment and 78px readability |
| `moonwalker` | `source/stamps-new/` | 1173×1341 | owner-favorite; good reference | check 6000m sign and real YEET pilot costume |
| `vox_populi` | `source/stamps-new/` | 1173×1341 | candidate | final check: soapbox, GAZETTE, no ballot box or unrelated writing |
| `certified_fren` | `source/stamps-new/` | 1173×1341 | candidate | final check: framed 100 certificate; no P hoodie |
| `old_frog` | `source/stamps-new/` | 1173×1341 | candidate | final check: cane, rocker, one candle |
| `good_parent` | `source/stamps-new/` | 1173×1341 | owner-preferred humorous direction | 30-day survival: surprised parent, happy living PepeGochi; absolutely NO hearts |
| `detective_fren` | `stamps-review/art-v3-wip/` | 303×457 | owner accepted illustrated concept; LOW RES | redraw >=900px: tied map pin and real photo, Maker hat/suit/tie |
| `the_secret_pond` | `stamps-review/art-v3-wip/` | 300×458 | owner accepted illustrated concept; LOW RES | redraw >=900px: 6 visibly joined torn map pieces, X, pond, blank sign |
| `picasso_fren` | `stamps-review/art-v3-wip/` | 304×458 | owner accepted illustrated concept; LOW RES | redraw >=900px: silly SUN on canvas and green tick in bubble |
| `season_champion` | `stamps-review/art-v3-wip/` | 310×424 | PREVIOUS ART REJECTED | new unique Pepe Pictures season champion scene, not generic #1 cup; no final asset |

The 12 featured slots are a **4×3 design proposal** described in PR #231, not an already implemented UI. The two unchanged Lily assets in those slots are `pond_pioneer` and `scout_fren`. Current `main` still uses 5×4 slots: layout needs a separate code PR.

## Owner's specific decisions that override older example art

1. The visual baseline is the owner's preferred detailed, slightly irregular cartoon stamps `frog_of_the_week` and `moonwalker`, not clean geometric SVGs and **not** the old AI concepts in #230.
2. `moonwalker`: actual YEET pilot, **red helmet with goggles, blue shirt, grey shorts and red sneakers**. No astronaut suit.
3. `good_parent`: 30 days of PepeGochi surviving. Comic disbelief, the relieved adult and a thriving froglet. **No hearts.** This explicitly updates the scene described in §9 of the v3 spec.
4. `season_champion`: **one winner of the entire Pepe Pictures season**. Previous near-identical generic trophy versions were rejected. The file in `art-v3-wip` is a reference only and must not be shipped.
5. Never replace Lily's 15 original stamps or create duplicate awards. Gold frames, counters, dates and locked/question marks are produced by the UI/build, not by source illustrations.

## Full art backlog (v3)

| Group | How many | Status | IDs |
|---|---:|---|---|
| Lily stamps | 15 | already in main | see inventory |
| Four AI concepts | 4 | Draft PR #230, optional redraw, not the v3 baseline | `first_fren`, `first_avatar`, `sharp_eye`, `community_fren` |
| Batch 1 featured | 10 | 6 high-res candidates + 3 low-res approved concepts + 1 rejected old version | `frog_of_the_week`, `season_champion`, `vox_populi`, `moonwalker`, `certified_fren`, `old_frog`, `the_secret_pond`, `detective_fren`, `picasso_fren`, `good_parent` |
| Batch 2 | 2 | not drawn | `like_it_here`, `nasa_is_hiring` |
| Batch 3 | 12 | not drawn | `i_voted`, `yeet_adept`, `good_game`, `checkmate`, `podium`, `game_night`, `top_ten`, `arcade_hopper`, `quiz_master`, `bug_hunter`, `fud_buster`, `long_snake` |
| Batch 4 | 5 | not drawn | `interior_designer`, `secret_starter`, `treasure_hunter`, `frogageddon_beta`, `frogmas` |
| Lily label edit | 1 | pending: keep same art, change `rookie_miner` to **Happy Mining!** | `rookie_miner` |

Totals in approved spec: **48 regular stamps = 15 Lily + 4 AI + 29 new**, plus special BALI; **29 new = 10 + 2 + 12 + 5**. Other images: 4 special avatars (`special_yeet_pilot`, `special_graduate`, `special_parent`, `special_archivist`), 1 Secret Pond wallpaper, 1 BALI postmark. 2 PEP-TV hosts and 4 AI redraws are optional. Exclude these non-stamp assets from the 29 count.

## Handoff: what Claude/Kiro should do next

1. Review `art-v3-overview.jpg` and individual PNGs at 34, 52, 64 and 78px; compare them with `docs/meme/passport-assets/stamps-lily.webp` and §2–8 of PR #231.
2. Re-create the low-res three at 900+ px without replacing the user's approved visual concept; revisit `season_champion` as a truly distinctive **Pepe Pictures season winner**. Obtain owner art approval before code integration.
3. For candidates in `source/stamps-new`, perform spelling, scallops 7×8, grey rounded label, palette, transparent canvas and alpha edge checks. Check any embedded extra letters/logos against §6.
4. After acceptance, create the *minimal separate* integration PR: put final tiles into a new sprite, map only earned IDs, keep `PP_LILY` priority, and show `???` for not-yet-earnable stamps. Change from 5×4 to 4×3 only as a specifically reviewed UX change.
5. Do not treat `status: live` in `docs/meme/passport-catalog.json` as proof of deployed server awards. Owner's earlier server decision file and new spec v3 differ: main has **46** achievement entries (21 live, 25 planned), v3 describes **48 regular stamps** and a revised Rookie Miner/Happy Mining! rule. Editorial thresholds also changed. Claude needs a **separate backend/catalog reconciliation** before any award logic is advertised.
6. Do not merge #230's `detective_fren` alongside this one; #230 has five older draft concepts, four of which the v3 appendix lists as optional. Keep #231 as the authoritative design specification.
7. All future assets should live in one review stream, with one active PR per art set, and never change database migrations, authentication, supply, or prices as part of art work.

## Safety and project boundaries

This PR adds only art sources + review documents. No edits to `docs/meme/`, games/SQL, Supabase, real rewards, UI scripts or style sheets. No art is wired into live gameplay. This work is reversible and deliberately **Draft**.
