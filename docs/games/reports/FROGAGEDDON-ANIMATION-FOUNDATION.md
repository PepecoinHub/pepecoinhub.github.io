# FROGAGEDDON 2.0 — animation foundation review

## Scope and references

Reviewed main `da3a9869aff03387352bef3523311f0f151d7337`, beta, classic and open PR #266 (`663d5db39a6812034d7922450cae075f665f2b80`). Work lives on `feat/frogageddon-animation-foundation`, based on #266. The Draft PR targets `cursor/frogageddon-ui-polish-325a` so its diff contains only this foundation. After #266 merges, retarget/rebase the draft onto main before owner review/merge. Neither merge nor production publication is part of this work.

## Implemented

`pondwars-animation.mjs` is a DOM-free presentation module. It owns an animation clock, per-character state history, transient priorities, procedural poses, shared sprite/hand transforms and a validated optional sprite-manifest adapter. Beta integrates it at the existing event-consumption point and reads health/ground/flight state without adding simulation fields. All eight existing skins retain their source images, crops, orientation corrections and render sizes. Classic remains the reference game from #266.

| Animation | Trigger / visible procedural behavior |
|---|---|
| idle | Inactive grounded frog; gentle breathing |
| aim | Current grounded frog during aim; subtle lean |
| charge | Local, CPU or remote charge; compression and restrained anticipation |
| fire / recoil | Existing fire event; 0.28 s lean and horizontal recoil; external weapon stays visible |
| jump | Airborne with negative vy; stretch/lean |
| backflip | Existing flipT/hopFace; rotation follows engine jump progress |
| falling | Airborne with nonnegative vy; wider silhouette |
| landing | Ground transition; 0.22 s squash and recovery |
| hit | HP reduction; 0.32 s flinch |
| victory | Living member of winning team after over; small celebration |
| KO | Dead/zero-HP frog; 0.55 s fall/fade before the existing tombstone |

Priority: KO, active transient (damage supersedes recoil/landing), winning celebration, airborne state, aim/charge, idle. Water deaths retain the existing splash disappearance. Turn labels, team markers, aiming line and projectile launch coordinates remain in world space. Held weapon grip follows the visual body transform while retaining #266's hand height; weapon orientation/calibration stays from #266. There is no claim of new anatomical grips for the static illustrations.

Animation depends on elapsed presentation seconds, not frame counts. Pause freezes both clock and canvas (including previously random particles/flames/shake). Reduced motion updates live when the preference changes, disables procedural deformation/rotation, freezes optional sprite playback on frame zero and retains the existing static KO fallback. A new match clears animation history. These changes do not alter hitboxes, physics, weapon values, network protocol, Supabase, SQL or rewards.

## Future ChatGPT assets

None are needed to review this procedural foundation. Later: approved transparent clips for each of the eight skins and eleven states, right-facing art without baked-in weapons, a shared canvas per pack, fixed foot registration and per-frame hand grips. Exact source dimensions remain a production-art decision after review of the measured existing proportions. See [asset contract](../PONDWARS-ANIMATION-ASSETS.md), including filename rules, measured source/crop dimensions, anchor units and manifest example. The optional registration adapter already renders clips with static-art fallback; no engine rewrite is required.

## Validation

- Game-specific tests: 45/45 (32 classic, 2 beta, 7 animation, 4 trajectory).
- Full Node suite: 184 tests, 173 passed, 11 skipped, 0 failed. Run outside the restricted sandbox: its subprocess restrictions otherwise produce EPERM in launch-kit/prebake tests. No failures remain in the unrestricted run.
- `python scripts/check_site.py`: passed (179 HTML, 538 JSON, 46 JS).
- `python scripts/check_i18n.py`: passed; pre-existing glossary ID-order warnings and German external-link variation remain outside scope.
- Python unit suite: 2/2 passed. `git diff --check` passed.
- Automated Chromium: desktop 1440×900, touch/mobile emulation 390×844 at DPR2, reduced motion 1000×750. All eight skins selected together; aim/backflip/fire smoke paths; zero page errors; paused canvas screenshots byte-identical over 300 ms in all profiles. This is browser emulation, not real-device Safari/Android certification.
- 30/60/144 FPS unit samples agree within 1e-10; pause, all state transitions, reduced motion, two-direction hand transforms, clip playback/fallback/validation and a seeded simulation comparison with/without animation are covered.
- Trajectory audit: 10,080 fixtures per engine; see [full measurements and shared-model proposal](PONDWARS-TRAJECTORY-AUDIT.md). Free-flight acceleration agrees; collisions, fuses, bounces, drilling, hitboxes and bounds differ from the current preview. Neither aimArc nor weapon balance was changed.

Reproduce the game tests with `node --test tests/pondwars*.test.mjs`. Run the audit with `node scripts/pondwars-trajectory-audit.mjs` and `--classic`. For browser checks, serve `docs` locally on port 8000, then run `python scripts/pondwars-animation-browser.py` (requires Playwright and Chromium). Screenshots are written under `/tmp/pondwars-animation-artifacts` and are not game assets.

## Next PR

Implement and benchmark a snapshot-based prediction adapter using the existing makeProjectile/stepShot functions, with parity tests and explicit first-contact vs detonation semantics. Review dedicated animation art/anchors in a separate art PR; tune or disable procedural overlays for authored clips after visual approval. Validate phone landscape, real touch devices and online resynchronization behavior before enabling a broader rollout. Keep classic as the comparison baseline until owner approval.
