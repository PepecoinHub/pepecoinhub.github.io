# PepeGochi interactions roadmap (owner-approved direction, 2026-11-16)

Goal: PepeGochi is the living mascot of PondOS, a Tamagotchi mixed with the Office 97 assistant, not just another game.

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

## Next phases (not implemented here)
1. Room: click the frog and existing props; TV opens PepTV only with explicit input, bed routes to real rest, lamp toggles, plant watering, ball/play, and radio/dance if present. Respect actual room inventory rather than inventing objects. A decorative click cannot change a pet need except through the existing validated care flow.
2. Additional site events: completed arcade game, verified stamp award, weekly Guesser result and Pond King update. Connect only existing verified result paths; never infer wins from opening/closing a window. Reuse the mute/throttle and avoid interrupting game controls.
3. A10 implemented: 20 new frames for nuzzle, welcome, curious, sulk and yawn; single playback, safe cancellation, preload and reduced-motion support. Review/download package: `pepegochi/companion-a10/PepeGochi-A10.zip`. Future art can add startled-awake and stage-specific expressions. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## QA
Validation: `node --test tests/*.test.mjs` (342 passed, 26 environment skips), site/i18n checks and Python tests. `node tests/pepegochi-companion-browser.cjs` runs the actual taskbar controller in Chromium with local fixtures; uses PLAYWRIGHT_MODULE/HAZE_CHROMIUM overrides when needed. Covers keyboard/touch, room opening, memories, care state priority, focus, throttle, mute/reload, account isolation, return greeting, stale quiz answer, 320/390/1440px and teardown. No production service is contacted. Keep beta gate intact; no merge or production deployment without approval.
