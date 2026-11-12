# PR #266 trajectory audit

## Reference and reproducibility

`main`: `da3a9869` (2026-11-11 checkout); PR #266 is open/unmerged at `663d5db39a6812034d7922450cae075f665f2b80`. This branch starts at that PR head. Existing classic and beta physics are preserved. `aimArc()` is unchanged.

Run `node scripts/pondwars-trajectory-audit.mjs` and repeat with `--classic`. The script reproduces the exact PR266 preview loop and compares its indexed positions and displayed endpoint with `stepShot()`. Drill runs against a private mask; no explosions, terrain mutations in the live game, RNG consumption or weapon tuning are performed.

Each engine: 10,080 deterministic cases = 7 weapons × 8 terrain fixtures × 4 powers (0.08/0.25/0.55/1) × 5 winds (−1/−0.35/0/0.35/1) × 3 angles (−2.7/−π/4/−0.15 rad) × 3 stationary target distances (40/200/600 px). Fixtures: empty air, floor y=450, one-pixel wall x=510, slope, and seeded island/twin/peaks/small maps. Shooter at (480,260); targets lie along the selected angle. Some generated terrain cases start in soil deliberately, exercising immediate collision. These are synthetic stress fixtures, not an estimate of player-facing error rates.

## Findings

- Free flight agrees to floating point precision for all tested powers/directions/winds and projectile types before a collision/termination. Both implementations update velocity before position at STEP=1/60. Revolver ignores charge; only wind-enabled weapons receive wind.
- Preview checks only the endpoint of each step; impact weapons sweep at ≤3 px, beta fused weapons sweep at ≤1 px. The preview can cross a thin wall that beta grenades bounce off. Classic fused sweeps differ from beta, explaining the difference in the table.
- Preview ignores frogs and owner-clearance rules. Rockets, revolver and bow can actually stop before the drawn arc ends, including targets at 40/200/600 px.
- Preview stops before drawing the first solid sample and marks the previous sample. Even a correctly found impact can therefore have an offset up to one simulation step. This is particularly visible for fast revolver shots.
- Grenade/cluster/gold preview stops at soil, while actual shots reflect, lose energy, settle and detonate on their fuse (3 s for these parent shots). Preview has no fuse and can continue after a mid-air detonation. Child shrapnel/toes and their later explosions are outside its scope.
- Drill preview ends at soil; actual drill carves up to 150 px at 300 px/s before detonation and can immediately advance into the bore.
- Preview horizon is 220 steps (3.667 s), bounds are x −20…W+20, y −80…WATER+30. Actual bounds are x −200…W+200, water WATER+6, time >12 s, with weapon-specific upper limits. High arcs disappear from preview early and low trajectories may show submerged samples.
- Bat, placeables, candles and utilities are explicitly excluded from PR266 arc drawing. They require separate interaction previews, not a fabricated ballistic arc. Internal shard/toe/frog types cannot be selected for this preview.

## Measurements

Divergent = maximum separation >1e−6 px at a shared step, including the terminal actual step. Max endpoint compares the last *displayed* preview point with the actual terminal projectile point; it includes intentional later bounces/boring and differing horizons. It is not a first-impact aiming error metric. Blank-free-flight discrepancies are zero in dedicated tests without targets.

