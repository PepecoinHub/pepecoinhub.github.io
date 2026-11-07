# PepeGochi v2: backend contract

**Status:** draft (PR A1). `games/supabase/update_pepegochi_v2.sql` is **NOT installed** on any Supabase project.
It replaces the v1 draft in PR #186, which was never applied. PR #186 stays open as a reference only.

**Testing until the owner approves a deployment:** a local database or a separate staging project only.
The hidden beta must not need any change to the production PH-games project.

Design and decisions: `docs/design/pepegochi-v2/` (README.md, TECH_PLAN.md).

## What the server owns

- One personal frog at a time per Discord account. A frog can **move out** after neglect (it is never shown dying). It leaves GOODBYE.TXT, and the owner can then adopt a new egg. Earlier lives stay as history.
- The database owns time, needs, growth, care days, moving out and history. The browser sends only a pet name or one of four action names. It never sends a user id, a stat, a count, a time or a stamp id.
- Discord accounts only. Anonymous guests, e-mail accounts and accounts whose Discord was unlinked are refused by every RPC. The frog is not changed, but its clock keeps running.
- Private tables in schema `games`: `pepegochi_owners` (one row per account), `pepegochi_lives` (one row per frog life, at most one `active`, enforced by a unique index) and `pepegochi_milestones`. RLS is on, and the browser roles have no grants.
- Every write locks the owner's row, then the newest life, then reads server time. No cron, Realtime, heartbeat or click log.
- Moving out deletes nothing. Stamps, items, avatars and secrets are never touched. "P.S. I took the TV" is a joke in the scene only.

## RPCs

Call them like the other PEP Games RPCs (`docs/games/js/backend.js`, `backend.rpc(name, args)`).

| RPC | Arguments | Writes | Returns |
|---|---|---|---|
| `gry_pepegochi_state` | `{}` | never | full state |
| `gry_pepegochi_adopt` | `{p_name}` | a new life, only when there is no frog, or the last one moved out **and** its letter was read | full state + `adopt_result`: `adopted`, `already_have_fren` or `read_the_letter_first` |
| `gry_pepegochi_action` | `{p_action}`: `feed` / `clean` / `play` / `rest` | only when accepted (or the move-out, once) | full state + `action_result`: `accepted` or `moved_out` |
| `gry_pepegochi_letter_read` | `{}` | the move-out if due, and the letter as read, once | full state |

**Rejected actions raise an error and write nothing:**
- `Wait a moment before the next care action` (2 s gap);
- `That action is cooling down`;
- `Daily care action limit reached`;
- `Your Fren does not need that right now` (the need is at 90 or more);
- `Unknown care action`;
- `Adopt a Fren first`.

Bad names raise `22023`. Sign-in problems raise `42501`.

A frog that is due to move out is not an error. The next write call stores the move-out and returns `action_result: 'moved_out'`. Reading is always read-only, so `state` may show `status: 'departed'` with `departure_saved: false` until then.

### Full state (example, not real data)

```json
{
  "version": 2,
  "server_now": "2026-11-15T18:00:00Z",
  "rules": { "playtest": true, "neglected_h": 48, "packing_h": 120, "departs_h": 168, "...": "..." },
  "has_pet": true,
  "can_adopt": false,
  "pet": {
    "life_id": "…", "generation": 1, "name": "Fren", "adopted_at": "2026-11-09T18:00:00Z",
    "life_day": 7, "stage": "froglet", "next_growth_care_days": 7, "care_days": 3,
    "status": "packing",
    "needs": { "hunger": 0, "hygiene": 9, "mood": 0, "energy": 39 },
    "waiting_since": { "feed": "…", "clean": "…", "play": "…", "rest": "…" },
    "most_neglected": "feed", "most_neglected_since": "2026-11-10T01:12:00Z",
    "overdue": ["feed", "clean", "play", "rest"],
    "rescue_starts_recovery": true,
    "recovery": null,
    "departs_at": "2026-11-17T01:12:00Z", "departure_reason": "feed",
    "cooldowns": { "feed": null, "clean": null, "play": null, "rest": null, "any_action": "…" },
    "action_budget": { "accepted_today": 0, "max_per_utc_day": 12 }
  },
  "history": [],
  "summary": { "frens_adopted": 1, "former_frens": 0, "longest_friendship_days": 6, "first_departed_at": null }
}
```

