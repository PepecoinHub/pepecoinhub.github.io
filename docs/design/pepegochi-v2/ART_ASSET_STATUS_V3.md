# PepeGochi v2 — Asset Pack v3: art prototype / QA / Claude handoff

**Status: DRAFT, visuals only. No production-ready artwork claim and no production changes.**
**Date:** 2026-11-07
**PR:** #219 (visual documentation); related #216 (story), #217 (tech), #186 (prior backend).

## Current deliverables

The owner can download `PepeGochi_v2_Asset_Pack_v3.zip` from the shared ChatGPT Library folder **PepeGochi v2**.

It contains:
- 7 unchanged full-resolution source sprite candidates plus normalized alpha 128×128 PNGs (adult idle, hungry, neglected, packing; egg, tadpole, froglet).
- 4 room concept-reference variants (normal, slightly messy, neglected, packing), cropped from one generated art concept sheet and scaled to 640×400 for interactive visual playtests. A fifth clean **departed room** comes from the original full-quality 640×400 render.
- 4 × 4 animation storyboard frames (blink, eat, play, rest), **low resolution with light panel backgrounds**. They are not finished transparent spritesheets.
- `demo/PepeGochi_v3_local.html` (relative images) and `demo/PepeGochi_v3_standalone.html` (offline standalone) with separate layers for room/character/HUD, tabs, room selector, animation storyboard playback, sample care actions, sample 48/120/168-hour conditions, GOODBYE.TXT, gated read-letter -> adopt, memory of departed frens in the current JS session, and a visual-only Passport preview.
- `asset_manifest.json`, `QA_REPORT_V3.md`, browser results and screenshots.

## What actually passed

Chromium via Playwright, tested 2026-11-07 at 1280×900, 390×844 and 360×780:
- All 4 tabs accessible and 5 room states selectable.
- All 4 animation preview sets start and stop.
- 7-day sample time skip -> pet departs; adoption disabled until GOODBYE.TXT opened; new life after adoption and old pet in history.
- No horizontal overflow and no JS exceptions.

The demo intentionally stores nothing and never contacts Discord, Supabase or Passport. `care_days` counts and time skipping are intentionally illustrative, **not** authoritative game mechanics.

## Art QA / integration blockers

1. Room backgrounds cropped from concept thumbnails lack production resolution and include baked-in furniture. They cannot yet support player-owned, independently placed inventory decorations. They must be replaced by cohesive, properly drawn full-size rooms with separately supplied props.
2. Animation storyboards are non-transparent thumbnails, with some frame-to-frame inconsistencies. They are **not** integration-ready animation sprite sheets; artist must produce consistent transparent frames from the master adult character.
3. Current Hungry has baked-in bowl, Packing baked-in suitcase, and sprites include a purple floor shadow. Clean/re-export these as independent layers before final game integration.
4. The `egg` stage remains concept-only until its backend timing is approved.
5. Passport stamps, special avatars and item art shown on exploratory boards are not approved reward assets. Respect the existing Passport catalogue, artwork pipeline and `certified_fren` definition.
6. The official server implementation under PR A1/A2 must own departure time, care quality, recovery, milestones and anti-farming. **Never port the mock JS care counters into production.**
7. Do not include real PEP transfers, multiplier 1.5×, wallet features, or automatic crypto payouts.

## Owner review gates

- First: accept/adjust the room layout and readability at phone widths.
- Second: replace reference room art with 4 high-quality complete backgrounds and props; export true animation frames for 4 actions.
- Third: integrate only **approved** art into a hidden test route in a separate PR after backend is ready.
- Production migration, deployment, merge and live site publication all require explicit owner permission.

**No SQL, code for the running site, or actual prizes changed as a result of this art documentation.**
