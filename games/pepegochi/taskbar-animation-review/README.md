# Taskbar animation sprite strips — review only

Eight proposed transparent PNG strips, based on the approved 48×48 adult, froglet and tadpole sprites. Revised on 2026-11-21 following visual review; motions retained, technical pixel cleanup completed. Await visual approval before integration.

| Strip | Frames | Dimensions |
| --- | ---: | --- |
| `tb_eat.png` | 4 | 1536×384 |
| `tb_wash.png` | 4 | 1536×384 |
| `tb_sleep.png` | 3 | 1152×384 |
| `tb_celebrate.png` | 5 | 1920×384 |
| `tb_search.png` | 4 | 1536×384 |
| `tb_read.png` | 4 | 1536×384 |
| `tb_tadpole_swim.png` | 4 | 1536×384 |
| `tb_froglet_hop.png` | 4 | 1536×384 |

Cells are left-to-right, 384×384, with no separators and transparent margins. Each is an exact nearest-neighbor 8× enlargement of a pixel-native 48×48 frame. Split at multiples of 384 and downsample with nearest-neighbor. All 32 frames end on y=47 (lowest opaque row y=46), as in the approved poses. Adult core restored to approximately 40 px at y=7; effects may extend above the head. Tadpole and froglet restored to the approved stage dimensions. Bent-leg poses suggest hops without changing the foot line.

Every pixel is fully opaque or fully transparent, with no dithering or antialiasing. All opaque colours come from the exact RGB palettes of `tb_adult_sit.png`, `tb_tadpole.png`, and `tb_froglet.png`; no frame exceeds 32 colours. The final celebrate and read eye artwork is copied directly from the approved adult sprite. The generated action poses are otherwise retained.

Validation: all 32 native frames pass `node scripts/pepegochi_art_qa.mjs --format=B` with zero problems. To inspect the actual master strips and re-run the same format-B checker on their native pixels (plus exact palette, block and eye checks), run:

```sh
node games/pepegochi/taskbar-animation-review/validate-review.mjs
```

`preview_48px.png` shows the original approved sprite first in every row, then the revised frames, enlarged 2× with nearest-neighbor on a dark taskbar-like background. This is a proposed art pack, not a runtime change. No existing sprites, animation code, beta gate, or production files have been replaced.