When the frog has moved out, `pet` has `status: "departed"`, `departed_at`, `departure_saved`, `departure_reason`, `days_together`, `care_days` and `letter: {variant, seen}`. It has no needs. `can_adopt` becomes true once the letter has been read. `history` lists up to 10 earlier lives, newest first. All times are server UTC. The browser may show them in local time, but must never use its own clock as proof.

## Rules (PLAYTEST values)

These are the owner's working numbers from 2026-11-07, not final rules. They live in `games.pepegochi_rules()`, and every response carries them in `rules`. The game should explain the rules with these values, not with numbers written into the page.

| Rule | Value | Meaning |
|---|---|---|
| `meaningful_below` | 90 | an action is accepted only while its need is below this |
| `neglected_h` | 48 | the most neglected need has waited this long: `neglected` |
| `packing_h` | 120 | `packing`: "Your Fren is thinking of leaving" |
| `departs_h` | 168 | the frog moves out |
| `rescue_from_h` | 120 | caring again for a frog that reached this starts recovery |
| `recovery_days` | 2 | later UTC days with care needed to end recovery |
| `recovery_departs_h` | 72 | while recovering, the frog moves out after this long without care |
| `max_actions_per_utc_day` | 12 | accepted actions per UTC day (as v1) |
| `min_gap_s` | 2 | seconds between two actions (as v1) |

As in v1:
- cooldowns are 30/20/45/60 min;
- needs decay by 20/15/18/10 per day (hunger/hygiene/mood/energy) and keep their fractions;
- the effects are Feed +35 hunger, Clean +40 hygiene, Play +35 mood (−10 energy, −3 hunger), Rest +40 energy (+5 mood);
- the stages are tadpole (0–1 care days), froglet (2–6) and adult (7+). A care day is a UTC day with at least one accepted action.

### Moving out and the rescue

Every need has its own clock. The clock starts when the need falls below 90. It stops when the player cares for that need, or when the need is back at 90 or more. The status follows the **most neglected** need.

| Waiting | Status | What it takes |
|---|---|---|
| < 48 h | `healthy` | nothing special |
| 48–120 h | `neglected` | care for the needs listed in `overdue` |
| 120–168 h | `packing` | the same, and then the frog is `recovering` |
| ≥ 168 h | `departed` | read the letter, adopt a new egg |

`recovering` (after a rescue from `packing`):
- the frog needs care on **2 more UTC days** (not the rescue day);
- each time within **72 h**;
- after that it is `healthy` again;
- without it, the frog moves out with `departure_reason: 'recovery'`.

Why this works: a single feed only resets hunger, so a frog fed once every 6 days still moves out on day 7 because nobody played with it. A full visit once every 6 days rescues it, but then the follow-up visits are missed. A player who comes back regularly keeps the frog, even with gaps. Every case below is played out by `scripts/pepegochi_sim.mjs` on the real SQL:

| Visits | `recovery_days` = 2 | `recovery_days` = 1 |
|---|---|---|
| every day | stays, always healthy | stays |
| every 4 days | stays, neglected in between | stays |
| Friday + Saturday + Sunday | stays, packing and recovery every week | stays |
| Saturday + Sunday | **moves out on day 16** | stays |
| one feed every 6 days | moves out on day 7 | moves out on day 7 |
| feeds daily, nothing else | moves out on day 7 | moves out on day 7 |
| full visit every 6 days | moves out on day 9 | moves out on day 9 |
| away 6 days, rescue, then daily | stays | stays |
| away 6 days, rescue, away 4 days | moves out on day 13 | moves out on day 13 |
| away 8 days | moves out on day 16; letter, new egg | same |

The Saturday + Sunday row is the decision to make in playtests. With 2 recovery days, players who only play at the weekend lose their frog in the second week. With 1 recovery day, they keep it.

