# Fren Passport — audit of stamp art (2026-11-07)

**Status:** read-only catalog/style audit plus **five new draft stamp illustrations**. No passport code changed, no stamp awarded, no production SQL or deployment.

## Verified sources

- `docs/meme/passport-catalog.json` lists **46 achievements**: 21 `live` and 25 `planned` in the catalog; `live` in this catalog **does not by itself prove production database deployment**.
- `scripts/build_lily_stamps.mjs` contains a `LILY` map for 15 stamps, of which **12** belong to live catalog achievements and **3** to planned PepeGochi milestones. Their existing images are in `games/fren-passport/source/stamps-lily/` and rendered as `docs/meme/passport-assets/stamps-lily.webp`.
- `docs/meme/meme.js` `PP_LILY` maps those IDs to existing Lily artwork, otherwise it falls back to category-specific drawings from the legacy `stamps.webp` strip. **No live stamp is necessarily visually blank**, but nine have no dedicated Lily illustration.
- `docs/meme/passport.css` renders the Lily strip with `.pp-art-stamp.is-lily { background-size:1500% 100%; }` at 46px in the main slot and a slightly different size in subviews.

## 12 live stamps with Lily's current dedicated artwork

`pond_pioneer`, `welcome_back`, `pepe_guesser`, `week_scout`, `scout_fren`, `first_words`, `hey_fren`, `dear_editor`, `junior_editor`, `senior_editor`, `rookie_miner`, `streak_14`.

Three more Lily art tiles are ready for *planned* PepeGochi milestones: `first_hatch`, `little_fren`, `grown_fren` (One Small Step). Do not make these awards live merely because art exists.

## 9 live stamps using older/fallback drawings

| Achievement ID | Label | New dedicated art | Status |
| --- | --- | --- | --- |
| `first_fren` | First Fren | Frog at vintage desktop, waving | Candidate PNG v1 |
| `first_avatar` | Fresh Fren | Frog drawing its avatar | Candidate PNG v1 |
| `sharp_eye` | Sharp Eye | Magnifying glass and bullseye | Candidate PNG v1 |
| `detective_fren` | Detective Fren | Frog detective with paw-print clues | Candidate PNG v1 |
| `community_fren` | Community Fren | Three friends and chat bubbles | Candidate PNG v1 |
| `like_it_here` | Guess You Like It Here | Thirty-day PondOS return motif | Not yet drawn |
| `miner_fren` | Miner Fren | Miner achievement (1-hour mining), not Rookie Miner | Not yet drawn |
| `nasa_is_hiring` | NASA Is Hiring | Three successful >5000 m YEET flights | Not yet drawn |
| `moonwalker` | Moonwalker | Exact 6000 m YEET destination | Not yet drawn |

## New art pack v1 (five candidates)

- Full-resolution transparent PNG: `games/fren-passport/source/stamps-custom-v1/<id>.png` (432×496).
- Individual atlas-ready tiles: `games/fren-passport/source/stamps-custom-v1/tiles/<id>.png` (138×150).
- WebP single-row atlas: `docs/meme/passport-assets/stamps-custom-v1.webp` (690×150), lossless with alpha, five tiles.
- QA preview: `games/fren-passport/stamps-review/stamps-custom-v1-overview.png`.
- Machine-readable map: `docs/design/fren-passport/STAMPS_CUSTOM_V1_MANIFEST.json`.

**Artist attribution:** these five new images are ChatGPT/AI-assisted concepts, **not Lily's original drawings**. They aim to complement her existing stamps; her original 15 stamp designs remain untouched. Final stylistic acceptance requires owner's approval in the real Passport.

## Integration contract for Claude, only after owner accepts artwork

1. Leave `PP_LILY` and `scripts/build_lily_stamps.mjs` untouched, retaining the original 15 Lily entries and all gameplay/award rules.
2. Optionally define `PP_CUSTOM = ['first_fren','first_avatar','sharp_eye','detective_fren','community_fren']`, ordered like the atlas.
3. In `ppStamp(x, earned)`, **after** the Lily branch, add `if (earned && PP_CUSTOM.includes(x.id)) return ppSprite('pp-art pp-art-stamp is-custom', PP_CUSTOM, x.id)`. The `earned` guard is mandatory; locked stamps must still show `???`.
4. In `passport.css`, add `.pp-art-stamp.is-custom {background-image:url(passport-assets/stamps-custom-v1.webp?v=20261107a);background-size:500% 100%;}`. Test at original 46px plus 34px in list and 52px in stamp view.
5. Do NOT modify catalog achievement rules, award SQL, Discord verification, `Pond Pioneer` launch snapshot, or any PepeGochi rewards.
6. After approval, test visual alignment with original Lily stamps on mobile and desktop, including locked placeholders and performance. Then open a separate integration PR; do not merge this artwork PR as a functional implementation.

## Future artwork priority

Finish the remaining **four dedicated live stamp designs** above, then audit the eight planned Collection icons against existing room-v5 assets. Avoid drawing 25 planned achievements as if they were already unlockable; prioritize only confirmed server-verifiable mechanics.
