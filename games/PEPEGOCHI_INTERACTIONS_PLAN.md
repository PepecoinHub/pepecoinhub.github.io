# PepeGochi interactions roadmap (owner-approved direction, 2026-11-16)

Goal: PepeGochi is the living mascot of PondOS, a Tamagotchi mixed with the Office 97 assistant, not just another game.

## Complete beta integration (2026-11-20)

This is the single review branch for #364 (room, Passport reactions and all 90 refined A16–A23 room sprites), the two later #357 commits (taskbar destinations and care), #365 (dialog, quiz, young frogs) and #366 (Pond Rumors and Secret Journal). It builds on the current `main` and retains the existing hidden `?beta=gochi` gate. The earlier numbers A13–A17 were used for several different tracks; the feature names and original PRs are the authoritative scope.

- Taskbar commands, validated care and the read-only journal coexist in one responsive dialog. A late care response cannot override a newly selected journal; pending Passport reactions survive care. Verified secret events invalidate the journal and use the one deduplicated cosmetic reaction bridge.
- New cache versions apply to all 14 PondOS shells, room controller and same-name redrawn sprite URLs. The owner-approved `goodbye_letter_v2.png` remains the in-game letter.
- #367 (Pond Case Files) is intentionally **not included**. Keep that draft disabled and separately review its private content and database fixtures. No production SQL, new award grants, public release, or change to any existing life-cycle rule in this integration.
- Do not separately merge superseded graphics or interaction PRs. Review the combined branch before any deployment to the hidden beta.

### Combined acceptance checklist

- [ ] Desktop and touch: click, double-click, keyboard, toys, quiet mode, dark/light contrast and 320/390px dialogs.
- [ ] All three growth stages, each need, four care actions from the room and taskbar, positive and rejected saves, delayed responses, two tabs, account/life changes.
- [ ] All 90 new sprites and their original foot lines, hatch/care/departure animations, room and owned props, letter after departure.
- [ ] Room hotspots, TV opens only on click, cosmetic effects, no request for decorative actions.
- [ ] Fireflies, safe window perches, popcorn, reduced motion and game focus.
- [ ] Three arcade hooks and confirmed Passport stamps/secrets, no double reactions or rewards, avatar save (not preview).
- [ ] Pond Quiz: daily question, saving/retry, ranking, duplicate answers and account switch.
- [ ] Pond Rumors and Secret Journal: read only on request, fresh discovery, retry, private account data, Passport navigation.
- [ ] No companion or its requests for regular visitors; no test-mode leaks; check existing app/notification flows for regressions.
- [ ] Natural multi-day hidden-beta run, then explicit owner approval for production release and separately reviewed award SQL.

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

## Dialogue expansion (draft, 2026-11-20; supersedes the A13 hint UI)
- Room objects rotate ten distinct responses per object, including bed, duck, CRT, lamp, plant, mug, painting and reward props. Petting and tapping also vary by life stage. Real care validation, rewards and room ownership stay unchanged.
- Desktop greetings reflect local time, care-day history and absences of at least 24 hours. Adult frogs can discuss the existing cached PEP quote only when it is fresh (at most three hours old, not a saved fallback); no extra quote requests or predictions. Toy invitations have a 45-minute minimum interval.
- Remove the on-demand Pond Rumors and extra-detail buttons for every life stage. Only a fresh player-initiated greeting can offer one subtle clue: adult, healthy, at least 14 good care days, all four needs at least 90, and a confirmed state less than five minutes old. One roll per UTC day with probability 1/6, and at least 14 days between clues. Persist the daily roll and cooldown per owner and life in browser storage; if persistence fails, do not reveal a clue. Recheck trust after the asynchronous Passport read. No server-side or cross-device cooldown is claimed.
- Secret Journal remains available at any stage and shows only completed discoveries; existing secrets and award rules do not change. No new SQL, production writes or deployment.

## Sims-inspired desktop interaction fan (draft, 2026-11-20)
- Clicking the taskbar frog opens a compact fan of five speech bubbles: Care, Talk, Play, My room, More. At desktop widths the choices follow a two-row arc above the frog. The frog's reply appears in a separate warm-yellow speech balloon with a tail toward the actual sprite. Care highlights briefly only for observed low needs or warnings; reduced-motion users get a static accent. Hover uses the already approved curious expression (not newly invented directional sprites).
- On narrow or coarse-pointer devices the same categories become a two-column touch-friendly layout with a full-width My room button and minimum 48px targets. Back returns to the category that was selected; Escape/outside dismissal, real keyboard buttons and existing double-click/room behavior remain. The layout is clamped to the visible viewport, including the positioning of the reply tail; longer submenus or journal contents scroll without losing the sticky close button.
- Action grouping preserves the existing care bridge, dialogue, play/quiz/toys, explicit app shortcuts, account-isolated journal and quiet settings. Desk toys remain unavailable until froglet/adult stage. Secret hints still use the prior rare trust gate, never a menu button. Navigation invalidates stale async results without duplicating care writes.
- Browser regression checks cover 320/390/1440px, non-overlapping targets, keyboard/Back, actual touch viewport, root room shortcut, categories, care, toy, journal, account switching and notification behavior. No new RPC, SQL, public beta gate or deployment.

