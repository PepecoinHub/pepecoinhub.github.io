# PepeGochi A20–A23: remaining fine sprite frames

Draft review only. Do not merge or deploy. Stacked on A19 (#361).

Complete: 56 of 56 remaining replacement PNGs (90 of 90 across A16–A23). Adult care (16), tadpole care (16), departure/walk (20), and hatch (4). Existing idle masters, room geometry, gameplay, care rewards and SQL remain unchanged.

All 56 PNGs pass native size, binary-alpha, baseline and geometry checks. The six legacy departure frames preserve the original draw offsets exactly. The three walk cycles preserve the original identical second and fourth frames. The art QA suite passes 5/5. Fine sprites use the existing 128 × 128 canvas and a one-pixel grid.

## Review

- [Animated comparison](animation-preview.gif)
- Room: [adult](room_adult.png), [tadpole](room_tadpole.png) (illustrative composition, not a live production screenshot)
- Adult care: [feed](adult_feed.png), [clean](adult_clean.png), [play](adult_play.png), [rest](adult_rest.png)
- Tadpole care: [feed](tadpole_feed.png), [clean](tadpole_clean.png), [play](tadpole_play.png), [rest](tadpole_rest.png)
- Departure: [adult](adult_departure.png), [froglet](froglet_walk.png), [tadpole](tadpole_walk.png), [legacy](legacy_departure.png)
- [Hatch](hatch.png)
