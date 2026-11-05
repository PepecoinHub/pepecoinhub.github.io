# Fren Avatar v2 alignment proof

These images are the REAL composited result of stacking the v2 SVG layers from
`docs/meme/avatar-assets/layers/` in the manifest `layers_order`
(`bg -> base -> clothing -> mouth -> eyes -> hat -> accessory`). They are not
mockups or concept art. Each tile was produced in headless Chromium by stacking
the exact same layer files the live demonstrator (`games/fren-avatar/demo.html`)
loads, so what you see here is what the maker will show.

The demonstrator was first loaded in headless Chromium and asserted: every
layer `<img>` reports `naturalWidth > 0` (the real SVGs actually decoded) across
the default combo, after several manual slot changes, and across five
randomizations, with zero failed `*.svg` requests.

## Self-check results

- PASS - Eyes land on the correct eye line. All six eye variants (classic,
  sleepy, wide, shades, round glasses, 3D glasses) sit centered on the shared
  eye line (y=215, left x=205 / right x=307). See `02-eyes-variants.jpg`.
- PASS - Mouth fits the face. All six mouths (smile, grin, laugh, tongue,
  neutral, smirk) sit at the shared mouth center (y=300, span x=176..336) below
  the eyes and above the chin, with none crossing the jaw outline.
  See `03-mouths.jpg`.
- PASS - Headwear covers the top of the head. All six hats (PEP cap, beanie,
  bucket, paper crown, hard hat, detective) cover the crown (y~72) and the brow
  area with no skin gap above them and no floating. See `04-headwear.jpg`.
- PASS - Clothing fits the neck and shoulders. All six clothing options (blue
  shirt, purple hoodie, black hoodie, white PEP tee, orange vest, detective
  suit) meet the base torso at the shared shoulder line (y=404, span x=96..416)
  with the collar sitting around the neck and no gap at the shoulders.
  See `05-clothing.jpg`.
- PASS - No leftover fragments from a previously selected part. Swapping any
  slot replaces that slot cleanly. The base torso is fully covered by each
  clothing layer, the eyes layers draw the full eye so no base socket shows
  through, and `hat_none` / `accessory_none` / `bg_none` are genuinely empty.
  Confirmed across all swap sheets and the random combos (`06-randoms.jpg`).
- PASS - Nothing spills outside the 512 portrait. Every layer uses
  `viewBox="0 0 512 512"` and all drawn geometry stays inside the canvas; no
  element pokes past the portrait frame in any combination, including the
  tallest hats and the open-laugh mouth. See `contact-sheet.jpg`.
- PASS - Still recognizably the SAME Pepe after swaps. Across all 14 contact
  sheet combinations the muted olive head, heavy uneven black outline, large
  white eyes with black pupils, and brown-pink mouth stay constant, so the
  character reads as one consistent hand-drawn Pepe. See `contact-sheet.jpg`
  and `01-neutral.jpg`.

## Misalignment found / fixed

None. The FEAT-001 layers were authored to a single shared 512x512 geometry
contract, so every slot overlapped correctly on first render with NO per-part
CSS offsets in the demonstrator. No layer SVG geometry needed correcting during
this proof. The `grep -L 'viewBox="0 0 512 512"'` gate, the id->file map, the
well-formed-XML gate, and `scripts/check_site.py` all stayed green.

## Screenshot index

| File | Combos | Check it demonstrates |
| --- | --- | --- |
| `01-neutral.jpg` | 1 | Neutral default Pepe (same-Pepe baseline). |
| `02-eyes-variants.jpg` | 6 | Eyes land on the eye line across all eye options. |
| `03-mouths.jpg` | 6 | Mouth fits the face across all mouth options. |
| `04-headwear.jpg` | 6 | Headwear covers the crown across all hats. |
| `05-clothing.jpg` | 6 | Clothing fits neck/shoulders across all outfits. |
| `06-randoms.jpg` | 6 | Full random combos across every slot. |
| `contact-sheet.jpg` | 14 | >=12 distinct combos: no spill, no fragments, same Pepe. |

All files are JPEG (quality ~85). Folder total is about 1.6 MB. Each proof image
is also mirrored to `/projects/sandbox/.kiro/artifacts/screenshots/` with a
`fren-v2-` prefix.