### What to tell players (the screen must say this before adoption)

- "Look after every need at least once a week, or your Fren moves out."
- "After 2 days without care your Fren feels neglected. After 5 days it starts packing."
- "If it started packing, a full check-up calms it down, and it wants to see you on 2 more days."

## Milestones and the Fren Passport

This file never writes stamps. It records account milestones in `games.pepegochi_milestones`, once per account, in the same transaction as the care action:
- `first_adoption`;
- `froglet` (2nd care day);
- `adult` (7th care day).

The rows then go to `games.pepegochi_passport_sync(u)`:
- In this PR the hook is a **no-op**. The Passport bridge (PR C) will replace it and award `first_hatch`, `little_fren` and `grown_fren` through `games.passport_award()`.
- The hook runs inside its own exception block. If it fails, the care action is kept, a warning is logged, and the milestone stays `synced_at = null`. Every later accepted write tries again. PR C's migration can also award everything pending at once.
- Re-running this file never switches off a hook installed later: the no-op is created only when the hook does not exist.
- If an account loses Discord, its RPCs are refused, so nothing new is earned. Pending milestones are delivered after Discord is linked again, on the next accepted action. `passport_award()` also refuses accounts without Discord, which keeps such a milestone pending.
- `certified_fren` is **never** awarded by PepeGochi. It means 100 days of PondOS activity.

## Resource budget

| Moment | RPCs | Writes |
|---|---|---|
| open the game | 1 | 0 |
| accepted action | 1 | 1 life row (+ ≤ 1 milestone row on the days a stage is reached) |
| rejected action | 1 | 0 |
| letter / adoption | 1 | 1–2, once per life |
| window hidden or minimised | 0 | 0 |

Every response is the full state, so the browser should not fetch again after an action. Animate needs locally between calls. Re-read the state when the tab comes back after a long break, or after an error. No polling, no Realtime.

## Tests and the simulator

- `node --test tests/pepegochi.test.mjs`: static checks, runs in CI.
- `tests/pepegochi-sql.test.mjs`: real PostgreSQL 15+. It needs `PASSPORT_PG_URL` and `PASSPORT_PG_MODULE`, like the other SQL tests. It creates and drops its own database, uses 12 parallel connections for the race cases, and moves a virtual clock for the time cases. Test ids match `docs/design/pepegochi-v2/TECH_PLAN.md`. Never point it at Supabase.
- `scripts/pepegochi_sim.mjs`: the time simulator. It runs this exact SQL in an in-memory PGlite database with a virtual clock. It never connects to Supabase.

  ```sh
  mkdir -p /tmp/pepegochi-sim && (cd /tmp/pepegochi-sim && npm i @electric-sql/pglite)
  export PEPEGOCHI_PGLITE_MODULE=/tmp/pepegochi-sim/node_modules/@electric-sql/pglite/dist/index.js
  node scripts/pepegochi_sim.mjs --all
  node scripts/pepegochi_sim.mjs --scenario weekend-sat-sun --rule recovery_days=1
  node scripts/pepegochi_sim.mjs --script "adopt Fren; care; wait 6d; feed; wait 1d; state"
  node scripts/pepegochi_sim.mjs        # interactive: adopt, feed, care, wait 36h, letter, history, rule ...
  ```

  The virtual clock comes from a replaced `games.pepegochi_clock()` that exists only in the simulator's and tests' throwaway databases. In the migration it is exactly `select clock_timestamp()`, and a static test checks that.

## Release gates

1. Review this SQL. Run both test files and the simulator locally or on a separate staging project.
2. Playtest the rules with the simulator, then in the hidden beta (PR B, on a local backend: no production change).
3. Only with the owner's explicit approval: apply `update_pepegochi_v2.sql` to PH-games after `schema.sql`. It does not depend on the Fren Passport files.
4. Passport bridge (PR C) after the Passport migrations, then Supabase security/performance advisors and a negative test with a real JWT.

Not in this PR: good care days and Good Parent (A2/D), the Passport bridge (C), the game window (B), any art.
