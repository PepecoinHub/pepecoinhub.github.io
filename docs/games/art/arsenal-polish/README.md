# Weapon art — QA prototypes

The live manifest combines v11 flight art, the compensated Silver Donkey v12 flight and six v13 FX roles. Original PNGs, manifests and source audits remain in versioned directories; HUD images are separate. No art approval or production deployment is implied.

Clips specify a PNG `src` relative to games/, `frame`, `columns`, `frames`, `fps`, `loop`, source `anchor` and world `size`. `rotationOffset` corrects an authored axis; `reducedFrame` selects a static visible poster. All source files stay byte-identical to the owner packages. Frame rectangles and visual scale never change physical origins, hitboxes or damage.

V13 supplies Doge/Donkey/Moon/individual PEP explosions, Donkey warning and Ban impact. FX use the existing animator clock, full frames/fps duration, pause and clear on match reset/restore. Loaded authored effects replace the generic blast at the same point. Donkey warning renders above its existing target during the unchanged warning phase, behind actors and identification labels. Flights and older skins/helmet remain separate.

Ban uses the existing SVG weapon with grip pixel [34,46] mapped to the actual animated hand at 38×38. Only cosmetic `melee_contacts` metadata is added inside the already-resolved melee loop. Sparks appear at the near side of actual contacts, at clamped hand/torso height. No PNG contact is played on a miss or at the strict 48px boundary. The old generic melee flash is hidden in presentation; serialized gameplay remains identical. The v11 full hammer concept atlas is still not registered as a flying sprite.

Validation: scripts/pondwars-v13-assets.py checks six original hashes, 42 frames, source alpha boxes, safe margins and non-destructive merging. scripts/pondwars-v13-parity.mjs compares serialized gameplay with #283. Browser/video QA uses the real terrain and game loop; simultaneous-six-PEP and close Ban actors are explicit test fixtures. Physical Android/iPhone testing remains open.

The current report is docs/games/reports/FROGAGEDDON-FX-V13.md. Historical v11/v12 reports retain their original results. Do not reapply older installers over the live manifest without reviewing the intended role merge.
