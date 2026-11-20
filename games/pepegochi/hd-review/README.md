# PepeGochi room sprite refresh — approved style (2026-11-20)

The owner approved the intermediate art direction: finer pixel art with slightly angular, dark outlines, but not the old coarse 2×2 grid and not smooth/rounded vector art. The room's furniture, background, layout and palette stay unchanged. This is a **review-only** pack, not deployed art; the existing 128×128 game and taskbar assets remain untouched.

## Master prompt / art direction

> The same recognizable Pepe meme frog, subtle half-lidded eyes, angular cheeks, orange-red lips, expressive poses, green skin, deep blue hoodie with its white P and brown shorts (froglet and adult only). Fine late-1990s 2D game sprite artwork with crisp small pixels, a deliberate stepped silhouette, and two or three main shading levels. Avoid coarse blocks, round vector contours, shiny 3D or a generic cute frog. Preserve proportions, clothing, age differences, viewing angle, feet and pose anchors. Froglet has a tail; adult does not. Transparent PNG, no room or scenery, no artificial ground shadow. Each animation frame must match the exact same character and size; only its movement/expression changes.

## Format and integration

- 256×256 RGBA pixels per room sprite, drawn at the existing 128×128 logical room size. This doubles source resolution without doubling character size in the room. Taskbar assets stay separate and low-resolution.
- Multiply prior canvas anchors by two when exporting. Froglet: visible height 188 physical pixels, bottom exclusive y=248, foot center near x=128. Existing logical top=30, foot y=124. Keep animation timing and server mechanics unchanged.
- `export-frames.sh` cuts the image-generated four-frame atlases, aligns the frames by feet and exports them as transparent PNGs. The source is the approved room appearance, with a separately generated character anchor and four motion atlases. Generated using the built-in image generation tool; no production files modified.
- `export-stages.sh` exports the egg, tadpole, adult and four hatch frames to the same double-resolution canvas, preserving each stage's logical height and shared floor anchor; the egg idle duplicates the first hatch frame. Tadpole has no clothing and a long tail; adult has the same hoodie and shorts as froglet but has a broad head, short feet and no tail. Hatch transitions from intact spotted shell through cracking and emerging to the tadpole with shell fragments.
- `export-care.sh` cuts the eight additional care atlases; uses the green skin silhouette to retain the reference character size despite changing bubbles, toys, bowls and sleep effects. The full colored alpha bounds sit on the original floor line. Slight scale reduction is allowed to contain props.
- Care prompt set: feed (bowl of flies, eat, chew, empty bowl), clean (soap, scrub, foam, sparkle), play (tricolor ball, toss, bounce, catch), rest (yawn, close eyes, one Z, two Zs). One 2×2 atlas per action and stage, matching the stage's approved reference and the master prompt. Generated with the built-in image generation tool.
- `preview.html` compares all four life stages and plays all twelve care animations at 200 ms per frame plus hatching at 450 ms per frame, using the current and proposed sprites at the same logical size. Use the comparison to inspect facial continuity and motion before replacing assets.

## Progress

| Scope | Status |
|---|---|
| Froglet character anchor | 1 exported PNG |
| Froglet feed, clean, play, rest | 4×4 exported PNGs, technical dimensions/anchors checked |
| Egg, tadpole and adult anchors | 3 exported PNGs, dimensions and anchors checked |
| Tadpole and adult feed, clean, play, rest | 8×4 exported PNGs, 32 new frames |
| Hatch | 4 exported PNGs, dimensions and anchors checked |
| Departure turn/walk for each stage | Pending |
| Additional age-specific expressions and idle activities | Pending |
| Integration / browser and animation QA | Pending until complete pack; no production deployment |

No replacement of active files until the complete pack can be checked for a consistent visual transition between idle, need/status and care states. Do not merge or deploy without the owner's explicit approval.
