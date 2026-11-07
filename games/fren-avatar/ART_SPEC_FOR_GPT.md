# Fren Avatar — art spec for ChatGPT (drop-in layer system)

Hand over this whole document to ChatGPT. The goal: produce **hand-drawn,
MS-Paint-style classic Pepe** art as **separate transparent layers** that drop
into our existing Avatar Maker **without any repositioning**. The mechanics,
Avatar Maker UI, secure save and Fren Passport are already built and tested —
only the final character art is being replaced.

There are **36 layer files** total. Deliver each as its own file with the exact
filename listed in §6. Every file is independent and transparent except
backgrounds.

---

## 1. Hard technical rules (non-negotiable — this is what makes layers line up)

- **Format:** SVG (preferred) OR PNG. Either way, the drawing area is **512×512**.
  - SVG: `<svg viewBox="0 0 512 512" width="512" height="512">`.
  - PNG: exactly **512×512 px**, transparent background (except the `bg_*` files).
- **One shared canvas, one shared pose.** Every part is drawn at its true
  position on the full 512×512 frame — NOT cropped, NOT centered-to-its-own-box.
  A hat is a 512×512 image that is transparent everywhere except where the hat
  sits on the head. This is the single most important rule: do not "trim" a part
  to its bounding box.
- **Transparent per layer.** Only the four `bg_*` files are allowed to fill the
  whole frame. Every other file is transparent wherever that part isn't.
- **No baked-in other parts.** The eyes file contains ONLY eyes. The hat file
  contains ONLY the hat (plus the small cover it needs — see §4). Never draw a
  mouth inside the eyes file, a face inside a hat file, etc.
- **Same head, every time.** The base head/body is drawn once (`base_frog`).
  Eyes/mouth/hat/clothing/accessory are overlays that assume that exact head.

## 2. The character (classic hand-drawn Pepe, from the 6 reference portraits)

- **Muted olive-green skin.** Our current base uses `#7a8b45` (shadow `#637138`).
  Match this muted olive — NOT bright/neon green, NOT a generic frog.
- **Big white eyes** with black pupils and a small white highlight dot.
- **Classic Pepe mouth:** a brown line/lip shape (`#6b3d22`) with a soft pink
  inner (`#d98c86`), characteristic wide Pepe smile/frown.
- **Characteristic brow folds / eyelids / head proportions** of classic Pepe.
- **Heavy, slightly uneven BLACK outlines** (`#16210f`), ~7–8 px stroke weight at
  512 scale. Hand-drawn wobble is good.
- **FLAT fills only.** No gloss, no gradients, no neon, no plastic shine, no
  soft/airbrushed shading, no drop shadows, no 3D. Think MS Paint / marker.
- Keep the **exact same Pepe** across every part so any combination still reads
  as one coherent character.

## 3. Shared geometry — put each part exactly here (coordinates on the 512 canvas)

```
Head center x .............. 256
Top of head (crown) y ...... ~72   (head spans ~y 60..376)
Face widest ................ x ~120..392 (around y 210)
EYE LINE center y .......... 215
  left eye  center ......... (205, 215)
  right eye center ......... (307, 215)
  eye size ................. ~44 half-width, ~40 half-height each
MOUTH center y ............. 300    (mouth spans x ~176..336)
Chin y ..................... ~362
Neck ....................... y 360..404, x ~214..298
SHOULDER line y ............ 404
Shoulders span x ........... 96..416  (clothing must meet the body here)
```

Rules that follow from this:
- **Eyes** must sit centered on **y=215**, left pupil ~x=205, right ~x=307.
- **Mouth** must sit around **y=300**, within x≈176..336, below the eyes, above
  the chin — never crossing the jaw outline.
- **Hats** must cover the **crown (y≈72)** and the brow; the hat's lowest edge/
  brim should sit **above the eye line (y=215)** so it never hides the pupils.
- **Clothing** must meet the body at the **shoulder line (y=404)** and sit a
  collar around the neck (x≈214..298) with no gap at the shoulders.
- **Accessories** (chain/scarf/pin/headphones) sit on the chest/ears area and
  paint on top of everything.

## 4. Paint order & occlusion (why a hat can hide the head cleanly)

Layers are stacked back-to-front in this exact order:

```
bg  →  base  →  clothing  →  mouth  →  eyes  →  hat  →  accessory
```

- Because **hat paints after eyes**, a low brim can overlap the upper eye region
  without being clipped — fine, as long as it stays above y=215.
- If a hat/helmet must **hide part of the base head** (e.g. a beanie covering the
  crown, or the astronaut bubble around the whole head), draw that covering shape
  **inside the hat file itself** (an opaque dome/shape that sits over the crown).
  Do NOT rely on CSS masks or offsets — the covering lives in the art.
- Example from our current PEP cap: an opaque dome spanning roughly y≈52..150
  across the head width, with a brim around y≈150..180. Reuse that footprint.
