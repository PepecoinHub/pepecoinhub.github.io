# PepeGochi v2 — Room Architecture v1

**Status:** DRAFT DESIGN / no production SQL or rollout. **Owner direction:** room objects should support gifts, achievements, website rewards, and funny random departure scenes.
**Date:** 2026-11-07. **Related:** #216 gameplay, #217 technical plan, #218 backend A1, #220 JS simulator B1, #221 good days A2, #219 visual docs.

## 1. Design decision

**One room, many independent layers.** Do not produce a separate flattened background for each combination of 10+ decorations. Render one room scene with a transparent object layer and a freely replaceable frog layer. Separate:

1. **Ownership:** items permanently owned by a Discord account, shared across frog lives.
2. **Placement:** which owned item instance occupies which compatible room slot.
3. **Appearance:** current room state (clean/messy/packing), frog state, visual gag after departure.
4. **History:** an immutable snapshot of one departed frog and the prop it pretended to take.

These must not be conflated. **A frog taking the TV is an overlay effect, NEVER loss of inventory.** Next adoption restores ordinary scene visibility.

Architecture must be additive to existing #218 A1, #220 B1 and #221 A2. Their real SQL has per-need clocks and a rescue path; **do not copy the obsolete `last_care_at + 168 h` sketch from the old version of #217.** Room code only consumes the final authoritative pet state.

## 2. Logical composition / rendering order

Base canvas: **640 × 400 logical units**, aspect 8:5; exact art is still provisional. Use coordinates/anchors, not absolute pixels tied to device size. On narrow screens scale the whole scene; keep inventory controls below/alongside the image, not baked into background.

| Draw order | Layer | Examples | Mutable? |
|---|---|---|---|
| 00 | `wall_background` | walls, window, wallpaper | theme only |
| 10 | `floor_background` | floorboards, base rug | theme only |
| 20 | `fixed_furniture` | door, bed, stable dresser/table geometry | only by separately approved room expansion |
| 30 | `wall_decor` | poster, portrait, framed stamps, seasonal banner | owned placements |
| 40 | `surfaces` | shelf, top of dresser, display plinth | layout anchors |
| 50 | `placed_items_back` | plants, TV, lamps behind frog | owned placements |
| 60 | `pepegochi` | separate sprite and animation | life status; absent after departure |
| 70 | `placed_items_front` | floor toys in front, small foreground decorations | owned placements |
| 80 | `state_effects` | dust, light motes, suitcase, occupied-place outline | derived, not persisted as inventory |
| 90 | `click_targets` | transparent accessible HTML hit areas, tooltip | UI only |
| 100 | `system_ui` | need bars, care controls, GOODBYE.TXT Notepad, inventory | DOM, never exported into room PNG |

Do not rasterize title bars, buttons, numbers or copy directly into decorative PNGs. UI sprites and functional DOM must be independent. Sort within a layer by canonical slot order / z; **do not accept arbitrary z from a client**.

## 3. MVP anchor slots (one item per slot)

Slot ID and permitted categories are permanent API identifiers. The x/y positions are **approximate design anchors to playtest**, with the origin at the top-left of the 640 × 400 scene. A replacement theme may remap anchors but must keep slot IDs, compatibility and occupancy.

| Slot ID | Anchor (x,y) | Allowed categories | Typical objects | z |
|---|---|---|---|---|
| `wall_left` | 169,96 | `wall` | P poster, postcard | 30 |
| `wall_right` | 414,112 | `wall` | framed souvenir, event poster | 30 |
| `shelf_a` | 252,140 | `small`, `trophy` | floppy disk, small crystal | 40 |
| `shelf_b` | 318,140 | `small`, `trophy` | paper crown, mystery object | 40 |
| `dresser_top` | 90,215 | `lamp`, `small` | lava lamp, small gift | 50 |
| `tv_stand` | 546,240 | `electronics`, `large` | CRT TV, radio | 50 |
| `table_top` | 453,258 | `small`, `toy` | mug, duck, miniature | 50 |
| `floor_left` | 95,331 | `plant`, `large` | potted plant | 50 |
| `floor_right` | 559,331 | `plant`, `large` | potted plant, chest | 50 |
| `rug_left` | 246,341 | `toy`, `small` | ball, rubber duck | 70 |
| `rug_right` | 398,341 | `toy`, `small` | toy, cushion | 70 |

**Reserved, never placeable:** window, bed/pet recovery position, pet body staging area, exit route, GOODBYE.TXT letter hotspot and care buttons. The central floor remains open so the sprite and its animations aren't blocked.

