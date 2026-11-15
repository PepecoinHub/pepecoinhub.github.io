# Fren Passport v3 — Batch 2 handoff for Claude / Kiro

**Art-only draft, no production changes.** Source of truth: PR #231 `games/fren-passport/STAMP_ART_SPEC_FOR_GPT.md`.

## Files
- `art-v3-wip/like_it_here.png`: stamp labeled **30-Day Streak**, 251×438 RGBA; 30 consecutive PondOS visits, not PepeGochi care. Scene currently features retro laptop, calendar and cheerful Pepe, green background. It is only a **concept**: v3 instead requests armchair, slippers, neckerchief, mug and beige CRT. Native source is below 900 px.
- `art-v3-wip/nasa_is_hiring.png`: **NASA Is Hiring**, 1173×1341 RGBA; composite of owner-approved YEET pilot in red helmet/goggles and blue shirt, 5000m altitude sign, poster with rocket and three green ticks, curve of Earth, royal blue sky. No NASA logo, spacesuit, or Moon close-up. This is **not production-final**; visual joins and 34–78px legibility need review.
- `art-v3-wip/happy_mining_label_only.png`: optional transparent **Happy Mining!** label, not a complete stamp. Preserve the original Lily Rookie Miner illustration and change only its text in the build if possible.
- `art-v3-batch2-review.png`: overview preview of two stamp candidates plus label.
- `BATCH2_MANIFEST_2026-11-08.json`: exact source paths, native dimensions and states.

## Approved first batch
The owner approved **all 10 main-page stamp illustrations** on 2026-11-08 with **no further visual corrections** requested. Four current PNGs are lower resolution than the v3 spec; do not confuse visual approval with source qualification or production integration. Do not redraw accepted scenes merely to change their content.

## Award rule caution
The v3 `rookie_miner` / **Happy Mining!** rule becomes the first Pepe Miner cloud save. It replaces the earlier separate miner milestones. Art PR does **not** change server awards; Claude must independently reconcile with current `main` catalog and migration, without automatically enabling planned grants.

## QA / next steps
1. Review Batch 2 art with owner.
2. Improve any candidate that is incomplete, only if needed for approval; obtain native 900+px files before treating as production-ready.
3. Preserve Lily illustrations. Never replace the whole miner artwork for a label change.
4. Integrate accepted assets only in a separate code PR, test at 34/52/64/78px and both themes, and maintain `???` state for unearned or unimplemented achievements.
5. Do not merge this Draft PR without owner permission.