## Next phases (not implemented here)
1. Room: additional toys and stage-specific hand-drawn room animations only with approved art and owned inventory; consider radio/dance later if a radio item exists.
2. Additional site events: other arcade games, verified stamp award, weekly Guesser result and Pond King update. Connect only existing verified result paths; never infer wins from opening/closing a window. Reuse the mute/throttle and avoid interrupting game controls.
3. A10 implemented: 20 new frames for nuzzle, welcome, curious, sulk and yawn; single playback, safe cancellation, preload and reduced-motion support. Review/download package: `pepegochi/companion-a10/PepeGochi-A10.zip`. Future art can add startled-awake and stage-specific expressions. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## Taskbar command panel A16 (draft implementation, 2026-11-19)
- The expanded PepeGochi panel now opens existing PondOS destinations instead of presenting dead-end dialogue: **Let's play!** opens Pond Games, **What's new?** opens Pond Bulletin, and explicit buttons open the Fren Passport and Pond TV.
- Memories, status, jokes, petting, toys, quiet mode, firefly and Pond Quiz retain their existing local or validated behaviour. Visiting the room remains the only care entry point from the taskbar; this change adds no care RPC, reward, progression or state mutation.
- Commands close the conversation before opening their destination, reuse the existing window functions, and are omitted or fall back to dialogue when a host does not provide a command. Keyboard and touch use the same buttons.
- Targeted Node/CSP checks: 48 passed. The Chromium companion fixture now covers all four command buttons, but local execution still requires the unavailable Playwright package; browser visual QA remains a release prerequisite.

## Taskbar care shortcuts A17 (draft implementation, 2026-11-19)
- The conversation panel has compact **Feed / Clean / Play / Rest** buttons. They call the existing `gry_pepegochi_action` RPC with the same four allowlisted action IDs as the room; there is no parallel care model or client-side grant.
- One action can be in flight at a time. The server remains authoritative for need thresholds, the per-action cooldown, minimum gap, daily limit, rescue/recovery, hatching, growth, move-out and rewards. Rejections are shown in plain language and do not invent a changed state.
- An accepted full-state response repaints the taskbar frog immediately, updates the existing per-life observation baseline and gives the normal fed/clean/played/rested or growth response without an extra state read. An account/life change invalidates a late response.
- The four buttons use a 2×2 Win98 grid so the panel stays usable on phones. The browser fixture covers one accepted Feed action and asserts a single call to the existing RPC; no new SQL, endpoint, timer or polling was added. Targeted Node/CSP checks: 67 passed; the full local suite has 344 passes, 28 environment skips and the same 14 unrelated baseline/environment failures.

## QA
Validation: `node --test tests/*.test.mjs` (346 passed, 26 environment skips), site/i18n checks and Python tests. `node tests/pepegochi-companion-browser.cjs` runs the actual taskbar controller in Chromium with local fixtures; uses PLAYWRIGHT_MODULE/HAZE_CHROMIUM overrides when needed. Covers keyboard/touch, room opening, memories, care state priority, focus, throttle, mute/reload, account isolation, return greeting, stale quiz answer, 320/390/1440px and teardown. No production service is contacted. Keep beta gate intact; no merge or production deployment without approval.

## Secret clues and the notes table (owner, 2026-11-20)

- Counter = good care days of the same frog (the one the 100-day Super Parent stamp counts). Only a healthy froglet/adult with every need at 75 or more, on a fresh greeting.
- Before day 50 (at most once every 3 days, daily 50% roll):
  - a player who is not hunting (no PondOS secret found yet, or none for 14 days) gets a gentle nudge about one of the 12 live secrets (texts in docs/meme/pepegochi-rumors.mjs TRAILS);
  - a player who is hunting gets no hint, only a rare "I would tell you a bigger secret, but I do not trust you enough yet", and only once the new puzzles exist and are not all solved.
- From day 50, one clue every 10 good care days (50, 60, 70, ...), strictly about the NEW puzzles (pond_map_1..6, the golden-foot painting). Texts go in NEW_CLUES in docs/meme/pepegochi-notes.mjs when the puzzles ship; until then the frog says nothing after day 50. The first one comes with the "I trust you now" note.
- Every important message (trust note, clues, nudges) is kept on the side table in the room: envelope with a count, opens NOTES.TXT. Kept in this browser per account and frog life.
