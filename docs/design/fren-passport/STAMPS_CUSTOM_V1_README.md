# Fren Passport — custom stamp art v1 (review only)

Five candidate dedicated stamp illustrations for live achievements that currently use fallback icons. The source is a hand-drawn aesthetic similar to Lily’s postage stamps. Lily’s fifteen existing drawings are not modified, and all five stamps are **art candidates only**, not live awards.

## Assets

- `source/`: 432×496 full-size RGBA PNG for review and future edits.
- `tiles/`: individual 138×150 RGBA PNG ready for atlas usage.
- `stamps-custom-v1.webp`: 690×150 single-row lossless WebP atlas, five tiles in manifest order.
- `previews/`: review sheet and 2× atlas test.
- `ART_MANIFEST.json`: exact achievement IDs and tile positions.

## Integrating after owner approval

Extend `docs/meme/meme.js` with a `PP_CUSTOM` array in the manifest order, render `ppSprite('pp-art pp-art-stamp is-custom', PP_CUSTOM, x.id)` for earned stamps before falling through to legacy fallback. In `docs/meme/passport.css` add `.pp-art-stamp.is-custom { background-image: url(passport-assets/stamps-custom-v1.webp?v=...); background-size: 500% 100%; }`. Copy atlas to `docs/meme/passport-assets/` only on approved merge. Do not modify `PP_LILY`, existing SQL, achievements status, nor allow the client to mint awards.

**Crucial**: the legacy stamp strip is 16 icons; these five artworks replace only icon selection for the five IDs when genuinely earned. Unassigned new art must keep using its legacy category icon. The source PNGs were cut from a generated 3×2 sheet; review fine details, lettering and theme accuracy alongside Lily's art before deciding to merge.
