# PepeGochi Pixel Sprite Pack v2

**Status:** source art follows the user's accepted 2026-11-07 visual direction; production export is a **candidate**, not deployed.

## Design contract
Pixel art, clearly visible pixels, limited green palette, dark green outlines, Windows 98/PondOS 98 nostalgia, expressive Pepe eyes, adult blue hoodie with white P. Keep all character expressions as one recognizable frog. No HUD/text on character PNG.

## Contents
- `sprites/`: 12 normalized 128x128 transparent sprites, anchored at bottom y=124, includes egg/tadpole/froglet/adult and emotional states. `froglet` reuses the old v1 candidate until revised art is approved.
- `animations/`: six 128x128 separate frames + `depart_sheet.png` for moving-out animation. `previews/departure_preview.gif` shows animation and is not the canonical sequence for code.
- `props/`: suitcase, envelope, open letter, plus transparent 640x400 `room_departed_overlay.png` with letter on floor. DO NOT paint props into `room_clean_base.png`.
- `source/`: full-resolution originals. Preserve untouched for rework.
- `previews/`: overview plus schematic. The schematic room is only explanatory; **use the actual existing 640×400 room from PR #222 in the game**.

## Exact integration instructions for Claude
1. `pepegochi_adult_idle` etc. are unchanged semantic ids across the game; old `art-pack-v1` in PR #226 is superseded by this v2 candidate.
2. Render pet as a separate layer on room #222. CSS use `image-rendering: pixelated`; keep per-sprite foot anchor stable at y=124; no smoothing/downsample at runtime.
3. On `packing`, render `pepegochi_adult_packing` with P hoodie, optionally show the 6-frame `depart` only after server transition; do not pretend departure is a death.
4. On `departed`, **hide the frog** (do not replace whole room), leave owned decor intact, hide exactly one eligible decor item only visually, draw `goodbye_envelope.png` at a clickable room slot (overlay provided for test), open `GOODBYE.TXT` in a Notepad-like program window.
5. Keep all item ids in existing v5 `ART_MANIFEST.json` unchanged: `crt_tv`, `mug`, `rubber_duck`, etc.; this art pack adds only pet and scene assets.
6. No publication, SQL migrations, or production Supabase writes. Preview in a separate draft branch, and compare body proportions and scale in room at 360px width before approval.
7. The image `pokój_pożegnań_o_zachodzie_słońca.png` is a conceptual illustration with furniture baked into it, so do NOT use it as the production room; that would break layered customization.

## QA performed
- All delivered 128x128 sprites checked for RGBA dimensions, transparent margins and consistent bottom anchor.
- 6 animation frames checked individually; GIF source remains for editable reference.
- Exact room item ids preserved; 640x400 departure overlay is transparent.
- Visual mismatch not hidden: recovering and alternate angry packing need later pixel-art cleanup; rendered froglet is an earlier candidate.
