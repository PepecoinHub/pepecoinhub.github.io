# Batch 2 stamp art: owner-favorite style match

Source spec: [PR #231](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/231), §9 Batch 2. This is a **visual-only follow-up** in [Draft PR #233](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/233).

## New preferred candidates
- `games/fren-passport/source/stamps-new/like_it_here.png` (1173×1341 RGBA, label **30-Day Streak**). Pepe relaxes in an armchair with PondOS computer, calendar 30, mug and slippers. This represents 30 consecutive *PondOS visits*, **not** 30-day PepeGochi care.
- `games/fren-passport/source/stamps-new/nasa_is_hiring.png` (1173×1341 RGBA, label **NASA Is Hiring**). Uses the real YEET pilot (red helmet and goggles, blue shirt, grey shorts, red sneakers) with altitude 5000 m and three checkmarks. No astronaut suit, no NASA logo.
- Review board: `games/fren-passport/stamps-review/art-v3-batch2-style-matched.png` compares both with approved **Frog of the Week** and **Moonwalker** at large, 78px and 52px.

These retouches primarily harmonize cream paper and warm-grey labels to match the already accepted art. They preserve the original composition and imperfect hand-drawn style. Unlike exploratory generator attempts, **neither has an astronaut outfit**.

## Supersession / constraints
Earlier `games/fren-passport/stamps-review/art-v3-wip/like_it_here.png` and `nasa_is_hiring.png` are **superseded WIP sketches**. Do not select them for integration. New drawings are in `source/stamps-new`, but their art must still be user-approved and checked in a real browser before any deployment.

Do not modify `rookie_miner` Lily artwork: the third Batch 2 action is **Happy Mining!** title replacement only (see PR #231; pending separate logic migration). No backend, no award grants, no special avatars.

## Claude / Kiro instructions
1. Show owner the comparison board and both PNGs. If accepted, treat these as the canonical Batch 2 art sources.
2. Export 138×150 tiles and lossless WebP sprite from these files; check 34–78px legibility.
3. Preserve existing Lily art; do not show a reward as earnable just because a file exists.
4. Integrate through a separate minimal code PR after catalog/Supabase rule reconciliation and owner permission.
