# PepeGochi v5: Layered Room & Collectible Editor

**Status:** local art/interaction prototype. **Not** production backend, SQL or confirmed asset approval.

## Open the prototype

Open `room_v5_standalone.html` in any modern browser. It is an **offline, self-contained** HTML file: the room background, eight prop sprites and PepeGochi sprite are embedded as image data. The other files are editable sources and standalone PNG exports.

1. Select an owned decoration in INVENTORY.EXE.
2. Select a glowing compatible place in the room. Selecting an occupied place **without** an item returns its item to the collection, it does not delete it.
3. Try two illustrative gifts: floppy disk and paper crown. This is a **simulation**, never a real achievement.
4. Simulate departure. The room hides exactly one eligible placed item and shows a letter; ownership and placement records stay unchanged.
5. Read `GOODBYE.TXT`, adopt again, and observe that the previously taken item returns.

## Regeneration from GitHub

The GitHub PR contains **all 10 PNGs as separate versioned files** under `assets/`, as well as a standalone HTML with the exact PNG data embedded. `python extract_embedded_assets.py` is an optional recovery route if an asset is accidentally lost; no chat ZIP is needed. Install Pillow if you want to regenerate the original procedural sprite candidates (`python -m pip install Pillow`). Next run `python build_assets.py` and `python build_html.py` if you want to rebuild the demo. The local automated test is `node --test room_core.test.mjs`; browser QA uses Playwright plus Chromium.

## Source of truth

- `room_core.mjs`: pure local-only model with 30 Node tests (`node --test room_core.test.mjs`).
- `build_assets.py`: original transparent pixel-art sources generated procedurally with Pillow, no AI composite cropping; recreates exactly the 640×400 clean base and eight 128×128 transparent prop sprites. 
- `room_v5_template.html`: editable HTML, CSS and UI shell, compiled by `build_html.py`.
- `room_v5_standalone.html`: compiled offline demo; the key file for sharing with the art/programming team.
- `ART_MANIFEST.json`: dimensions, file paths, bounds and alpha notes. These are concept/functional assets only.
- `browser_qa_v5.json`: Chromium tests 1280, 390 and 360 px; art independence, placement, gift simulation, departure, letter gate, restoration and no network requests.
- `qa_departure_tv.py`: forced TV departure, verifies the **TV PNG disappears while the unchanged base room stays visible**; the letter mentions TV and new adoption restores it.

## Output files

`assets/room_clean_base.png` is a 640×400 opaque scene with the fixed room geometry: walls, pond-facing window, shelf, bed, dresser, TV stand, table and rug. **No removable decor is painted into that file.**

Each of the following is its own **128×128 RGBA PNG** with transparent pixels outside the object:

- `crt_tv.png`
- `lava_lamp.png`
- `potted_plant.png`
- `p_poster.png`
- `rubber_duck.png`
- `mug.png`
- `floppy_disk.png`
- `paper_crown.png`

`moon_rock` and `lost_pond_artifact` deliberately have **no collectible art/award** yet. The owner must approve a verifiable server-side unlock first.

## Design / production notes

- Room authored in 320×200 pixel art and exported nearest-neighbor to 640×400. Current proportions and placements are candidate art, not the final hand-painted pack.
- This v5 prototype shifts the logical `floor_left` anchor to **(170,345)** so the plant stands *beside* the fixed dresser instead of being painted over the drawers. The #219 room architecture doc originally proposed (95,331); only the pixel anchor changes, never slot ID or allowed categories. Final anchors to be agreed with the art team.
- Fixed bed, dresser, shelf and rug are in background; future customization of those pieces would require promoting them to separate layers too. Current scope is **player collectibles and moveable decoration props**.
- Never read/write game state from this JS in production. #218/#221 backend schema remains authoritative for pet state. A separate Room-2 draft should implement account-bound inventory, optimistic revision checks, permission gating, and idempotent trusted award hooks on a staging database.
- The room preview operates in memory only, no `fetch`, storage, WebSocket or Supabase connection. Reload resets its example contents.
- The TV/lamp/poster/duck/mug/plant are eligible for **visual** departure; floppy and crown are protected. Existing badges, stamps, avatars and collected items survive. No PEP transactions, 1.5× multiplier or wallet integration.

**No production SQL executed and no site published or PR merged.**