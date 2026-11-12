# Frogageddon 2.0 – Phase 2 v11 sprite handoff for PR #281

This ZIP contains **the original binary 2x2-grid RGBA PNG atlases** from `Frogageddon_Arsenal_Phase2_v11.zip`, without redrawing or resizing them. All seven atlases are source originals, not screenshot cutouts.

## Included clips
- `doge`: flight (8 at 10fps), explosion (8 at 14fps)
- `donkey`: falling (8 at 12fps), impact (8 at 14fps)
- `moon`: projectile flight (6 at 10fps)
- `pep`: falling PEP token (6 at 10fps)
- `ban`: hammer motion concept (6 at 12fps); **not installed by default** because its anchor must be attached to the frog's hand.

The ZIP also contains `codex/manifest_patch.json` and `codex/apply_v11.py`. It does NOT include production code, engine changes, new damage values, or changes to Supabase.

## Integration instructions for Codex (PR #281)
1. Upload this ZIP to Codex's task environment; the original ChatGPT sandbox attachment is NOT automatically available to Cursor/Codex cloud sessions.
2. Check out PR #281 branch `feat/frogageddon-arsenal-polish-playtest` (or make a new draft art-only branch based on it).
3. Extract the ZIP into a temporary folder (not directly into the site), for example `/tmp/frog-v11`.
4. In the repository root: `python /tmp/frog-v11/codex/apply_v11.py --repo . --assets /tmp/frog-v11` to dry-run.
5. If clean, run the same command with `--apply`. This copies seven atlases and merges the approved clip descriptors into the existing art manifest, preserving every other entry.
6. Run `node --test tests/pondwars*.test.mjs`, `python scripts/check_site.py`, browser QA with `?packs=all&maps=all`, check pause/reduced-motion and character/weapon overlays.
7. Keep PR draft, do NOT merge/deploy without owner approval.

## Important visual review
- The sprite art is oriented right; the existing renderer rotates Doge/Moon along velocity. Confirm manual detonation visually matches the current projectile location.
- The donkey atlas has non-transparent pixels at the **right frame boundary** in several frames; artwork edges may appear clipped. Do not auto-smooth or stretch; request a corrected atlas if visually obvious.
- Ban Hammer is a swing effect with a moving frog in some frames, and cannot simply be drawn at a projectile location. It is deliberately NOT automatically registered. Bind it to the character's hand/animation event in a separate review.
- Donkey explosion size 178×178 world px and Doge explosion 108×108 are proposals for visual QA; they do not change gameplay radius.
- Silver Donkey warning remains the existing SVG placeholder. A distinct warning sprite is NOT supplied by v11.
- New pack PNGs are visual prototypes; approve appearance at game scale before using as defaults.

## Current blockers outside art
Physical Android/iPhone touch test remains outstanding. Frog Mine self-damage and Silver Donkey damage through thin roofs require separate gameplay decisions. No balance fixes are included here.
