# PepeGochi interactions roadmap (owner-approved direction, 2026-11-16)

Goal: PepeGochi is the living mascot of PondOS, a Tamagotchi mixed with the Office 97 assistant, not just another game.

## Release placement — owner decision, 2026-11-16
PR #353 belongs to the full PepeGochi product launch. Ship all implemented companion features together with that product; do not release them separately or now. Keep the PR draft and the current beta gate until explicit launch approval. Tracked in [the product launch checklist](LAUNCH_FREN_PASSPORT_PEPEGOCHI.md#pepegochi-release-bundle--owner-decision-2026-11-16).

## Implemented in this draft: taskbar companion and bond
- One click opens a Win98 conversation. Double-click or the room button opens the existing PEPEGOCHI.EXE. Before adoption and after departure, click opens the room directly.
- Right click opens the same menu. Keyboard and touch users can use the menu with a single activation.
- How are you, joke, play, pet, what's new, daily Pond Quiz when available, visit room. Play and what's new are local dialogue for now, not a claim of new live activity.
- Intentional mouse drag over the frog pets it; repeated single clicks produce annoyed reactions. Reuse existing talk, laugh, moody and wave sprites. Real pet needs, young stages, sleep and warnings are never overridden with a fake healthy adult.
- Name in the conversation header, memories based on authoritative care days, familiar responses after spaced gentle pats, and a request for space after repeated petting. No care/progression reward for clicking.
- Browser-local memory is scoped to account + `life_id`: familiar pats, last visit, quiet preference. It survives reload on this browser only, handles blocked/corrupt storage, and resets on account/life changes. It is not synced pet state.
- Reactions to observed increases in food, cleanliness, mood and energy; growth; return after 30 minutes; connectivity; and real quiz results. Care/growth observations come from existing state reads, without extra requests or polling. Quiz reactions are saved for the next conversation so they do not cover the quiz.
- Passive comments expire after six seconds, at most one per 45 seconds. They never take focus or pointer input, do not appear during a conversation, quiz, hidden tab or focused game iframe, and can be muted in the conversation. Suppressed events remain available as conversation cues. No sounds.
- State poses and warning dialogue override all cosmetic reactions; a refreshed hungry frog cannot keep its old laugh. Account changes invalidate in-flight quiz answers. Beta access, actual care, rewards and database remain unchanged.

## Companion personality (implemented)
- Dry Pepe humour and cheeky reactions. No guilt for absence or rewards for clicking.
- Ball, rubber duck and bottle cap can be offered from the conversation. Each life has a stable favourite; three spaced play interactions reveal it. Toy play is cosmetic: the existing room care action still owns real mood/needs. Rapid throws receive a request to slow down.
- A healthy adult can initiate contact after 90 seconds present and 45 seconds without document input, at most once per eight minutes. It shows its favourite toy and a short invitation without taking focus. No invitations over a conversation, quiz, focused iframe, hidden tab or quiet mode. Current reduced-motion mode also suspends the idle scheduler.
- YEET THE PEP, PEPE SWEEPER and Gold Hook report actual round starts/finishes to their same-origin parent. The companion validates exact iframe path/source, run ID and unchanged owner/life, consumes a finish once, and comments on loss, win, observed personal best or Moon landing. These are client-side observations, never verified leaderboard claims or awards.
- A small local journal keeps first favourite-toy discovery, observed win, personal best and Moon landing. Favourite, invitation cooldown and journal persist per account/life in this browser, not across devices. They tolerate unavailable/corrupt storage.
- Chromium exercised toy discovery and a real Sweeper loss end-to-end; Node covers event rejection, duplicate results, identity changes, persistence and invitation throttling.

## Room visual refresh A11 (implemented)
- Richer 640×400 pond-den background, exported on a 2×2 grid: lily wallpaper, moonlit pond window and curtains, detailed wood, stitched bed and woven rug.
- Separate humorous house sign and prop shadows. Existing slot anchors, owned item layers, frog positions and departure behaviour remain unchanged. Empty shelves stay empty until the player owns their decorations.
- Offline visual review: `pepegochi/room-a11/preview.html`; Chromium tests use actual renderer and fixture inventory at 320/390/900 px.
- Included in the same held full-product release as #353; no separate launch.

## Next phases (not implemented here)
1. Room: click the frog and existing props; TV opens PepTV only with explicit input, bed routes to real rest, lamp toggles, plant watering, ball/play, and radio/dance if present. Respect actual room inventory rather than inventing objects. A decorative click cannot change a pet need except through the existing validated care flow.
2. Additional site events: other arcade games, verified stamp award, weekly Guesser result and Pond King update. Connect only existing verified result paths; never infer wins from opening/closing a window. Reuse the mute/throttle and avoid interrupting game controls.
3. A10 implemented: 20 new frames for nuzzle, welcome, curious, sulk and yawn; single playback, safe cancellation, preload and reduced-motion support. Review/download package: `pepegochi/companion-a10/PepeGochi-A10.zip`. Future art can add startled-awake and stage-specific expressions. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## QA
Validation: `node --test tests/*.test.mjs` (346 passed, 26 environment skips), site/i18n checks and Python tests. `node tests/pepegochi-companion-browser.cjs` runs the actual taskbar controller in Chromium with local fixtures; uses PLAYWRIGHT_MODULE/HAZE_CHROMIUM overrides when needed. Covers keyboard/touch, room opening, memories, care state priority, focus, throttle, mute/reload, account isolation, return greeting, stale quiz answer, 320/390/1440px and teardown. No production service is contacted. Keep beta gate intact; no merge or production deployment without approval.
