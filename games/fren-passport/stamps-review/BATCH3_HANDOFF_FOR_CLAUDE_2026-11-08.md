# Fren Passport stamp art v3 — Batch 3 first drafts, 2026-11-08

**Source of truth:** [PR #231](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/231), `games/fren-passport/STAMP_ART_SPEC_FOR_GPT.md`.

**Scope:** only stamps. Owner explicitly paused all special avatar work. Do not edit Avatar Maker, special avatars, existing Lily art, achievements, SQL, or production logic.

## Three source cutouts (WIP)

| ID | File | Native px | Scene | Pending detail |
|---|---|---:|---|---|
| `i_voted` | `games/fren-passport/stamps-review/art-v3-batch3-wip/i_voted.png` | 384×342 | Pepe deposits a ballot with check into a ballot box | Yellow background and chest check sticker |
| `top_ten` | `games/fren-passport/stamps-review/art-v3-batch3-wip/top_ten.png` | 384×344 | Pepe proud of leaderboard place | Light green background, highlighted Win98 row with gold star, ribbon with 10 |
| `bug_hunter` | `games/fren-passport/stamps-review/art-v3-batch3-wip/bug_hunter.png` | 384×344 | Explorer investigates a bug shown on retro computer | Yellow background, butterfly net, beetle with !, small Win98 error window |

These are **separate real RGBA PNG files**, **not complete finished stamps**. They were cut from illustration sheets that generated extra unauthorized badge names; none of the unrelated images were added to this PR. The `i_voted` title was corrected exactly on its plaque with a precise text overlay.

Because their native pixel dimensions are below 900px, do **not** enlarge and present them as full-resolution originals. They do not yet fulfill every visual card requirement. Keep them solely in the review folder.

Preview of all three beside accepted reference stamps: `games/fren-passport/stamps-review/art-v3-batch3-review.png`. 138×150 source preview tiles are available in the external review ZIP, not connected to production.

## Next actions for ChatGPT + Claude

- Finish and redraw the three at v3-native resolution, keeping original stamp proportions and cream scalloped border with rounded grey title plaque; check 34px / 52px / 78px.
- The remaining Batch 3 IDs are `yeet_adept`, `good_game`, `checkmate`, `podium`, `game_night`, `arcade_hopper`, `quiz_master`, `fud_buster`, `long_snake`.
- Maintain single art Draft PR #233; keep art review and any code integration as separate tasks. Never merge without explicit owner approval.
