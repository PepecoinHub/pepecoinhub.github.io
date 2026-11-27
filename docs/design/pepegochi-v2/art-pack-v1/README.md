# PepeGochi Art Pack v1 - review candidate

Prepared from the illustrations already generated in the PepecoinHub ChatGPT conversation (2026-11-07). **Not yet approved for deployment.**

## Contents

- `source/`: 10 unmodified, high-resolution, transparent PNG originals.
- `sprites/`: 128x128 RGBA character states, prop composite, and 16 individual action frames.
- `sprites_256/`: the same exports at 256x256 for refinement.
- `animations/`: four transparent 512x128 horizontal sprite sheets.
- `previews/`: labeled overview and 4 looping GIFs for visual QA only.
- `ART_MANIFEST.json`: deterministic paths, animations, sizes and anchors.

## Integration contract

The current #222 room prototype uses 640x400 room art and 128x128 transparent item sprites. Do **not** rename or overwrite existing IDs: `crt_tv`, `mug`, `lava_lamp`, `potted_plant`, `p_poster`, `rubber_duck`, `floppy_disk`, `paper_crown`.

The character-state files are intentionally prefixed `pepegochi_`. `feed`, `clean`, `play`, `rest` match the SQL action IDs (the user-facing action `rest` may be called sleep). Place a frame at the same x/y for all frames within one action animation; no CSS crop calculations required. Suggested animation rate 260 ms/frame.

**Do not accidentally substitute the art-pack's character PNG for the #222 existing approved candidate** until the owner compares them side by side. The drawings in this package are smooth/cel-shaded, unlike the pixel-art room. This is a significant style mismatch; accept, pixel-art-redraw, or reject before release. The rough inked edges are original image artifacts and may need sprite cleanup.

`goodbye_suitcase_letter` is a composite placeholder (suitcase and note are joined in the artwork). It is **not** two freely movable independent objects. An independent clickable envelope/letter sprite still needs art approval; GOODBYE.TXT actual body text belongs in an accessible HTML window, not baked into the PNG.

No real rewards, database grants, asset ownership changes or production release are authorized by this art pack.