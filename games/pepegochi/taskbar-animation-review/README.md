# Taskbar animation sprite strips — review only

Eight proposed transparent PNG strips, based on the approved 48×48 adult, froglet and tadpole sprites. They are not pixel-identical replacements: the generated poses have small stylistic differences and should be visually approved before integration.

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

Cells are left-to-right, 384×384, with no separators and transparent margins. Each is a nearest-neighbor 8× enlargement of its 48×48 version; split at multiples of 384 and downsample with nearest-neighbor. All adult/froglet poses have a common foot baseline (native y=44). Bent-leg poses suggest a hop; if desired, apply a short positional hop in the animation player. The tadpole face is anchored while the tail moves. The scale is constant within each strip. The props and margins leave the adult slightly smaller than the existing idle anchor.

`preview_48px.png` shows the original approved sprite first in every row, then the proposed frames, enlarged 2× solely for review. This is a proposed art pack, not a runtime change. No existing sprites, animation code, beta gate, or production files have been replaced.
