# A17 — Fine tadpole sprites

Seven formerly coarse tadpole states redrawn using the original tadpole idle and the corresponding old state as references. `tadpole_idle` is unchanged.

Preview `comparison.png`: each pair is old on the left, A17 on the right. Reading order: hungry, dirty, moody, tired, neglected, packing, recovering.

All replacements retain original filenames, 128×128 RGBA, binary alpha, top y=50, foot/belly line y=124, left anchor x=16. No room positioning, gameplay, or reward changes. FINE QA allowlist extended only for these seven filenames. Old 2×2 rules continue to apply to other assets.

Validation: 7/7 replacement geometry and art checks passed; 5/5 existing art regression tests passed on a local snapshot. Browser/device visual review remains pending; keep draft and do not deploy without owner approval.

Next: care animation frames, moving-out frames and hatch. Keep the existing animation timing and pose anchors.
