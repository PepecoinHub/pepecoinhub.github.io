# Fren Passport: master prompt for stamp images (ChatGPT)

Use this for **every** stamp. Do not rewrite it, do not shorten it, do not "improve" it between stamps.
Only the SCENE block changes. Uneven quality comes from drifting prompts; this file stops the drift.

## How to run it (every time)

1. **New image, one stamp.** Never several stamps on one sheet, never "edit the previous image" for a new stamp.
2. **Attach the same 3 references every time.** Use the light copies in `games/fren-passport/refs/`
   (`ref_frog_of_the_week.jpg`, `ref_moonwalker.jpg`, `ref_first_fren.jpg`, about 100-150 KB each; or all three in
   `ref_sheet.jpg`). The full PNGs in #233 are 2+ MB and GitHub does not always serve them whole. The owner can also
   attach the same files in the chat. For a redraw, also attach the old version of that stamp as the composition reference.
3. Paste the **MASTER PROMPT** below, then the **SCENE** block of the stamp.
4. Generate **3 variants**, pick the best with the checklist, and show the owner only that one.
5. Upload the PNG to #233 as `games/fren-passport/source/stamps-new/<id>.png` and add it to the manifest with
   status `candidate`. The owner says OK; then status `owner-approved`.

## MASTER PROMPT (paste as is)

```
Create ONE postage stamp illustration for the "Fren Passport" in PondOS.
Match the three attached reference stamps exactly in style, line weight, colouring, frame and label. They are the
standard. Same artist, same series.

FORMAT
- Portrait stamp, about 1173 x 1341 px, transparent background outside the stamp edge.
- Cream paper #FCEDD5 with round scalloped perforations: 7 scallops across the top and bottom, 8 down each side.
- Inner picture window with a thick dark-brown ink outline, slightly irregular, hand-drawn.
- Bottom label: a grey #C7BEAF rounded bar with a dark outline, inside it ONLY this text: "{LABEL}".
  Bold rounded hand-lettered font like the references, dark ink, centred, spelled exactly.

STYLE
- Detailed, slightly irregular cartoon with thick confident ink outlines and flat colour with light hand shading,
  like a hand-inked sticker. Not vector-clean, not 3D, not painterly, not photo.
- Pepe the frog as in the references: green skin #6DB33F range, big white eyes with black pupils, wide red-pink
  mouth, friendly and happy. Same face proportions as the references.
- Bold, saturated, warm colours. One clear background colour behind the scene.
- Must read at 64 px: one main subject, big shapes, no tiny clutter, no small text in the scene.

NOT ALLOWED
- Any text except the label (no numbers, dates, years, logos, brand names, watermarks, signatures).
- Gold frames, counters (x2), locks, question marks, ribbons around the stamp. The site adds those.
- Hearts, astronaut suits on YEET stamps, real logos (NASA, Discord, Microsoft...), blood, weapons.
- Extra stamps, a sheet of stamps, a border outside the perforations, drop shadows outside the stamp.

SCENE
{SCENE}
```

## Checklist before showing the owner (reject if any is "no")

- [ ] Looks like the same series as Frog of the Week, Moonwalker and First Fren side by side.
- [ ] 7 x 8 scallops, cream paper, grey label, label text spelled exactly, nothing else written.
- [ ] Transparent outside, at least 900 px wide.
- [ ] At 64 px you still understand the idea; the label is readable at 52 px.
- [ ] Pepe's face matches the references.

## SCENE blocks (next in line)

**`detective_fren`, label `Detective Fren`.** Redraw of the accepted scene at full size; keep its composition.
```
Pepe in a brown deerstalker detective hat and a dark suit, holding a big magnifying glass up to one eye,
the eye looks huge through the lens. Behind him a cork board with five pinned photos joined by red string,
each photo shows a tiny green frog hidden in a landscape. Warm orange background.
```

**`rookie_miner`, label `Happy Mining!`.** Lily's existing art, only the label changes. Do NOT redraw the picture:
replace the label text on the existing PNG and keep everything else pixel for pixel.

**`good_game`, label `Good Game`.**
```
Two Pepe frogs across a finished chess board, shaking hands over the board, both smiling. The game is over:
a few pieces left standing, no piece knocked over. Small Win98-style CRT monitor in the corner. Calm teal background.
No white flag.
```

**`checkmate`, label `Checkmate!`.**
```
Pepe leaning over a chess board, moving a white queen with a confident grin; the black king stands cornered
by the queen and a rook. Big shapes, few pieces. Purple background.
```

**`yeet_adept`, label `Adept`.**
```
Pepe in the YEET THE PEP pilot outfit (leather cap and goggles, scarf) flying high above the clouds, arms
spread, sunset orange and pink sky behind him. No rocket, no space suit.
```

**`fud_buster`, label `FUD Buster`.**
```
Pepe as a retro arcade hero at a cabinet joystick, blasting a row of falling pixel "FUD" paper receipts with
green laser bolts; the receipts are drawn as crumpled paper with no readable text. Dark blue background.
```

**`long_snake`, label `Long Snake`.**
```
A very long happy green pixel-block snake winding through the whole picture in loops, Pepe riding on its head
and cheering. Black arcade-screen background with a faint grid.
```

**`secret_starter`, label `Secret Starter`.**
```
Pepe opening a dusty old floppy disk box under a desk lamp, a soft glow coming out of the box, eyes wide
with surprise. Dark green background.
```

## SCENE blocks for launch (2026-11-09): the 9 stamps still missing

