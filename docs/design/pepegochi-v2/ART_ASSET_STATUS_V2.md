# PepeGochi v2 — Art Pack v2 / handoff for Claude

**Status:** DRAFT visual QA; no production integration, SQL, merge or deployment. 
**Date:** 2026-11-07.
**Related:** PR #216 (game concept), PR #217 (technical plan), PR #219 (this art branch).

## What is ready for visual playtesting

- 7 candidate alpha PNG sprites: `pepegochi_adult_idle`, `adult_hungry`, `adult_neglected`, `adult_packing`, `egg_idle`, `tadpole_idle`, `froglet_idle`.
- Each source at the original high resolution and a normalized 128×128 PNG (nearest-neighbor). Sources deliberately retained.
- One 640×400 candidate room scene: `room_empty_goodbye`.
- A fully offline **visual-only** HTML preview with switches for growth stages/expressions, 2/5/7-day *illustrative* absences, GOODBYE.TXT, and adoption after opening the letter.
- JSON manifest, QA sprite contact sheet, tests of 1280/390/360 px viewport sizes.

### Storage

Working asset pack archived as `PepeGochi_v2_Asset_Pack_v2.zip` in the owner's ChatGPT Library `PepeGochi v2` workspace and available in the asset preparation conversation. Binary art is **not** in this GitHub PR yet, to avoid pretending that concept sprites are production-ready; when approved, import the candidate PNGs using the manifest.

## Files in the local/Library pack

```text
PepeGochi_v2_Asset_Pack_v2/
  README.md
  QA_REPORT.md
  asset_manifest.json
  sprites/source/*.png
  sprites/game_128/*.png
  sprites/preview_256/*.png
  rooms/room_empty_goodbye_source.png
  rooms/room_empty_goodbye_640x400.png
  references/*.png
  demo/PepeGochi_v2_visual_playtest.html
```

## Integration contract for Claude

1. **Do not change the server rules** to match the demo. Server time, `care_days`, departure, recovery, Passport are authoritative in PR A1/A2/C; this mockup is art direction only.
2. Pet sprite, room background, props, buttons, bars and text must remain independent layers. Use CSS `image-rendering: pixelated`, proper ARIA labeling, keyboard-accessible buttons and reduced-motion support.
3. Sprite manifest keys are stable labels, **not** a permanent backend schema. Backend stage may not contain `egg`; it requires explicit lifecycle design decision.
4. Show `GOODBYE.TXT` after the pet has left. Do not delete the real TV, decorations, profile stamps or collectibles. Only let a new adoption happen after acknowledging the letter.
5. Do not introduce any real rewards, multipliers, PEP payments or client-written badges.
6. Keep assets behind a **private/unpublished test route** until the owner approves them. The current PNGs are candidates; do not silently merge them.
7. Do not use the text rendered into any *concept sheet* as an application source. Use accessible DOM text translated from approved game copy.

## QA completed on the visual preview

| Browser/viewport | Initial render | Simulate 7d absence | Letter / modal | Adoption gate | Horizontal overflow | JS exceptions |
|---|---|---|---|---|---|---|
| Chromium 1280×900 | pass | pass | pass | pass | none | none |
| Chromium 390×844 | pass | pass | pass | pass | none | none |
| Chromium 360×780 | pass | pass | pass | pass | none | none |

These are **front-end-only checks**, not Supabase integration tests.

## Must fix before production

- The sole actual room PNG is the **departure** version. Normal/messy/neglected/packing room variants exist only as concept-sheet thumbnails, not clean usable backgrounds. Reusing one scene in the demo is intentional placeholder art.
- The adult sprites retain a purple baseline shadow; hungry includes a bowl and packing includes a suitcase. For rich interactions, export these props separately and hand-clean pixel edges.
- No animated frame sequences exist yet. The demo's slight CSS bobbing is not a sprite animation deliverable.
- Passport stamp thumbnails and special avatars are only concept suggestions; use the existing catalogue and owner's previously approved stamp rules.
- The good-day criteria and time thresholds remain *candidates*, not production decisions.

**No SQL executed and no live site modifications in this art PR.**