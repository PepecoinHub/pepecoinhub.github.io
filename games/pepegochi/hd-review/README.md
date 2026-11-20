# PepeGochi room sprite refresh — approved style (2026-11-20)

The owner approved the intermediate art direction: finer pixel art with slightly angular, dark outlines, but not the old coarse 2×2 grid and not smooth/rounded vector art. The room's furniture, background, layout and palette stay unchanged. This is a **review-only** pack, not deployed art; the existing 128×128 game and taskbar assets remain untouched.

## Master prompt / art direction

> The same recognizable Pepe meme frog, subtle half-lidded eyes, angular cheeks, orange-red lips, expressive poses, green skin, deep blue hoodie with its white P and brown shorts (froglet and adult only). Fine late-1990s 2D game sprite artwork with crisp small pixels, a deliberate stepped silhouette, and two or three main shading levels. Avoid coarse blocks, round vector contours, shiny 3D or a generic cute frog. Preserve proportions, clothing, age differences, viewing angle, feet and pose anchors. Froglet has a tail; adult does not. Transparent PNG, no room or scenery, no artificial ground shadow. Each animation frame must match the exact same character and size; only its movement/expression changes.

## Format and integration

- 256×256 RGBA pixels per room sprite, drawn at the existing 128×128 logical room size. This doubles source resolution without doubling character size in the room. Taskbar assets stay separate and low-resolution.
- Multiply prior canvas anchors by two when exporting. Froglet: visible height 188 physical pixels, bottom exclusive y=248, foot center near x=128. Existing logical top=30, foot y=124. Keep animation timing and server mechanics unchanged.
- `export-frames.sh` cuts the image-generated four-frame atlases, aligns the frames by feet and exports them as transparent PNGs. The source is the approved room appearance, with a separately generated character anchor and four motion atlases. Generated using the built-in image generation tool; no production files modified.
- `preview.html` plays the four actual PNG sequences at the production 200 ms cadence, comparing the current and proposed sprite at the same logical size. Use the comparison to inspect facial continuity and motion before replacing assets.

## Progress

| Scope | Status |
|---|---|
| Froglet character anchor | 1 exported PNG |
| Froglet feed, clean, play, rest | 4×4 exported PNGs, technical dimensions/anchors checked |
| Tadpole and adult anchor, all remaining states | Pending; match approved style, keep distinct age silhouettes |
| Tadpole and adult feed, clean, play, rest | Pending |
| Hatch; departure turn/walk for each stage | Pending |
| Additional age-specific expressions and idle activities | Pending |
| Integration / browser and animation QA | Pending until complete pack; no production deployment |

No replacement of active files until the complete pack can be checked for a consistent visual transition between idle, need/status and care states. Do not merge or deploy without the owner's explicit approval.
