# Weapon art handoff — prototype only

Phase2 v11 is installed in this art-only branch above PR #281. Doge flight/blast, Silver Donkey fall/impact, Moon flight and falling PEP tokens use the supplied original PNGs. Ban Hammer is copied for review but remains unregistered for manual hand calibration; Silver Donkey warning remains SVG because v11 supplies no warning clip. Other missing roles retain the previous SVG/Canvas fallback. HUD PNGs never act as projectile frames.

`manifest.json` separates `flight`, `activation`, and `explosion` from HUD. Clips specify `src` relative to games/, `frame` [source width,height], `columns`, `frames`, `fps`, `loop`, `anchor` [source x,y], and `size` [world width,height]. V11 consists of horizontal 128×128 frames on an original 2×2 pixel grid, not a 2×2 atlas layout. Source SHA-256 hashes, alpha bounds and edge contacts are checked by `scripts/pondwars-v11-assets.py`; no PNG was redrawn, smoothed, stretched or padded.

Optional `rotationOffset` corrects the authored nose axis (Moon +π/4, since the source points diagonally). Doge/Moon still rotate along the existing velocity; this never changes flight physics or hitboxes. Optional `reducedFrame` picks a static visible explosion poster (frame 4); flight freezes at frame 0 in reduced motion. Donkey flight age starts after its existing warning, not at the start of the warning timer. Render anchors map to physical projectile positions; visual scale never changes projectileOrigin.

FX use the existing animator clock, pause with the game and clear on new match/restore. V11 explosions run their full frames/fps duration without a second fade; the generic Canvas blast is suppressed only while the loaded authored PNG is present at that impact. Particle debris/sound and simulation remain unchanged. No rendering data enters game snapshots.

V10 PNGs remain HUD/FX only. Mega still uses its separate existing gold.svg projectile/toe/footprint fallback; Bell/Frog Mine keep their previous v10 FX. Dedicated Moon/PEP explosion art is not supplied. V11 Donkey touches the right frame boundary in all flight frames; Donkey impact frame 7, Doge blast frame 7 and PEP top edges also need visual review. Do not fix these by changing collision or distorting originals.

The original handoff instructions, installer, patch/review manifests and source validation remain in `v11/handoff/` for audit. The installer dry-run and apply logs are preserved there. Re-running the unmodified source installer restores its descriptors and removes the deliberate local Moon rotation/poster metadata; use git review before doing so. The supplied preview has PEP/Ban captions swapped; actual files and runtime mapping were verified visually.

Map slots remain separate distant-background decorations with NO COLLISION labels, never writes to the destructible terrain. Physical Android/iPhone testing, Ban hand calibration and gameplay decisions on Frog Mine/thin roofs remain outside this art integration.
