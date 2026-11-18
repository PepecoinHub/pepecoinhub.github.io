# PepeGochi A19: froglet care graphics

Draft review only; no merge or deployment without approval. Stacked on A18 (#360).

Twelve replacement frames cover all remaining froglet care cycles: cleaning (soap, lather, bubbles, sparkle), playing (ball on floor, toss, jump, catch), rest (yawn, closed eyes, one Z, two Zs). Combined with A18's four feeding frames, all 16 froglet care frames now use the finer art profile matching A16's approved froglet. Each replacement is a 128 × 128 RGBA PNG with binary alpha; feet remain at y=124 except play frame 03, which preserves the existing jump to y=120. No gameplay, SQL, animation timing or care rewards are changed.

`clean.png`, `play.png` and `rest.png` show the four frames of each cycle in order. Art generated using the A16 master as the style reference and the old individual frame as the action/placement reference, then normalized to the native sprite canvas. Floating effects are included in bounding boxes but character height is preserved independently. All existing art QA tests and direct old/new geometry comparisons pass.