| Weapon | Fixture | Cases | Divergent beta / classic | Max shared separation beta (px) | Max endpoint separation beta (px) | Actual ends earlier / later than preview (beta) |
|---|---|---:|---:|---:|---:|---:|
| rocket | air | 180 | 40 / 40 | 7.93 | 794.06 | 161 / 19 |
| rocket | floor | 180 | 40 / 40 | 7.93 | 747.48 | 78 / 102 |
| rocket | thin-wall | 180 | 43 / 43 | 7.93 | 794.06 | 139 / 41 |
| rocket | slope | 180 | 40 / 40 | 7.93 | 729.34 | 78 / 102 |
| rocket | island | 180 | 37 / 37 | 7.93 | 747.48 | 75 / 105 |
| rocket | twin | 180 | 40 / 40 | 7.93 | 729.34 | 100 / 80 |
| rocket | peaks | 180 | 32 / 32 | 7.71 | 729.34 | 65 / 110 |
| rocket | small | 180 | 40 / 40 | 7.93 | 794.06 | 90 / 90 |
| grenade | air | 180 | 0 / 0 | 0.00 | 250.77 | 150 / 30 |
| grenade | floor | 180 | 0 / 0 | 0.00 | 357.86 | 0 / 180 |
| grenade | thin-wall | 180 | 60 / 0 | 986.19 | 1012.01 | 90 / 75 |
| grenade | slope | 180 | 0 / 0 | 0.00 | 527.94 | 0 / 180 |
| grenade | island | 180 | 0 / 0 | 0.00 | 303.46 | 0 / 180 |
| grenade | twin | 180 | 0 / 0 | 0.00 | 297.19 | 60 / 120 |
| grenade | peaks | 180 | 0 / 0 | 0.00 | 221.31 | 0 / 180 |
| grenade | small | 180 | 0 / 0 | 0.00 | 250.77 | 30 / 150 |
| cluster | air | 180 | 0 / 0 | 0.00 | 250.77 | 150 / 30 |
| cluster | floor | 180 | 0 / 0 | 0.00 | 357.86 | 0 / 180 |
| cluster | thin-wall | 180 | 60 / 0 | 986.19 | 1012.01 | 90 / 75 |
| cluster | slope | 180 | 0 / 0 | 0.00 | 527.94 | 0 / 180 |
| cluster | island | 180 | 0 / 0 | 0.00 | 303.46 | 0 / 180 |
| cluster | twin | 180 | 0 / 0 | 0.00 | 297.19 | 60 / 120 |
| cluster | peaks | 180 | 0 / 0 | 0.00 | 221.31 | 0 / 180 |
| cluster | small | 180 | 0 / 0 | 0.00 | 250.77 | 30 / 150 |
| gold | air | 180 | 0 / 0 | 0.00 | 281.64 | 165 / 15 |
| gold | floor | 180 | 0 / 0 | 0.00 | 405.70 | 0 / 180 |
| gold | thin-wall | 180 | 45 / 0 | 853.80 | 877.61 | 90 / 90 |
| gold | slope | 180 | 0 / 0 | 0.00 | 309.39 | 0 / 180 |
| gold | island | 180 | 0 / 0 | 0.00 | 281.64 | 0 / 180 |
| gold | twin | 180 | 15 / 0 | 5.96 | 531.06 | 60 / 120 |
| gold | peaks | 180 | 15 / 0 | 1.85 | 372.15 | 0 / 180 |
| gold | small | 180 | 0 / 0 | 0.00 | 447.72 | 30 / 150 |
| revolver | air | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | floor | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | thin-wall | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | slope | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | island | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | twin | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| revolver | peaks | 180 | 80 / 80 | 17.14 | 397.14 | 80 / 100 |
| revolver | small | 180 | 140 / 140 | 17.14 | 711.43 | 140 / 40 |
| bow | air | 180 | 55 / 55 | 11.31 | 712.20 | 140 / 40 |
| bow | floor | 180 | 55 / 55 | 11.31 | 712.20 | 90 / 90 |
| bow | thin-wall | 180 | 65 / 65 | 11.31 | 712.20 | 110 / 70 |
| bow | slope | 180 | 55 / 55 | 11.31 | 707.98 | 90 / 90 |
| bow | island | 180 | 55 / 55 | 11.31 | 712.20 | 90 / 90 |
| bow | twin | 180 | 55 / 55 | 11.31 | 712.20 | 110 / 70 |
| bow | peaks | 180 | 40 / 40 | 11.31 | 510.68 | 70 / 105 |
| bow | small | 180 | 55 / 55 | 11.31 | 712.20 | 100 / 80 |
| drill | air | 180 | 0 / 0 | 0.00 | 784.51 | 150 / 30 |
| drill | floor | 180 | 0 / 0 | 0.00 | 737.46 | 90 / 90 |
| drill | thin-wall | 180 | 0 / 0 | 0.00 | 784.51 | 130 / 50 |
| drill | slope | 180 | 0 / 0 | 0.00 | 711.07 | 90 / 90 |
| drill | island | 180 | 0 / 0 | 0.00 | 737.46 | 90 / 90 |
| drill | twin | 180 | 0 / 0 | 0.00 | 737.46 | 110 / 70 |
| drill | peaks | 180 | 0 / 0 | 0.00 | 676.51 | 70 / 100 |
| drill | small | 180 | 0 / 0 | 0.00 | 784.51 | 100 / 80 |

Totals: beta 2002/10,080 shared-step divergences; classic 1807/10,080. The same endpoint limitations also affect cases whose shared-step positions agree.

## Proposed shared prediction model (next PR)

1. Use each engine’s `makeProjectile()` factory for launch origin, owner, power clamp and weapon configuration.
2. Build a pure bounded `predictShot(snapshot, input, options)` adapter over the same `stepShot()` kernel. Pass a copied mask and a frozen snapshot of frogs; use a separate scratch game object so drill cannot touch the real dirty list. Return sampled positions plus events (`impact`, `bounce`, `fuse`, `bore`, `splash`, `gone`) and explicit truncation reason.
3. Separate “first contact” from “path until detonation”; display uncertainty for future frog movement. Secondary explosions/random child fragments need a deliberate product decision and deterministic isolated RNG, not a silently inaccurate arc.
4. Cache by terrain revision, frog positions/alive state, angle, power, weapon and wind; throttle recomputation while dragging on phones. Benchmark cloning the 720,000-byte mask and CPU cost before enabling full-length drill/fused prediction.
5. Add prediction-versus-runtime parity tests across both engines, then replace the drawing-only loop. Keep constants, weapon balance and movement untouched. Review the beta thin-wall sweep improvement separately from animation work.

This PR only measures and documents prediction differences; it does not change aimArc or stepShot.
