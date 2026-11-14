# PondOS 98: master production brief for visual upgrades v1

**Scope:** repair/enhance the existing deployed-codebase UX of `POND KING`, `BATTLE OF THREE LILIES`, and `POND BULLETIN` in `PepecoinHub/pepecoinhub.github.io`. Do not invent new menus, app routes, games, upgrades, rewards, scores, or player names. Keep existing functionality. Treat every illustration as a source asset to export individually rather than a fake full-screen screenshot.

## Non-negotiable art/style rules

- 1998/2000 pixel-art atmosphere compatible with PondOS 98, **not** a glossy modern game/app mockup.
- Windows 98 chrome comes from **existing CSS and HTML**: title bars, grey bevels, classic window borders, status bars, inset panels, small bitmap icons. Never bake whole windows/menus/buttons/score labels into a PNG.
- Pepe meme humor: expressive frog faces (smug, suspicious, exhausted, shocked, annoyed), light surreal/comedic pond details. Avoid polished, sentimental, overly cute aesthetic or treating every frog as always smiling.
- Keep consistent palette (pond greens, dark outline `#142016`, muted VGA purples/greys, yellow crown accents), visible hard pixel edges, nearest-neighbor scaling, no AA/blur/gradients.
- Transparent PNGs for individual sprites/badges/icons. Backdrop/tile sprites may be opaque. Names and dimensions must be declared. One file per logical asset. No collages intended as deployment assets.
- All visible scores, nicknames, ranks, timestamps, links and opponent moves must remain **live from the existing JavaScript + Supabase**. Never draw fake user data into art.
- Preserve all current auth/session behavior, challenge creation and acceptance, 4-hour lockout, 48-hour expiry, player-generated moves, result reveal order, leaderboards, avatars, navigations and PondOS iframe gadget.
- Small mobile windows (320 px width) must remain readable. Screenreader labels, reduced-motion behavior and existing button targets must survive.
- Never merge, deploy or change Supabase schema without explicit user approval.

## Target files

- `docs/games/pond-king.html`, `docs/games/lilies.html`, `docs/games/bulletin.html`: add only two resource links, no layout rewrite.
- `docs/games/pond-visual-upgrade.css`: additive restyling, loaded last.
- `docs/games/js/pond-visual-upgrade.js`: decoration only, never calls game RPCs.
- `docs/games/img/pond/visual-v1/*.png`: all new artwork, never overwrite current images.

## Package 1

- Pond King live throne background with existing player's avatar in foreground, better rounds row reveal and result stamps (WIN, LOSS, DRAW).
- Three Lilies: pinned parchment-like challenge cards, OPEN / REMATCH tags, original accept/cancel and countdown controls untouched.
- Bulletin: true cork background and pinned varied sheets, event-specific clippings for king vs lilies, still populated with real board events.
- Six badge sprites: OPEN / WIN / LOSS / DRAW / NEW / REMATCH. `NEW` is an available asset, do **not** assign it indiscriminately to old challenges.

## Package 2

- Frog expression portraits (reusable clean 64x64 sprites).
- Four small, deployable state sprites: WAITING, VICTORY, DEFEAT, QUIET POND. Avoid obscuring data; initial use: WAITING in king cooldown and QUIET POND in empty Lily list, remaining sprites reusable.
- Cleaner existing leaderboard/record rows, without invented ranking values.
- 16x16 / 32x32 icon family, used selectively and with existing icon references preserved until explicitly switched.

## Integration and QA

1. Inspect **latest** code and existing assets before integration.
2. Apply `tools/apply_to_repo.py --repo <checkout> --dry-run`, then without `--dry-run`.
3. Check HTML resource links load; image URLs have 200 response; zero CSP violations or JS console errors.
4. Test Pond King: choose 3 moves, duel, reveal round by round, new king, cooldown, passport link, auto refresh, `?gadget=1`.
5. Test Lilies: open challenges, create (10 flies), accept, result, draw, rematch, countdown, empty state, login flow, `?gadget=1`.
6. Test Bulletin: open challenges, new king, long reign, Lily win/draw, event links, refresh.
7. Test 320/375/768px viewport widths and prefers-reduced-motion.
8. Do not merge/deploy without explicit user approval.

**Important:** This visual ZIP is not a production deployment or a full replacement of existing game data. It is a small, additive, ready-to-integrate source package that respects actual IDs/classes from main as inspected on 2026-11-14. If main/PR changes, verify selectors before apply.