**`top_ten`, label `Top 10`.**
```
Pepe standing proudly on a tall stack of ten wooden crates, the top crate under his feet, one fist raised,
a small leaderboard scroll unrolled beside him with ten blank lines (no writing). Light blue sky background.
```

**`bug_hunter`, label `Bug Hunter`.**
```
Pepe in a safari hat holding a butterfly net, and inside the net a small cartoon computer bug: a beetle
made of a green circuit board with tiny legs. Behind him a beige Win98-style CRT monitor. Green background.
```

**`season_champion`, label `Season Champion`.** Gold stamp; redraw (attach the old version only as a reference).
```
Pepe holding a big golden trophy cup above his head with both hands, confetti falling, a red winner's sash
across his chest with no writing on it. Deep royal blue background.
```

**`podium`, label `Podium`.**
```
Three Pepe frogs on a wooden winners' podium, the middle one highest and cheering, the other two clapping
on the lower steps. No numbers on the podium. Warm yellow background.
```

**`game_night`, label `Game Night`.**
```
Pepe on a sofa at night with a bowl of popcorn, looking at a big Win98-style CRT monitor that shows a framed
picture of a half-hidden frog to guess, a crescent moon in the window behind. Dark purple night background.
```

**`quiz_master`, label `Quiz Master`.**
```
Pepe as a TV quiz-show host in a bow tie, holding a handheld microphone in one hand and a stack of picture
cards in the other, under a small spotlight. Red curtain background. No drawing, no easel, no paint brush.
```

**`frogmas`, label `Frogmas`.**
```
Pepe in a red Santa hat and a red knitted sweater, holding a mug of hot cocoa, beside a small decorated
Christmas tree with a star on top, snow falling. Warm red background.
```

**`treasure_hunter`, label `Treasure Hunter`.**
```
Pepe in an explorer hat kneeling over an open wooden treasure chest that glows from inside, a rolled-up old
map in his other hand, a small shovel stuck in the sand. Sandy orange background.
```

**`interior_designer`, label `Pond Decorator`.**
```
Pepe in a cosy room hanging a framed picture on the wall with a little hammer, a potted plant, a rubber duck
and a lava lamp already placed around him, a paint roller leaning on the wall. Soft teal background.
```

**`pep_birthday`, label `Pepecoin's Birthday`.** (event stamp, 30 January)
```
Pepe in a purple polka-dot party hat, arms up and cheering, holding the string of one red balloon, a small
birthday cake with candles on a table in front of him, confetti falling. Light lilac background.
No numbers on the cake or anywhere else.
```

**`thanksgiving_fren`, label `Thanksgiving`.** (event stamp, US Thanksgiving weekend)
```
Pepe at a cosy dinner table with a roast turkey on a big plate, a pumpkin and autumn leaves beside it,
holding a fork and knife with a big happy grin. Warm autumn orange background.
```

## Redraws (owner, 2026-11-09)

```
Redraws. Same MASTER PROMPT and rules, one image per stamp, real transparent background, 1173 x 1341 px format,
Pepe looks happy, draw ONLY what the SCENE says (no extra hats, outfits, props or text).

1. "Welcome Back!": Pepe stepping back through an open front door with a small suitcase, waving hello, a doormat in front. Sunny yellow background.
2. "First Words": Pepe at a beige Win98-style computer typing, a big empty white speech bubble popping out of the screen. Light green background.
3. "Hey @Fren": Two Pepe frogs at two computers side by side, one waving at the other, a big "@" sign floating between them (the only symbol allowed). Sky blue background.
4. "Community Fren": Four happy Pepe frogs squeezed together around one Win98-style monitor, laughing, one giving a thumbs up. No logos. Purple background.
5. "Dear Editor": Pepe at a wooden desk sealing an envelope with a red wax seal, a quill pen in an ink pot beside him. Warm brown background.
6. "Junior Editor": Pepe proudly holding up a fresh newspaper with a small picture of himself on the front page (no readable text). Light blue background.
7. "Senior Editor": Older Pepe with round glasses and a grey beard at a desk piled with newspapers, a green editor's visor on his head, red pencil in hand. Dark green background.
8. "14-Day Streak": Pepe tearing a page off a big wall calendar, cheering, a small trail of torn pages on the floor (no numbers on the pages). Orange background.
9. "Pepe Guesser": Pepe holding a big map with a red pin, looking at a photo of a landscape, finger on his chin, thinking. Teal background.
10. "Week Scout": Pepe in a scout neckerchief looking through binoculars over green hills, seven small flags planted along a path behind him. Light green background.
11. "Scout Fren": Pepe as a proud scout in a neckerchief and explorer hat, saluting, a full backpack and a compass on his belt, mountains behind. Forest green background.
12. "First Hatch": A tiny baby Pepe popping out of a cracked spotted egg, eyes wide and happy, eggshell on its head. Soft yellow background.
13. "Little Fren": A small froglet Pepe with a little tail hopping happily on a lily pad, a few water drops around. Light blue pond background.
14. "One Small Step": Pepe in a simple white space helmet (no logos, no flag) taking his first step on the Moon, a single footprint behind him, Earth in the sky. Dark navy background.
15. "Detective Fren": Same scene as before, redrawn in the standard format: Pepe in a brown deerstalker hat and a dark suit holding a big magnifying glass up to one eye, a cork board with pinned photos and red string behind him. Warm orange background. The stamp must fill the 1173 x 1341 canvas like the other stamps (not narrower).
```

More SCENE blocks are added here by Claude when those stamps come up. ChatGPT does not write its own scenes for
new stamps; ask the owner or Claude.