For each visual sprite store its **pivot/anchor** and bounding box in the asset manifest. Bounds and category compatibility, rather than browser-dragged x/y, are enforced server-side. MVP uses slot picking (works on phones). Free drag with collision and snapping is a future optional editor, NOT the first API.

## 4. Item catalog and unlocks

Each catalog item is a known, immutable `item_id`, with `category`, `display_name`, `sprite_key`, `footprint`, `borrowable`, `reward_source`, `max_copies`, and possible `event_key`. Client receives a public catalog of possible items but **never provides award proofs**.

Candidate decorative ids:
- `crt_tv` → electronics, default room item, eligible for departure gag.
- `lava_lamp` → lamp, default, gag-eligible.
- `potted_plant` → plant, default, gag-eligible.
- `p_poster` → wall, default, gag-eligible.
- `rubber_duck` → toy, default, gag-eligible.
- `mug` → small, default, gag-eligible.
- `floppy_disk` → small, future event collectible, **locked until server proof**.
- `paper_crown` → trophy, future, locked.
- `moon_rock` → trophy, **planned only**. Existing browser/YEET localStorage progress is not authoritative proof, despite the 6000 m easter egg; do not silently grant it.
- `lost_pond_artifact` → trophy, future Lost Pond Files server event, locked.

Non-takable by default: `moon_rock`, unique event gifts, premium/limited keepsakes, furniture/bed, passport stamps, avatars, account-bound story items. Borrowable only if it is actually **placed in the owner room when departure settles**, and not protected. Empty pool → no item; goodbye copy handles it.

A gift may come from a future **trusted award event** from YEET, Pepe Guesser, The Lost Pond Files, or Fren Passport. A Passport stamp is not automatically an item. The authoritative event/award policy, not the visual room client, decides ownership; use a single idempotent award transaction and do not create competing inventories.

## 5. Data model proposal (not SQL to run)

Keep **account-owned items** independent of life ID. Candidate structures:

```text
games.pepegochi_item_catalog
  item_id PK, category, sprite_key, is_borrowable, is_live, copy_limit

games.pepegochi_inventory
  item_instance_id uuid PK, user_id auth owner FK, item_id FK,
  source_event_key unique per user + source, acquired_at, archived_at nullable

games.pepegochi_room_placements
  user_id, slot_id, item_instance_id, placed_at
  PK(user_id, slot_id), UNIQUE(item_instance_id)
  FK(user_id, item_instance_id) -> inventory owner identity
  check compatibility against server-side slot rules

games.pepegochi_room_revision
  user_id PK, revision int, updated_at

games.pepegochi_lives (existing A1/A2)
  optional taken_item_id or taken_prop_id / item snapshot on departed life
  choose once on server and persist within the departure transaction
```

The `inventory` must survive pet departure; user deletion can cascade per existing privacy policy. Account-level props and previously owned gifts can be reused by later pet lives. Do not store room layout in `localStorage`. For a first release, there may be only **server-defined starting items** and placements until the cross-game award ledger is implemented.

## 6. Minimal RPC contract proposal (to review with backend Claude)

- `gry_pepegochi_room_state()` — no arguments, read-only, owner Discord auth, returns owned instances, placements, revision, layout version, public slot defs. **No private history of another user**.
- `gry_pepegochi_room_place(p_item_instance_id UUID, p_slot_id TEXT, p_expected_revision INT)` — validates inventory ownership, allowlisted slot, category, availability, currently active life if edits paused during departed scene, and revision; atomically moves one instance (remove old slot + assign new). Reject duplicate or stale edits; no arbitrary x/y, z or owner id.
- `gry_pepegochi_room_unplace(p_slot_id TEXT, p_expected_revision INT)` — clears placement but **does not delete ownership**. For default items, the inventory instance still exists.
- **Award API is not public.** A trusted server event calls an internal grant helper after verifying its own unique event; idempotent on `source_event_key`. The client cannot send `item_id` to award itself.

An optional read endpoint may return pet + room together for better performance once backend is stable. First scope: 1 room state RPC at opening and 1 placement RPC per accepted edit; no cron, no Realtime or frame-by-frame writes.

Because #218/#221 are open Draft PRs, names/schemas above are **proposed only**. Claude must rebase onto the final accepted schema rather than replacing those migrations or rewriting Passport.

## 7. Departure with truly movable items

