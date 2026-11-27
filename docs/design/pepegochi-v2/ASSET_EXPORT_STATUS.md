# PepeGochi v2 — asset export / visual QA handoff

**Status: PROVISIONAL / owner review required.** Prepared 2026-11-07. This is NOT a production deployment.

## Available now
- 7 transparent RGBA character images: `pepegochi_adult_idle`, `pepegochi_adult_hungry`, `pepegochi_adult_neglected`, `pepegochi_adult_packing`, `pepegochi_egg_idle`, `pepegochi_tadpole_idle`, `pepegochi_froglet_idle`.
- Each has an original PNG and a provisional 128×128 and 256×256 export. The game-ready PNG is **not** yet manually cleaned, and some props are baked in.
- One `room_empty_goodbye` background, 640×400, plus its original.
- A real contact sheet for size/lineup checking.
- Self-contained local HTML mockup, showing visual states, growth stages, a stat panel, controls and GOODBYE.TXT. The HTML does not call Supabase or award stamps.
- Generated concept sheets for UI, rooms, badges and animation ideas (these are references, not finished asset files).

## Where stored
The complete ZIP, visual HTML preview and QA PNG have been stored in the owner's **ChatGPT Library /PepeGochi v2/**:
- `PepeGochi_v2_Asset_Pack_v1.zip`
- `PepeGochi_v2_visual_preview.html`
- `PepeGochi_v2_sprite_QA.png`

Binary assets are **not** attached to this GitHub PR; do not treat a filename in this document as a repository path. They can be uploaded to a future dedicated art branch after owner approval.

## Proposed future GitHub paths (not created)
`games/pepegochi/art/source/`, `docs/games/assets/pepegochi/sprites/`, `docs/games/assets/pepegochi/rooms/`.

## Unresolved visual integration checks
1. Validate 128px exports in the actual PondOS window at 64, 80, 96, 128px.
2. Fix image generation fringe, outlines and hand-align feet / eye geometry across moods.
3. Split bowl, suitcase and floor shadows from character layers before animation.
4. Produce independent `room_normal`, `room_messy`, `room_neglected`, `room_packing` backgrounds. So far only `room_empty_goodbye` is an exported room asset.
5. Have the owner approve whether Egg exists as a separate server state; v1 backend begins with tadpole.
6. Integrate **only after** backend RPC design is approved. UI is a placeholder prototype and does not represent real care/day logic.

## Hard boundaries
No production SQL, merging, public deployment, real PEP payments or 1.5× rewards. Existing PondOS UI and Avatar Maker stay unchanged until approved.