- The **astronaut helmet** (`hat_astronaut`) is special: an **open-face bubble** —
  the white shell rings the head, but the visor opening over the face stays
  transparent so the eyes/mouth below still read through the "glass". Keep a PEP
  badge on the collar.

## 5. Palette (match these so parts agree)

```
Skin (muted olive) ......... #7a8b45    skin shadow ... #637138
Outline (near-black) ....... #16210f    stroke weight ~7–8 px
Mouth brown ................ #6b3d22    mouth inner pink ... #d98c86
Eye white .................. #f7faec    pupil ... #13200f   highlight ... #ffffff
PEP green (wordmarks) ...... #2f8f46
```
Other item colors (hoodies, vest, crown gold, chain gold, etc.) are free, but
keep them flat and slightly muted to match the MS-Paint feel.

## 6. Deliverables — exactly these 36 files (keep the filenames)

> Backgrounds fill the frame; everything else is transparent except its part.
> The `*_none` files are intentionally **empty** (a transparent 512×512 canvas).

**BASE (1) — the shared head + neck + plain body:**
- `base_frog` — neutral classic Pepe: head, neck, bare olive shoulders/torso
  (clothing is drawn over this). Default closed/neutral — eyes & mouth come from
  their own layers, so the base face has NO eyes and NO mouth drawn on it (just
  the head shape, brow folds, nostrils).

**BACKGROUNDS (4) — fill the full 512×512:**
- `bg_none` (empty/transparent — the maker shows it on white)
- `bg_pond` (simple pond: sky, water, a lily pad; flat)
- `bg_solid_green` (flat studio green card)
- `bg_sunset` (flat retro sunset stripes)  ← reserved unlock, still draw it

**MOUTHS (6) — centered on y≈300:**
- `mouth_smile` (classic calm smile) · `mouth_grin` (teeth grin) ·
  `mouth_open` (open laugh, pink inside) · `mouth_tongue` (tongue out) ·
  `mouth_flat` (neutral straight) · `mouth_smirk` (one-side smirk)

**EYES (6) — centered on the eye line, left (205,215) / right (307,215):**
- `eyes_classic` (big white eyes, centered pupils) · `eyes_sleepy` (half-lidded) ·
  `eyes_wide` (wide, small pupils) · `eyes_shades` (black sunglasses) ·
  `eyes_round` (round glasses over eyes) · `eyes_3d` (red/cyan 3D glasses)

**HATS (8) — cover crown y≈72, brim above y=215:**
- `hat_none` (empty) · `hat_pep_cap` (green cap, "PEP" front) ·
  `hat_beanie` (knit beanie) · `hat_bucket` (bucket hat) ·
  `hat_crown` (gold paper crown) · `hat_astronaut` (open-face space helmet, see §4) ·
  `hat_hardhat` (yellow hard hat) ← unlock · `hat_detective` (deerstalker) ← unlock

**CLOTHING (6) — meet shoulders at y=404, collar at neck:**
- `clothing_blue` (plain blue shirt) · `clothing_purple_hoodie` ·
  `clothing_black_hoodie` (drawstrings) · `clothing_white_pep` (white tee, "PEP") ·
  `clothing_orange_vest` (hi-vis vest) · `clothing_suit` (detective suit+tie) ← unlock

**ACCESSORIES (5) — chest/ears, painted on top:**
- `accessory_none` (empty) · `accessory_chain` (gold chain + P medallion) ·
  `accessory_scarf` (neck scarf) · `accessory_pin` (small PEP lapel pin) ← unlock ·
  `accessory_headphones` (over-ear headphones) ← unlock

## 7. How to check the art is right (ask GPT to self-verify)

Stack the layers in the order from §4 and confirm, for several combinations:
- eyes land on the eye line; both pupils roughly at x=205 and x=307;
- mouth sits under the eyes, above the chin, inside x≈176..336;
- every hat covers the top of the head with no skin gap above it, and no brim
  hides the pupils;
- clothing meets the shoulders with no gap; collar sits on the neck;
- nothing pokes outside the 512 frame;
- swapping any one part leaves no leftover of the previous part (the `*_none`
  files are fully empty);
- across all combinations it still reads as the SAME hand-drawn Pepe.

## 8. What NOT to do

- Don't deliver one finished portrait and slice it up — draw modular layers.
- Don't trim/crop a part to its own bounding box — keep every file 512×512.
- Don't bake eyes/mouth/hat into the base, or any part into another part.
- Don't use gloss, gradients, neon, plastic shading, drop shadows or 3D.
- Don't invent new slot names or filenames — use the 36 names in §6 exactly.
- Don't redraw a different style per option — one consistent Pepe throughout.

---

Deliver the 36 files named exactly as in §6. We drop them into
`docs/meme/avatar-assets/layers/` in place of the current vector art; the
manifest, Avatar Maker and Passport already expect these names and geometry, so
no code changes are needed if the spec is followed.