1. Backend A1/A2 authoritatively computes departure. On first **write** that settles it, lock owner then life and serialize against room placement changes (always lock in one consistent order).
2. Draw eligible list from **committed** room placements, joined to owner inventory and catalog: `borrowable` and not a protected item. Use PostgreSQL-side random selection, not `Math.random` from client and not browser-provided ids.
3. Persist one chosen `item_instance_id` or stable `item_id` snapshot on the departed life; both repeated calls and disconnected retries return the same selection.
4. Client renders all room layers except the one chosen item in **that departed life's farewell scene**, optionally leaving a dust outline. It does not remove inventory/placement rows.
5. `GOODBYE.TXT` and Former Frens read the **same** persisted item snapshot and choose a safe, predefined copy variant. No award for departure.
6. After the letter is acknowledged and a new life adopted, the overlay suppression ends. The same placements appear again, including the 'stolen' object.

**Race edge:** if placement editing and departure settlement happen together, both serialize behind the same owner lock; only objects present at the effective transition can be chosen. If all slots protected/empty, record null; never take a priceless Moon Rock.

**Data transition:** if departure happened before room inventory existed, render a generic letter; never fabricate or delete an item.

## 8. Interaction and responsiveness

- MVP click/tap to select one owned item → choose glowing compatible slot → save. Second item may replace first **only after confirmation or explicit swap action**; don't silently destroy a placement.
- If a slot is occupied, move the old item back to unplaced inventory (ownership persists). No negative numbers, slots outside bounds or overlapping frog.
- Keyboard: select inventory item with Enter, tab through slots, Enter to place; buttons have accessible names and focus. Touch targets minimum ~44 CSS px outside the scaled canvas.
- Desktop: controls beside scene. Mobile: scene above inventory with scrolling beneath. Scale logical 640×400 uniformly; no page horizontal overflow.
- Persist after each successful action only; optimistic edit rolls back when RPC rejects a stale revision. New tab fetches current layout; do not silently overwrite the newer tab.
- Reduced motion: stop bobbing, blinking and transition animations as requested. Animation runs client-side; network only on actual events.

## 9. Required production art files

- **`room_base_wall.png` and `room_base_floor.png`** with 640×400 coordinate alignment, no baked-in user-placable TV, plant, poster or lamp.
- Fixed geometry as independent layers; separate props with true PNG alpha. Sprite pivots and bounding boxes from a manifest; exported with transparent edges and nearest-neighbor scaling.
- One standalone sprite per item (TV, lamp, plant, poster, duck, mug) plus empty-slot/faint-dust overlays and selectable slot hotspot masks (transparent HTML overlay is fine).
- PepeGochi sprite and action effects on separate layers. Background copies should not include final HUD or GOODBYE.TXT text.
- No "unique render per item combination". With N optional binary props, flattening requires 2^N variants (10 items = 1024), while layers require one background + N sprites.

Existing v2/v3 concept sheets have props **baked into backgrounds** and remain visual references, **not** usable production layers. The standalone room-editor below is a wireframe using icons, not final approved artwork.

## 10. PR split and test gates

**Room-1:** art breakdown, slot manifest, browser-only room editor, accessible mobile layout (this PR #219, no production route).
**Room-2:** server-owned inventory, placement RPC + migrations and real PostgreSQL integration tests (separate Draft PR, only after A1/A2 accept).
**Room-3:** trusted event → item awards; initially choose just one genuinely server-verifiable source, avoid client-authored YEET Moon Rock claims.
**Room-4:** durable departure item snapshot, GOODBYE copy and Former Fren history; race/departure tests.
**Room-5:** integrate approved sprite assets in hidden PondOS beta, QA mobile + desktop, owner release approval.

Minimum test cases:
- Unowned item placement refused; impossible category/slot refused; 2 items cannot occupy 1 slot; 1 item cannot occupy 2 slots.
- Two tabs stale `expected_revision` cannot overwrite current placement; concurrently placing an item is atomic.
- User A cannot read/write B; anon/non-Discord fail; no leaked private tables or writable `user_id`.
- Item remains after removal/unplacing, frog departure and adoption.
- Departure selects at most one eligible item; never TV if no TV placed; never protected item; never duplicates result on retry; null when none eligible.
- Race move vs departure deterministic and consistent; preserving existing stamps, avatar, inventory.
- UI at 360,390,1280 px; keyboard only; mobile tap; reduced motion; no per-frame network.
- Re-running staging migrations is safe; no client-only award proofs; no PEP payout and no 1.5× multiplier.

**Release guard:** no production SQL, live writes, publication, merge, or reward enablement without explicit owner approval.
