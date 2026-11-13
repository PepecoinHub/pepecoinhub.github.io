# PepeGochi on the PondOS taskbar (beta, 2026-11-12)

## Scope of this draft
- Behind the existing `?beta=gochi` gate only. Nothing is released to all visitors.
- Shows the owner's existing sprite from `pepegochi-room.mjs`, chosen using the **read-only server** response `gry_pepegochi_state`.
- Before adoption, an egg says **Adopt me?** on hover/focus. If a frog moved out, show the GOODBYE.TXT envelope.
- Click the frog to open the existing **PEPEGOCHI.EXE**, not a second independent game.
- Never opens a speech balloon automatically. It has an accessible title/label and a warning mark when the server says the pet is neglected or packing.
- State refreshes at entry, on return after five minutes, on account change and after a successful action in the game's same-origin iframe. No polling or subscriptions.
- No extra sprite sheets, GIFs or recurring image downloads. Desktop and mobile use the already stored PepeGochi sprites.
- Nothing is saved locally about a pet. Server state controls all visual states; no reward/grant or new SQL is introduced.

## Reserved future feature: 99 clues -> Pepecoin quiz
Do **not** show invented clues or quiz answers. The owner has a file with 99 questions, but it has not yet been vetted or imported into this branch.

Next PR, after reviewing the file and verifying accuracy:
1. Prepare `question_id`, `clue`, `answer`, source and checked-on date for each item. No financial recommendations or unsourced changing claims.
2. A server-owned per-account cursor and date guard should grant **at most one new clue per UTC day**, one after another, without a streak requirement or penalty for skipped days.
3. A player may re-open already received clues. The server, not local storage or an untrusted client clock, controls progression. Account changes cannot carry over another person's clues.
4. The taskbar can show a small pending-clue indicator, only after the server says a new clue is available. Clicking the indicator opens a dismissible Win98-style bubble; clicking the frog itself continues to open the room.
5. No stamps or quiz rewards until the actual quiz is designed, checked for cheating and approved by the owner.

## QA / release constraints
- Run `node --test tests/pepegochi-taskbar.test.mjs` and the full suite in the standard repo runtime. Review the beta at 360px and 1280px, including reduced motion, login/logout, adoption, missing SQL, failed network and returning after absence.
- Cross-origin iframe messages must be ignored; the parent only accepts a signal from its real same-origin PepeGochi iframe and then performs its own authorized read.
- Never merge, deploy, run production SQL or enable PepeGochi publicly without approval.

## 2026-11-13 (Claude, branch `claude/kind-faraday-l3vxjs`): taken over from PR #299, plus the fact of the day

PR #299 itself is not changed. Its six files were brought onto this branch (it was based on an older `main`) and extended:

- **Fixes:** the `storage` listener is removed when the companion unmounts; the "unavailable" state (no SQL, offline)
  has a motion; the nine motions move by whole pixels only (no `rotate`, which blurs pixel art).
- **Fact of the day** (`docs/meme/pepegochi-facts.mjs`, data `docs/data/pepecoin-quiz.json`): a small Windows 98 "?"
  on the frog while today's fact is unanswered. It never opens by itself. Click: a balloon with one question and four
  answers; after a pick it shows the right answer, a short remark from the frog and "Read more" (the PepecoinHub page).
  The same question for everyone on a UTC day, in a fixed shuffled order with no repeats until all usable questions
  were asked; only questions with a source and no date-dependent answer. No server and no reward: the browser keeps
  only today's answer. Escape or a click outside closes it. Clicking the frog still opens PEPEGOCHI.EXE.
- **Hop out of the window:** closing or minimizing PEPEGOCHI.EXE sends the window's box (`pondos:pepegochi-left`); the
  frog's current sprite flies in a whole-pixel arc from the window to its taskbar slot, then does a short hop.
  Skipped with reduced motion.
- **Art:** still the 128 px game sprites scaled into the taskbar. The 16 poses and 9 animations (backlog A2/A3) replace
  them when they are drawn; nothing else has to change.

Tests: `node --test tests/pepegochi-taskbar.test.mjs`. Still behind `?beta=gochi`; nothing released.
