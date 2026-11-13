# Prompt dla Cursora: PepeGochi A2 (16 póz 48×48 na pasek Start)

Wklej wszystko poniżej linii do Cursora (repo `PepecoinHub/pepecoinhub.github.io`).

---

You are working in the repository PepecoinHub/pepecoinhub.github.io. Your task is ART ONLY: draw 16 tiny pixel-art
sprites of the PepeGochi frog for the PondOS (Windows 98 style) taskbar. Do not change any game code, rules, SQL,
CSS or HTML.

## Branch

Start from the branch `claude/kind-faraday-l3vxjs` (git fetch origin claude/kind-faraday-l3vxjs). Create a new branch
`art/pepegochi-a2-taskbar-cursor` from it. Commit there and push that branch. Do not merge anything and do not open a
pull request.

## Read first

- `games/pepegochi/a2-brief/A2_PROMPT.md`: the full brief (the 16 poses and what each one shows).
- `games/pepegochi/a2-brief/tb_slot_guide_10x.png`: the 48 x 48 frame enlarged 10x (red line = foot line y = 47,
  green = centre x = 24, blue box = adult body area, blue P = the 3 x 5 letter).
- Reference sprites (the accepted look of the frog), in `docs/games/img/pepegochi/`:
  `pepegochi_adult_idle.png` (master: wide-open eyes, Pepe smile, blue hoodie with a white P, brown shorts),
  `pepegochi_adult_hungry.png`, `_dirty.png`, `_recovering.png`, `_moody.png`, `_tired.png`, `_neglected.png`,
  `_packing.png`, `pepegochi_egg_idle.png`, `pepegochi_tadpole_idle.png`, `pepegochi_froglet_idle.png`,
  `goodbye_envelope.png`, `suitcase.png`.
- Pose references already approved in spirit by the owner (do NOT copy pixels, they are blurry downscales; use them
  only for the pose and the emotion): `games/pepegochi/a2-review/candidates/*.png` and
  `games/pepegochi/a2-review/a2_bar_4x.png`.

## How to make the art (important)

Do not generate big images and scale them down: that made the faces muddy and the P unreadable. Draw every sprite
pixel by pixel at its real size:

1. Write `scripts/build_pepegochi_taskbar.py` (Python 3 + Pillow). Each sprite is a 48-line ASCII grid of 48
   characters, one character per pixel, `.` = transparent, other characters = palette colours below. The script writes
   the PNGs. The grids are the source of the art, so a single pixel can be fixed later by editing one character.
2. Output: `docs/games/img/pepegochi/taskbar/<name>.png`, RGBA 48 x 48.
3. The script also writes a preview `games/pepegochi/a2-review/cursor_bar_preview.png`: all 16 sprites in a row on a
   Windows 98 grey bar (#c0c0c0 with a white top line), once at 1x and once at 4x (nearest neighbour).

## Palette (taken from the accepted sprites; use these exact colours, at most 32 per sprite)

```
O outline        #021b02     o dark outline    #011500
G skin           #71ad37     g skin shade      #5b8b2f     h skin light   #7aab3d
B hoodie blue    #0043fc     b hoodie shade    #0038df
W white (P, eyes)#fdfdfd     K pupil           #000000
S shorts brown   #9c6034
M mouth          #c76e43
D mud            #476929 (or #9c6034 for brown mud)
E egg shell      #fbefd7     e egg spots       #7faa48
Y suitcase       #ffda4e     y suitcase shade  #f5bb22     u suitcase dark #c07714
L envelope       #fff1cc     l envelope line   #232e1c     r seal          #c63a40
P plaster        #e7c9a0     (light skin-coloured plaster with 1-2 darker dots)
```

## Format rules (checked automatically)

- Exactly 48 x 48, every pixel fully opaque or fully transparent, at most 32 colours, no anti-aliasing, no gradients.
- 1 px dark green outline (`O`) around every figure.
- The figure stands or sits ON the line y = 47: its lowest visible row is y = 46. Body centred on x = 24.
- Adult frog about 40 px tall (top near y = 7). Egg about 30 px, tadpole about 24 px, froglet about 34 px,
  envelope about 14 px.
- White P on the hoodie: exactly 3 x 5 px, upright:
  ```
  WWW
  W.W   (the dot here is hoodie blue, not transparent)
  WWW
  W..
  W..
  ```
- Same frog in every sprite: the face of `pepegochi_adult_idle.png` (big white eyes with black pupils, Pepe smile),
  blue hoodie with the white P, brown shorts, green legs. Adults have NO tail. Only the froglet and tadpole have a tail.
- The egg has GREEN spots (like `pepegochi_egg_idle.png`), never blue.
- Keep all 16 adults/young poses consistent: decide once whether they sit or stand. Prefer SITTING on the bar edge
  with legs hanging down (the owner's brief), except the neglected pose (knees up) and packing (sitting on the
  suitcase).

## The 16 files (names exactly)

1. `tb_egg.png`: the egg from egg_idle, little face peeking, green spots, ~30 px tall.
2. `tb_tadpole.png`: the tadpole from tadpole_idle (no hoodie), lying down, tail to the left, ~24 px tall.
3. `tb_froglet.png`: the young frog from froglet_idle, sitting, small tail visible, ~34 px tall.
4. `tb_adult_sit.png`: adult sitting, legs hanging, calm Pepe smile like adult_idle.
5. `tb_adult_hungry.png`: both hands on the belly, sad eyes, mouth turned down.
6. `tb_adult_dirty.png`: mud spots on face and hoodie, a tiny fly (3-4 px) next to the head, smiling.
7. `tb_adult_moody.png`: arms crossed, angry eyebrows, mouth turned down.
8. `tb_adult_sleepy.png`: eyes half closed (a line), head a bit lower.
9. `tb_adult_neglected.png`: hunched, knees pulled up, sad big eyes.
10. `tb_adult_packing.png`: sitting on the yellow suitcase, worried face.
11. `tb_adult_recovering.png`: small plaster on the head, small smile.
12. `tb_adult_talk.png`: mouth open, one hand raised (telling a fact).
13. `tb_adult_think.png`: one hand at the chin, eyes looking up.
14. `tb_adult_laugh.png`: laughing, eyes squeezed shut, big open mouth. No tail.
15. `tb_adult_wave.png`: waving one raised hand, smiling.
16. `tb_letter.png`: only the envelope (like goodbye_envelope.png) lying flat, ~14 px tall, no frog.

Make the emotions readable at 1x: at this size the eyes and the mouth carry the emotion, so exaggerate them a little
(eyebrow lines, mouth up or down) rather than adding detail.

## Check before you commit

Run the repo's art check (format B = 48 x 48, 1 x 1 grid, max 32 colours, feet on y = 47):

```
node scripts/pepegochi_art_qa.mjs docs/games/img/pepegochi/taskbar/tb_*.png
```

Every file must print `OK`. Also run `node --test tests/pepegochi-art-qa.test.mjs` (must pass). Open the preview PNG and
look at it at 1x: every pose must be recognisable and the P readable.

## Commit

One commit on `art/pepegochi-a2-taskbar-cursor` with: the script, the 16 PNGs, the preview. Message:
"PepeGochi A2: 16 taskbar poses drawn at 48x48 (pixel grids in scripts/build_pepegochi_taskbar.py)". Push the branch.
Do not touch any other file. Then report the branch name, the QA output and anything you were unsure about.
