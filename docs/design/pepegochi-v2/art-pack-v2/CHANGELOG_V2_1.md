# PepeGochi v2.1 — QA sprite corrections (draft)

The prior approved visual references and the existing room v5 stay authoritative; this is a **technical correction**, not new character art.

- Fixed visual sizes of the `adult_hungry` and `adult_dirty` character silhouettes without any CSS scaling; removed detached decorative bubbles/flies in those files to avoid oversized bounding boxes.
- Reduced `froglet_idle` below the adult stage and aligned the contact point to y=124.
- Added a small white P to `adult_recovering` and `froglet_idle`.
- Normalized six departure frames to approximately adult height while maintaining their rightward movement and partial exits at the right side.
- All character and departure frames use a shared color palette (42 colors maximum) and a crisp 2x2 pixel grid. Kept the same 128x128 transparent RGBA output and filenames.

**Pending visual review:** The corrections use careful re-sampling of the approved originals, not a complete hand redraw. Check for crop artefacts and facial-expression fidelity before declaring production art. Claude should compare with screenshots in #228 rather than re-scaling in CSS. Existing room and items are unchanged.
