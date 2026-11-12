# FROGAGEDDON animation asset contract v1

The first implementation uses the approved existing art. No replacement illustrations or generated sprites are required for this PR. The adapter is in `js/pondwars-animation.mjs`; beta exposes `registerCharacterAnimation(playerId, manifest, loadedImage)` for a future asset loader. Missing states and images that have not loaded retain the current skin.

## Measured existing proportions

Measurements use `pondwars-players.mjs` source rectangles, not guessed square sprites. Rendering currently uses height 64 world pixels and width `min(64, 64 * cropWidth / cropHeight)`.

| ID | Source image | Existing crop | Render width × height |
|---|---|---|---|
| classic | 237×256 | 185×239 | 49.54×64 |
| juice | 159×256 | 135×215 | 40.19×64 |
| street | 161×256 | 117×227 | 32.99×64 |
| dolphin | 41×49 | 41×49 | 53.55×64 |
| penguin | 39×51 | 39×51 | 48.94×64 |
| farmer | 768×384 shared atlas | 384×384 | 64×64 |
| briefs | 768×384 shared atlas | 384×384 | 64×64 |
| traveler | 360×339 | full image | 64×64 |

These dimensions include each existing crop's transparent padding. They do not establish anatomical hand locations. The current renderer's universal grip is `(0,-32)` relative to the frog's feet; precise grips can be supplied per frame without changing projectile launch physics.

## Deliverables for a later art PR

Use `img/pondwars/players/animations/<player-id>/v1/manifest.json` plus `atlas.webp` (lossless alpha) or `atlas.png`. An editable source can use `<player-id>.<state>.<0000>.png`; pack those frames into the atlas without trimming or rotation. IDs must match the eight existing PLAYERS entries.

Every frame in one pack has a common `frameSize: [width,height]`, with identical transparent canvas dimensions across all states. A shared canvas for all eight packs is desirable for production; choose it after art review of these proportions and padding for flips/poses. The engine accepts rectangular canvases and has no fixed 256/384/512 requirement. Preserve character proportions, line style and approved costume. Do not upscale the small pixel characters into a new drawing style without owner approval.

Prepare clips `idle`, `aim`, `charge`, `fire` (includes recoil), `jump`, `backflip`, `falling`, `landing`, `hit`, `victory`, `ko`. Loop idle/aim/charge/falling/victory; clamp fire/landing/hit/ko on their last frames. Playback is seconds × fps, independent of render FPS. Suggested starting rates are 8–12 fps, subject to visual review. The animation state names are lowercase; KO is `ko`, recoil is `fire`.

All art faces RIGHT. The renderer mirrors the complete character and hand anchor for left-facing frogs. Do not bake weapons into the art: PR #266's external weapon layer follows the per-frame hand anchor and the existing aim angle. Projectile origins and hitboxes stay in engine coordinates.

For every frame supply `rect: [atlasX,atlasY,width,height]`, `foot: [x,y]`, and `hand: [x,y]` in that frame's local source pixels. `foot` is the common ground contact/pivot, including airborne poses; retain the same registration across frames to prevent foot sliding. `hand` is the external weapon grip. Render scale is `64 / frameHeight`; anchors are converted by that same scale. Keep export padding stable: changing canvas height changes apparent character scale. The existing procedural transform pivots at `(0,-29)` above the simulation feet. Per-frame anchors pass through the same transform as the artwork. Dedicated clips currently receive these small procedural overlays as well; an art PR can tune overlays after review without touching physics.

Example (384 is illustrative, not a required delivery size):

```json
{
  "version": 1,
  "facing": "right",
  "frameSize": [384, 384],
  "clips": {
    "aim": {
      "fps": 10,
      "loop": true,
      "frames": [
        { "rect": [0, 0, 384, 384], "foot": [192, 384], "hand": [192, 192] }
      ]
    }
  }
}
```

The image should be decoded before registration. Invalid manifests are rejected at registration. Reduced motion displays frame zero with neutral procedural transforms (KO uses a static faded pose/tombstone); pause freezes the canvas and animation clock. No new gameplay or network fields are required. The loader/atlas generation pipeline, final illustrations and owner acceptance of anatomical anchors belong to the next art PR.
