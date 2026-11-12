# Fren Passport: drawings that were never included in any PR

**Art archive only.** This Draft PR holds **28 individual PNG *variants*** that were made in ChatGPT sessions but not previously committed to PR #230 / #231 / #233. It does not represent 28 distinct new achievements. The existing PR #233 remains the source of the current art set; [v3 specification in PR #231](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/231) governs labels, motifs and reward rules.

## Three groups

- `individual/01_latest/`: **6** exploratory variants (2 each) for `yeet_adept`, `good_game`, `checkmate`. **Most depict the wrong action**, so they are *not approved for integration*.
- `individual/02_future/`: **5** rough concepts for `interior_designer`, `secret_starter`, `treasure_hunter`, `frogageddon_beta`, `frogmas`. They also require verification against v3; only Frogmas is approximately on brief.
- `individual/03_old_alternates/`: **17** historical alternatives, many replaced by the approved hand-drawn style from PR #233; some use an astronaut suit or otherwise violate v3. Keep as archive, do not add them to the sprite atlas.

The three `overview_*.jpg` boards provide a fast visual comparison. `MANIFEST.json` lists every file, native pixel size, origin, SHA256, and problem description. Each file is a real PNG; original resolution has been retained (no artificial upscaling). Some are low-res crops of generated sheets.

## For Claude / Kiro

1. Read `MANIFEST.json` first, especially the `quality` and `note` fields. **Do not assume that any of these are approved illustrations**.
2. Compare with the **final v3 card** in PR #231 and the accepted stamp appearance in PR #233.
3. The unfinished `Adept` must show the actual YEET pilot in a red helmet, launched from a slingshot at **3000 m**. The sketches here are incorrect.
4. `Good Game` should show two Fren characters **shaking hands across a table with chess/Connect Four**. The sketches here show a lone gamer, incorrect.
5. `Checkmate!` needs a **tipped black king beside the white queen**, smug Pepe with crossed arms. The sketches here are incomplete.
6. Do not rewrite the achievement catalog or unlock anything based on these files. Confirm any selected image with the owner before placing it in a production asset directory.
7. **Do not touch special avatars**. The owner explicitly paused them.

## Boundaries

This PR contains art review assets and documentation only. No HTML, CSS, JS, SQL, Supabase, backend, Passport awards, production deployments or merges.
