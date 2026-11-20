# PepeGochi room sprite refresh — approved style (2026-11-20)

The owner approved the intermediate art direction and the late-1990s room: finer pixel art with slightly angular, dark outlines, but not the old coarse 2×2 grid and not smooth/rounded vector art. The room's furniture layout and palette stay unchanged. The approved artwork is now integrated in the **draft** branch, not deployed; legacy 128×128 assets and the taskbar remain untouched.

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
| Integration / browser QA | Owner approved; HD artwork wired into the local simulator and live-page renderer on the draft branch. Room-specific QA adapted; Chromium fixture checks in CI (pending latest run). |

Do not merge or deploy without the owner's explicit approval.

## Room and duckling refresh

The owner asked for a modest room/bed refinement and a duck inspired by the supplied photo of a yellow duckling with a fluffy crest. Generated using the same built-in image generation workflow, with the existing room as the edit target and the photo, original duck sprite and approved froglet as references. The room prompt locks all furniture, window and rug coordinates; improves padded blue bed, cream cushion, folded blanket, wood grain, night lighting and wallpaper definition. The duck prompt specifies a compact yellow plush-like duckling, spiky tuft, tilted head, orange bill and webbed feet, fine angular pixel art, transparent background.

- `room/room_pond_den_v1.png`: 640×400 opaque background, optimized indexed PNG; same aspect ratio and logical geometry.
- `room/rubber_duck.png`: 256×256 RGBA, visible bounding box 117×184 at (68,36); bottom y=220 preserves the former 110/128 logical foot line. Existing item ID, slot, size and interaction are unchanged.
- `room-preview.html`: original game renderer, two rooms, all four stage selectors, starter/full Passport decoration toggle. Original Golden Foot painting (`p_poster.png`) remains unchanged; only image sources for the other room items, background and frog are replaced in the review.
- `room/preview.png`: static composition with the original roomScene coordinates and the proposed images; visual review at double logical size. The browser runtime could not launch in the current environment, so this is geometry-based composition, not a browser screenshot.
- Existing room static/window/interactions tests: 24 passed. No active assets, game logic or SQL changed.

## Late-1990s room props

All eight remaining items have individually generated, finer pixel-art replacements, maintaining the original room placement and identity. The CRT television now has a convex 4:3 glass screen, bulky gray-purple chassis, rabbit-ear antenna, physical knobs, speaker grille and green price-chart display. The lime lava lamp, terracotta plant and red Comfy mug are visually refined. The four Passport rewards (moon rock, paper crown, Golden Fly, blue 3.5-inch floppy disk) are refreshed to match.

- `export-props.sh ITEM SOURCE.png` fits the generated transparent silhouette into the old prop's doubled alpha bounds, preserving aspect ratio, horizontal center, and bottom anchor (vertical center for the wall-mounted Golden Fly). Outputs 256×256 RGBA to `room/ITEM.png`.
- The full-room composition includes all ten items at their real `roomScene` coordinates. Rewards retain their existing unlock rules. No production item IDs, slots, renderer, scaling, reward behavior or original painting are changed.

## Approved draft integration

- The runtime loads 91 character/animation frames, nine props and the 640×400 background from `docs/games/img/pepegochi/hd/`; these are byte-identical to the review assets. The dirty tadpole was re-exported from its original atlas with a 7px left margin so the fly is not clipped. The original painting, letter, suitcase, legacy fallback and taskbar sprites remain in their original paths.
- Logical geometry is unchanged. Sprite and prop hitboxes use the 30% alpha bounds divided by two; bubbles clear the actual sprite top. The HD art profile verifies RGBA, resolution, floor, bounds, colour cap and alpha-fringe limits without loosening any original 128px or taskbar rules.
- The local test page uses the same renderer, click controller, care and hatch animations as the live page, but only the isolated local rules model. No production calls or rewards. Both pages preload the current stage's animation frames rather than the entire pack.
- Local validation: all PepeGochi tests pass (130 pass, 7 environment-dependent skips), static site checks and the 91-frame validator pass. The full site suite had two unrelated Haze test-file failures caused by missing local `@noble/curves` (CI installs the locked dependency). New Chromium assertions check actual HD dimensions, four stages, all four rest frames, offline simulator clicks and existing interaction behavior. Full run and real-account test still pending.

## Lemon tree and Pepe novelty table lamp

- Owner reference: yellow Pepe-faced lemon hanging among existing plant leaves; the green glass Pepe vessel is reimagined as an electric novelty lamp with a cream fringed fabric shade that covers its top. Image generation used the existing plant and room sprites as pixel-art style references. No other art or the Golden Foot painting changed.
- `room/potted_plant.png` and `room/pepe_table_lamp.png` are 256×256 transparent PNGs, copied to the active `docs/games/img/pepegochi/hd/` folder. The plant retains its slot, bottom anchor and water interaction; the updated alpha bounds track actual foliage. The lamp is a fixed architectural prop on the left dresser, not a new owned item or reward. It dims with room lights. No server or inventory change.
- Run `node games/pepegochi/hd-review/render-room-preview.mjs` from the repository root to recreate the full-room static composition in `room/preview.png`. The side-by-side HTML preview also includes the new assets in the refined room only. All files are available directly in the shared draft PR for Claude.
