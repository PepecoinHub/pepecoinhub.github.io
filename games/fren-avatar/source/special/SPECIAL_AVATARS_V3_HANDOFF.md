# Fren Passport v3 – Four special avatars / Claude-Kiro handoff

**Date:** 2026-11-08. **Art-review-only** within Draft PR #233. Source of truth: approved [PR #231](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/231), §10.

## Assets

| Asset ID | Unlock achievement ID | PNG source | Editable source |
|---|---|---|---|
| `special_yeet_pilot` | `moonwalker` | `games/fren-avatar/source/special/special_yeet_pilot.png` | `games/fren-avatar/source/special/special_yeet_pilot.svg` |
| `special_graduate` | `certified_fren` | `games/fren-avatar/source/special/special_graduate.png` | `games/fren-avatar/source/special/special_graduate.svg` |
| `special_parent` | `good_parent` | `games/fren-avatar/source/special/special_parent.png` | `games/fren-avatar/source/special/special_parent.svg` |
| `special_archivist` | `the_secret_pond` | `games/fren-avatar/source/special/special_archivist.png` | `games/fren-avatar/source/special/special_archivist.svg` |

All four 1024×1024 PNGs are real RGBA files with transparency, on matching 512×512 SVG geometry. They depict the same classic olive Pepe head/shoulders and are drawn in flat color with thick strokes, no background or text, so the selected Avatar Maker background remains visible. The Special portrait is a complete overlay (normal hat/clothing/mouth/eyes should not show on top of it).

## Design content

- `special_yeet_pilot`: red crash helmet, raised goggles, moon dust, blue T-shirt, thumbs up. Not the previous brown aviator costume and not an astronaut.
- `special_graduate`: black mortarboard/yellow tassel, black gown, rolled diploma with a red ribbon.
- `special_parent`: apron straps and small froglet held to the chest. No floating hearts.
- `special_archivist`: round reading glasses, cardigan, floppy disk, old rolled-up map.

## Review status

These are **new art candidates**, not yet owner-approved or checked inside the live Avatar Maker. The source example `games/fren-avatar/source/special/explorer-pepe-original.png` should be compared visually before integration. Flat SVG portraits may require further art polish to match Lily's exact stroke weight and appearance. Do not misrepresent them as already production tested.

Review previews:
- `games/fren-passport/stamps-review/special-avatars-v3-overview.png`
- `games/fren-passport/stamps-review/special-avatars-small-size-test.png`

Technical QA completed locally: 4 unique real files, each PNG 1024×1024 RGBA, transparent corner/background, valid SVG source, scale tests at 64px/128px. **No browser tests yet.**

## Claude/Kiro implementation plan (later separate code PR)

1. First ask owner to review these four portraits, and compare side-by-side with **Lily's Explorer Pepe**. Do not replace or change the Explorer original or Bat-Pepe (owner-only).
2. Check existing Special row / Passport photo overlay logic, and map these file IDs to only their real server-verified achievement IDs above. The background selected by user must remain visible.
3. Never enable a planned achievement merely because art exists. Verify catalogue reconciliation first: `main` still has 46 achievements while v3 describes 48 ordinary stamps plus BALI.
4. Test light/dark and 360px phone view, including 64px Passport photo circle, with each layer combination and no overlaps. Verify no accessory remains visible above the special overlay.
5. Integrate approved portraits in an independent reviewed code PR. No SQL, Supabase, user grants, NFT, PEP payouts or production edits in this art PR.

## Safeguards

Everything is art/metadata only. Draft PR #233 stays unmerged until authorized by the owner.