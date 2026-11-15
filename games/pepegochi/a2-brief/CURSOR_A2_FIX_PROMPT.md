# Prompt poprawkowy dla Cursora: PepeGochi A2, runda 2

Wklej wszystko poniżej linii do tej samej rozmowy z Cursorem, która zrobiła gałąź `art/pepegochi-a2-taskbar-cursor`.

---

Thank you, the pipeline is exactly right: ASCII grids in `scripts/build_pepegochi_taskbar.py`, 48 x 48, clean palette,
readable P, every file passes `node scripts/pepegochi_art_qa.mjs`. Keep all of that.

The problem is the look: the frog is not Pepe any more. Compare row 1 and row 2 of
`games/pepegochi/a2-review/a2_chatgpt_vs_cursor.png` (fetch it from the branch `claude/kind-faraday-l3vxjs`; the
first picture on the left is the accepted master `pepegochi_adult_idle.png`):

- Row 2 (yours) has a heart-shaped head, tiny square eyes and a thin flat mouth. That is a generic frog.
- Pepe has a wide rounded head with two big bulging eye domes on top, large white eyes with the black pupils
  looking to the side, heavy upper eyelids, and a wide brown-orange smile (lips) across the lower face.
- The egg must be an egg (oval, wider at the bottom), like `pepegochi_egg_idle.png`, not a teardrop.
- The tadpole is round and chubby with a short curled tail, like `pepegochi_tadpole_idle.png`, not a long arm.
- Packing: the frog SITS ON the suitcase (suitcase under it), like the ChatGPT candidate, not standing behind it.
- Neglected: knees pulled up to the chest, arms around the knees, like the ChatGPT candidate.

## What to do

1. Start every grid from the matching ChatGPT candidate in `games/pepegochi/a2-review/candidates/`
   (`tb_egg`, `tb_froglet`, `tb_adult_sit`, `tb_adult_hungry`, `tb_adult_dirty`, `tb_adult_moody`, `tb_adult_sleepy`,
   `tb_adult_neglected`, `tb_adult_packing`, `tb_letter`). These have the right Pepe face and pose but are blurry
   downscales. Add a small helper to the script (or a one-off step) that reads a candidate PNG and maps every pixel to
   the nearest palette colour, so you get a starting ASCII grid; then clean it by hand:
   - a clean 1 px dark outline (`O`) all around, no broken or doubled outline pixels;
   - the Pepe eyes: white eye shapes with black pupils, readable at 1x;
   - the mouth: a clear line of `M`, curving up (happy) or down (sad), readable at 1x;
   - the white P on the hoodie exactly as in your current version (3 x 5);
   - brown shorts, green legs, no stray single pixels.
2. For the 6 poses without a candidate (`tb_tadpole`, `tb_adult_recovering`, `tb_adult_talk`, `tb_adult_think`,
   `tb_adult_laugh`, `tb_adult_wave`), start from your cleaned `tb_adult_sit` (or from the tadpole reference) and change
   only the face, arms and props. Laugh: no tail.
3. Keep the same sizes and lines: 48 x 48, feet on y = 47 (lowest row y = 46), body centred on x = 24, at most
   32 colours, no anti-aliasing.
4. Re-run the script, then `node scripts/pepegochi_art_qa.mjs docs/games/img/pepegochi/taskbar/tb_*.png` (all OK) and
   look at the preview at 1x: each pose must read as Pepe and its emotion must be clear.

Commit on the same branch `art/pepegochi-a2-taskbar-cursor` ("PepeGochi A2 round 2: Pepe face from the candidates") and
push. Do not change any other file, do not merge, do not open a pull request.
