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

## Living desktop A12 (draft implementation, 2026-11-18)
- The healthy adult reacts to actual animated night-wallpaper fireflies, with a short curiosity/tongue sequence. Click a visible light on the exposed desktop or choose **Catch a firefly** in the conversation when a visible light is available; nearby lights can also trigger a rare idle reaction. The light returns to the wallpaper afterwards. Day, still and wallpaper-demo modes do not trigger the interaction.
- The frog briefly hops onto the upper edge of a suitable opened utility window (Games/Find/Recycle Bin/Notepad and selected folders), rests there and hops back. Narrow, maximized, minimized, iframe or unsafe-position windows do not get a perch. The overlay never captures clicks or focus and does not change the window position; movement, close, resize, input or a need interrupts it.
- Opening Pond TV brings out a tiny retro popcorn prop. Selected non-game apps get contextual dry Pepe remarks, with the existing reaction cooldown and quiet setting. Refocus/restore does not repeat an opening. Games retain their own observed-result hooks.
- Reuses the existing approved 48×48 frog assets and native CSS effects; no new pet art or network calls, no changes to actual needs, evolution, awards, secrets or persistence. A young frog, a real needs pose, absent/departed pet, focused iframe and hidden tab take priority. Reduced motion disables visual effects.
- Local controller unit tests cover geometry, visible night lights, cooldown, actual app selection, cancellation, cleanup and care priority; `node tests/pepegochi-desktop-browser.cjs` adds a Chromium fixture for end-to-end review. Browser launch in the current execution environment was denied by the OS; complete the browser and real desktop visual review before launch.
- Future (not implemented): richer weather or seasonal reactions, more window behaviours, and verified event awards only after explicit approval. No rare-firefly stamp in this draft.

## Interactive room A13 (draft implementation, 2026-11-18)
- Click the frog to pet it and hear age/need/status-specific replies; use only the approved art. The lamp dims the room, the plant can be watered, and the mug, poster and unlocked treasures have dry Pepe dialogue. No new items or fake rewards.
- The bed and rubber duck use the exact same validated Rest/Play path as the existing care buttons. Disabled or busy actions do not call care; cooldown, daily limits, accepted actions and all rewards remain server-owned. All other clicks are cosmetic and do not issue RPCs.
- The CRT opens Pond TV only on explicit click, via the same-origin room iframe and its parent app handler. No automatic video playback or arbitrary URL. Guest, missing inventory and moved-out states do not expose unavailable items.
- Native buttons positioned on opaque sprite bounds, keyboard focus and a collapsible Room controls list for small/touch screens. Reduced motion skips local effects; lamp preference is transient per frog life, not inventory or synced state. No SQL or beta-gate changes.
- Targeted Node tests: 12 passed (including original live-window tests). `node tests/pepegochi-room-interactions-browser.cjs` exercises the actual live window with a fixture backend and the room-to-TV parent handler; Chromium startup was blocked by the OS here, so complete browser QA before launch.
- Held as a separate draft PR on top of the existing companion. Do not merge, deploy or run production SQL before approval.

## Room personality and effects A14 (draft implementation, 2026-11-18)
- Native retro pixel particles on the approved room graphics: hearts and short hop after a pat, egg wobble (not a hatch), falling blue water drops, bouncing duck with squeak marks, steam above the mug and twinkles on decorations. No replacement artwork, remote assets or sound.
- Three age-specific pet responses per stage rotate locally during a life. Four or more closely spaced pats ask for personal space; real hunger, neglect, packing and recovery still get priority. No penalty, progression or reward from petting.
- At most one short overlay, up to four decorative pixels, removed after at most one second or on hiding/replacing/unmounting. Reduced motion never starts a particle effect. Normal care actions and accepted care frame animations are unchanged.
- Targeted Node tests: 15 passed including 3 particle/controller tests; the browser fixture now checks particles and reduction/cleanup. Browser visual QA remains a launch prerequisite. Included in the held A13 draft PR #357; no separate deployment.

## Next phases (not implemented here)
1. Room: additional toys and stage-specific hand-drawn room animations only with approved art and owned inventory; consider radio/dance later if a radio item exists.
2. Additional site events: other arcade games, verified stamp award, weekly Guesser result and Pond King update. Connect only existing verified result paths; never infer wins from opening/closing a window. Reuse the mute/throttle and avoid interrupting game controls.
3. A10 implemented: 20 new frames for nuzzle, welcome, curious, sulk and yawn; single playback, safe cancellation, preload and reduced-motion support. Review/download package: `pepegochi/companion-a10/PepeGochi-A10.zip`. Future art can add startled-awake and stage-specific expressions. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## QA
Validation: `node --test tests/*.test.mjs` (346 passed, 26 environment skips), site/i18n checks and Python tests. `node tests/pepegochi-companion-browser.cjs` runs the actual taskbar controller in Chromium with local fixtures; uses PLAYWRIGHT_MODULE/HAZE_CHROMIUM overrides when needed. Covers keyboard/touch, room opening, memories, care state priority, focus, throttle, mute/reload, account isolation, return greeting, stale quiz answer, 320/390/1440px and teardown. No production service is contacted. Keep beta gate intact; no merge or production deployment without approval.
