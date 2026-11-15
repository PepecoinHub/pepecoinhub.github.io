# PepeGochi A3 — Part 1 corrections + hop_02

Eight replacement sprites, each **48×48 RGBA**, edited directly at native pixel resolution. No image generation, resizing, palette-wide conversion of the base, or replacement body was used.

## Files

- `sprites/tb_adult_neglected.png`: lowered sad head, original standing body and hanging arms.
- `sprites/tb_adult_packing.png`: worried face, connected arm holding a yellow suitcase beside the frog; suitcase and feet finish at row 46.
- `sprites/tb_adult_recovering.png`: reference smile and small forehead plaster.
- `sprites/tb_adult_talk.png`: reference open mouth and raised gesturing arm.
- `sprites/tb_adult_think.png`: reference upward-looking expression and hand at chin.
- `sprites/tb_adult_laugh.png`: reference closed eyes and open mouth, small yellow laugh marks.
- `sprites/tb_adult_wave.png`: reference raised waving arm.
- `sprites/tb_hop_02.png`: byte-identical copy of the approved standing base, using the explicitly permitted unchanged-arms fallback.

## Exact invariants

The source is the supplied A3 `pozy_48px/tb_adult_sit.png`, which already stands despite its filename. `reference_tb_adult_sit.png` is a copy for verification, **not a replacement asset**.

Every final pose preserves these rectangles pixel for pixel (right and bottom exclusive):

| Locked region | Rectangle |
|---|---|
| Brown shorts, legs and feet | [17,37,32,48] |
| Lower hoodie | [18,29,30,37] |
| Original P and surrounding fabric | [21,26,29,32] |

The original P is retained exactly as supplied, including its original colors and shape; it is not redrawn. Arms are changed outside the protected garment and lower-body regions. Heads/arms are copied at 1:1 pixel scale from the corresponding supplied pose and locally aligned with integer offsets. The small suitcase is assembled at native resolution using the approved packing reference's yellow colors. No adult has a tail.

All files have binary alpha, a transparent last row (y=47), last visible row y=46, at most 32 RGBA colors, and no detached blue components. Base palette colors are retained; the prop/motion marks use three yellow shades from the supplied packing reference, and the plaster uses the brief's allowed #fdfdfd.

## hop_02 provenance

Batch 02's generated ZIP and original `tb_hop_02.png` were not available in the local files or the referenced chat's accessible attachments. Rather than claim an edit of an unseen frame, this replacement uses the user's explicitly authorized fallback: leave the arms as in the base. It is identical to `tb_adult_sit.png`, so there are no loose blue pixels from moved arms. The other batch 02 files are not included or modified.

## Review and validation

`contact_sheet.png` shows all eight results enlarged with nearest-neighbor plus native 1:1 examples. It is a review sheet, not a sprite to slice or downscale.

Run `python verify.py` (Pillow required) to validate dimensions, alpha, palette count, baseline, exact protected regions, permitted edit locations, disconnected blue fragments, and the QA report. `QA.json` also records source hashes and final file hashes.

Only copy the eight files in `sprites/` after review: the seven poses belong in the taskbar pose directory; `tb_hop_02.png` belongs beside the other hop frames. This is a correction package, not the full 40-file A3 set. No game code, evolution timing, care rules, integration or deployment was changed. QA is static asset validation; in-game playback remains an integration check.
