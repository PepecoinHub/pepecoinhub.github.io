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

## Dialog polish A12.1 (2026-11-18; pending release)
- High-contrast Win98 buttons in both the companion dialog and Pond Quiz, independent of dark desktop chrome. Larger targets, focus/hover/pressed states and visible quiz saving/error feedback; the companion uses two columns and scrolls back to its reply after selection.
- Egg, tadpole and froglet retain their own poses but no longer return an identical reply to every action. Healthy froglets can use desk toys and stage-appropriate desktop effects with the existing sprite. Froglets with a low need explain why they cannot play. Quiet suppresses automatic reactions, not a deliberate firefly click or conversation.
- No new care actions, RPCs, wallet features, secrets or awards. Test the new conversation and quiz behavior on 320/390px in dark and light themes before release.

## Pond Rumors A13 (draft, 2026-11-18)
- **Pond Rumors** and **Secret Journal** appear in the companion's existing Win98 conversation, including young frogs and quiet mode. No mandatory adoption to discover existing secrets; the Passport and its discovery paths are unchanged.
- Twelve already-live Passport trails get a subtle public clue and an optional second, more contextual clue. The seven planned catalog entries do not acquire hints or unlocks. One suggested missing trail changes with UTC day or a newly recorded find; the journal lists only discoveries in the authenticated player's own server response, not undiscovered names. All-known completion, signed-out state, and failed reads have distinct messages.
- Only on explicit input, read the existing `gry_passport_state` RPC. No new SQL, table, claim RPC, badge, payment, polling, or persistent secret cache. Deduplicate requests, cache only discovery rows for 15 seconds in memory, invalidate on account/life changes or supported confirmed discovery callbacks, and drop stale responses when the dialog is closed or replaced. Owner sandbox has no Rumors controls. A second clue needs no extra request. Existing direct/chat/share discovery callbacks can trigger a cosmetic, muted/throttled frog reaction without modifying entitlement or interrupting other conversations.
- The existing public legacy secret mechanisms are not hardened by this release. A future private story (map fragments, multi-step puzzle and founder's real message) must use a separate server-authoritative quest flow: store unreleased text, answer verification and prerequisite progression privately, validate the authenticated player and rate-limit attempts, return only the next permitted clue, grant each milestone atomically and idempotently. Do not put solutions, founder message, future clues or answer hashes in publicly served assets or this repo. No reward for opening a clue; all routes must have mobile equivalents. That quest is not implemented in A13.
- Verify the A12.1 stack first, then mobile/desktop Rumors, account switch during delayed read, malformed/offline responses, and completion. No production SQL or deployment.

## Pond Case Files A14 (draft, 2026-11-18)
- A separate companion conversation offers an account-bound, sequential investigation. Read the current clue, optionally ask for its hint, solve it, and unlock the following clue. Free-text answers are mobile/keyboard accessible, with retry/error feedback and no automatic requests. Progress is synced by the server, independent of the pet's life. The final verified discovery appears in the existing Passport.
- The public repository contains only the empty engine, a private seed builder, and synthetic tests. The actual six-stage story, answers and eventual founder message are curated separately. The founder message and attribution must be provided and approved before activation; no invented attribution, no payment or reward for opening a clue. A completed player can still share what they legitimately discover.
- SQL enforces Discord identity, current-stage order, per-account cooldown, attempt limits, row serialization, and final discovery in the same transaction. Private tables have no public grants; the internal schema must remain outside the Data API exposed schemas. The public invoker RPCs return only the currently permitted projection. See [review and rollout checklist](supabase/deploy/POND_CASE_FILES_REVIEW.md). This does not harden legacy public trails.
- Keep the draft and beta gate. No production migration, seed, activation, merge or deployment without a separate owner decision. Real PostgreSQL integration and browser review are required before rollout.

## Next phases (not implemented here)
1. Room: click the frog and existing props; TV opens PepTV only with explicit input, bed routes to real rest, lamp toggles, plant watering, ball/play, and radio/dance if present. Respect actual room inventory rather than inventing objects. A decorative click cannot change a pet need except through the existing validated care flow.
2. Additional site events: other arcade games, verified stamp award, weekly Guesser result and Pond King update. Connect only existing verified result paths; never infer wins from opening/closing a window. Reuse the mute/throttle and avoid interrupting game controls.
3. A10 implemented: 20 new frames for nuzzle, welcome, curious, sulk and yawn; single playback, safe cancellation, preload and reduced-motion support. Review/download package: `pepegochi/companion-a10/PepeGochi-A10.zip`. Future art can add startled-awake and stage-specific expressions. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## QA
Validation: `node --test tests/*.test.mjs` (346 passed, 26 environment skips), site/i18n checks and Python tests. `node tests/pepegochi-companion-browser.cjs` runs the actual taskbar controller in Chromium with local fixtures; uses PLAYWRIGHT_MODULE/HAZE_CHROMIUM overrides when needed. Covers keyboard/touch, room opening, memories, care state priority, focus, throttle, mute/reload, account isolation, return greeting, stale quiz answer, 320/390/1440px and teardown. No production service is contacted. Keep beta gate intact; no merge or production deployment without approval.
