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
- Departure prompt set: sad Pepe carries a yellow suitcase; four alternating in-place movement poses per age. Tadpole moves its forefeet and tail, clothed frogs walk. Adult gets two additional pre-walk turning/pick-up poses. The matching adult packing state and departure show the suitcase on the viewer's left. `export-care.sh --depart` retains production filenames.
- Need/status prompt set: per stage, one reference idle (not exported) plus hungry (empty bowl), dirty (mud and fly), moody (frown), tired (drooping eyes), neglected (sad face), packing (yellow suitcase), recovering (forehead plaster). `export-care.sh --states` slices the 4×2 atlases and retains the approved original idle anchor.
- `preview.html` compares all four life stages and plays all twelve care animations at 200 ms per frame, hatching at 450 ms per frame, and all departure sequences at 250 ms per frame. It also displays the 21 need/status poses at the same logical size as the existing game. Use the comparison to inspect facial continuity and motion before replacing assets.
- `node validate-review.mjs` checks the exact filename set against `SPRITES`, `CARE`, and `WALK` from the current room renderer; RGBA dimensions, thresholded transparency, floor y=248, all preview paths, transitions and timing. It passes for the 91 proposed files. This does not run the browser or validate active room integration.

## Progress

| Scope | Status |
|---|---|
| Froglet character anchor | 1 exported PNG |
| Froglet feed, clean, play, rest | 4×4 exported PNGs, technical dimensions/anchors checked |
| Egg, tadpole and adult anchors | 3 exported PNGs, dimensions and anchors checked |
| Tadpole and adult feed, clean, play, rest | 8×4 exported PNGs, 32 new frames |
| Hatch | 4 exported PNGs, dimensions and anchors checked |
| Departure turn/walk for each stage | 14 exported PNGs (4+4+6) |
| Age-specific need/status expressions | 21 exported PNGs (7 per age) |
| Further idle activities / independent taskbar sprite refresh | Outside this room pack; optional follow-up |
| Review asset and animation sequence QA | PASS: 91 matching files, correct dimensions/alpha/anchors, all in-preview sequences and timings |
| Integration / browser QA | Pending owner visual approval; the old 128px/2×2 QA must be adapted for 256px room art without changing the taskbar format |

No replacement of active files until the complete pack can be checked for a consistent visual transition between idle, need/status and care states. Do not merge or deploy without the owner's explicit approval.

## Room and duckling refresh

The owner asked for a modest room/bed refinement and a duck inspired by the supplied photo of a yellow duckling with a fluffy crest. Generated using the same built-in image generation workflow, with the existing room as the edit target and the photo, original duck sprite and approved froglet as references. The room prompt locks all furniture, window and rug coordinates; improves padded blue bed, cream cushion, folded blanket, wood grain, night lighting and wallpaper definition. The duck prompt specifies a compact yellow plush-like duckling, spiky tuft, tilted head, orange bill and webbed feet, fine angular pixel art, transparent background.

- `room/room_pond_den_v1.png`: 640×400 opaque background, optimized indexed PNG; same aspect ratio and logical geometry.
- `room/rubber_duck.png`: 256×256 RGBA, visible bounding box 117×184 at (68,36); bottom y=220 preserves the former 110/128 logical foot line. Existing item ID, slot, size and interaction are unchanged.
- `room-preview.html`: original game renderer, two rooms, all four stage selectors; only proposed background, duck and frog image sources replaced in the review. Original Golden Foot painting (`p_poster.png`) and all other starter props are retained without changes.
- `room/preview.png`: static composition with the original roomScene coordinates and the proposed images; visual review at double logical size. The browser runtime could not launch in the current environment, so this is geometry-based composition, not a browser screenshot.
- Existing room static/window/interactions tests: 24 passed. No active assets, game logic or SQL changed.
