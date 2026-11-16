# PepeGochi interactions roadmap (owner-approved direction, 2026-11-16)

Goal: PepeGochi is the living mascot of PondOS, a Tamagotchi mixed with the Office 97 assistant, not just another game.

## Phase 1: taskbar interactions (this draft)
- One click opens a Win98 conversation. Double-click or the room button opens the existing PEPEGOCHI.EXE. Before adoption and after departure, click opens the room directly.
- Right click opens the same menu. Keyboard and touch users can use the menu with a single activation.
- How are you, joke, play, pet, what's new, daily Pond Quiz when available, visit room. Play and what's new are local dialogue for now, not a claim of new live activity.
- Intentional mouse drag over the frog pets it; repeated single clicks produce annoyed reactions. Reuse existing talk, laugh, moody and wave sprites. Real pet needs, young stages, sleep and warnings are never overridden with a fake healthy adult.
- All of these reactions are cosmetic and ephemeral. No new state or progression, network requests, storage, database changes, or rewards. No automatic bubbles. Existing quiz and care remain authoritative; no competing bubble, and account switch closes local and quiz dialogue.

## Next phases (not implemented here)
1. Room: click the frog and existing props; TV opens PepTV only with explicit input, bed routes to real rest, lamp toggles, plant watering, ball/play, and radio/dance if present. Respect actual room inventory rather than inventing objects. A decorative click cannot change a pet need except through the existing validated care flow.
2. Site events: one short optional reaction on completed game, verified stamp award, weekly Guesser result, and Pond King update. Only reuse existing events/results already available to the client; no polling, no made-up results and no new stamp award on interaction. Provide a mute switch, throttle, and never interrupt game controls.
3. Add new 48px sprite frames as needed, matching the approved PepeGochi pixel art: happy with closed eyes, grumpy, startled awake, glance left/right, and celebrations. Younger frogs retain their own stage.
4. Expand the dialogue library with humorous context-dependent lines. No generic AI chat or server-side text generation required.

## QA
Run the existing taskbar and new interaction tests plus full suite. Verify real browser desktop/mobile and keyboard, room opening, account switch, reduced motion, quiz and existing state. Keep beta gate intact; no merge or production deployment without approval.
