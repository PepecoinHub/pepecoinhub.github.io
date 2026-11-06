# Fren Passport — confirmed badge rules (2026-11-06)

Status: **design decisions only**. This file does not implement server-side awarding. All new badges below remain **planned** until verified backend logic, migrations, and integration tests are approved. Never grant badges based solely on client-reported values. This branch is Draft PR #191, stacked on #189 and #184. Do not run SQL on production or merge without owner approval.

## Locked-in decisions

| Badge ID | Name | Condition | Unlock / reward | Status |
|---|---|---|---|---|
| `certified_fren` | Certified Fren | At least one accepted, authenticated PondOS interaction on **100 distinct calendar days**. Days need not be consecutive. Opening a page without an accepted action does not count. | Passport stamp and the existing planned Certified Fren title | Planned |
| `hundred_day_fren` | 100 Days Together | **100 days elapsed since Discord-linked Fren registration**. Not active days. | Stamp | Planned |
| `yeet_adept` | Adept | A YEET flight of **at least 3000 m**. | Stamp, `bg_sunset` background | Planned |
| `moonwalker` | Moonwalker | A YEET flight of **at least 6000 m**. | Existing stamp only; Moon Rock is a separate future item | Existing live catalog entry; client results are not server-replayed |
| `nasa_is_hiring` | NASA Is Hiring | **Three distinct YEET flight attempts**, each **strictly above 5000 m**. Counting one personal-best record three times is forbidden. | Stamp | Planned |
| `detective_fren` | Detective Fren | **Five different daily Pepe Guesser puzzles**, each yielding the maximum **5000 points**, as confirmed by the game backend. Repeated client submissions for one puzzle do not add extra completions. | Stamp, `hat_detective` and `clothing_suit` | Planned |
| `scout_fren` | Scout Fren | **14 consecutive calendar days** with one accepted completed Pepe Guesser guess per day. Score does not have to be perfect. | Stamp, `accessory_pin` | Planned |

**Optional extra reward awaiting owner approval:** a Scout Fren title displayed below the nickname. No new art or title has been shipped for this yet.

## No XP or levels

XP, cosmetic levels and the derived progress bar are removed from the Draft PR #191 Passport UI. “My Fren Journey” keeps factual counts: **days registered** (account age), earned stamps, secrets and items. Never label calendar days elapsed since registration as actual activity days. A real **active days** counter may be shown only after backend activity-day tracking is implemented.

## Required server-side work before any of the planned badges goes live

1. For Certified Fren, persist one authenticated **accepted action** per `(user_id, UTC_date)` with server timestamps, indexed uniquely and rate-limited. Avoid a write for every click: record only the first accepted action of the day. A scripted request can still simulate an action; this is a **cosmetic** achievement, not anti-bot proof.
2. For Scout Fren, the server must evaluate distinct **daily Pepe Guesser completions** on 14 consecutive UTC days using trusted game records, not browser-local streaks.
3. For Detective Fren, verify the server-computed **5000-point perfect score** on five **different puzzle dates**. Ensure the game backend represents 5000 accurately and record at most one qualifying result per puzzle/user.
4. For Adept, Moonwalker and NASA, note that YEET currently validates plausibility but does **not** replay every flight server-side. Cosmetic stamp only. NASA requires an **append-only/unique attempt history or equivalent trusted evidence** for each of the three independent flights, not merely a user's all-time maximum distance. Don't make these unlock real PEP, transferable items or financial benefits.
5. For age-based `hundred_day_fren`, use the server's account creation timestamp. No activity counter should be inferred.
6. Update future server-side avatar save allowlists to permit `bg_sunset`, `hat_detective`, `clothing_suit` and `accessory_pin` **only if** the associated server-verified badge exists. Draft PR #191 deliberately rejects currently locked options.
7. Dates are specified as UTC for consistent rules globally. If the team later chooses a user-local timezone, make that a deliberate, tested migration, not a browser-controlled preference.

## Cross-PR conflict to resolve before merge

**Critical:** Draft PR #186 (`games/supabase/update_pepegochi_passport_bridge.sql`) originally grants `certified_fren` after **100 PepeGochi care days**. Draft PR #184's `games/supabase/update_fren_passport.sql` also describes `certified_fren` as “100 distinct care days in PepeGochi.” This **conflicts with the new confirmed 100 days of PondOS activity rule**.

Before publishing either backend PR:
- Stop PepeGochi's 100-care-day hook from minting `certified_fren`, and reserve a different PepeGochi-specific badge if desired.
- Update the passport SQL description and tests.
- Implement the chosen PondOS action-day tracker and tests in a dedicated, reviewable migration.
- Keep all planned badge statuses `planned` until the server supports them.

## Items untouched

BALI remains reserved for the server-verified PEP/USD $0.01 event. The three current cosmetic secrets remain low trust. PepeGochi, game-room and additional inventory mechanics are out of scope for these catalog/UI edits.
