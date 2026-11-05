# PepeGochi v1: backend contract for Claude Code

**Status:** code prepared for review in `codex/pepegochi-secure-backend-v1`. **NOT installed on production Supabase.**

Use this spec to build the **solo PepeGochi frontend only**. Keep it on its own Git branch, separate from Fren Passport PR #184 and from the backend PR. Do **not** create a second auth, database, achievement ledger, or localStorage-powered authoritative pet state.

## Source of truth and ownership

- Existing PepecoinHub PEP Games Supabase project and Discord OAuth, **one pet per Discord-linked Supabase Auth user ID**.
- All reads/writes occur through the existing public `gry_*` RPC pattern. The `games` schema is private and its new table has RLS enabled with no browser CRUD grants.
- `games.pepegochi_pets` contains one row per account: pet name, saved needs, server timestamps, lifetime distinct care-day counter and four cooldown timestamps.
- All actions are serialized under a PostgreSQL row lock. Server time is taken **after** acquiring the lock.
- The browser **never** sends `user_id`, `care_days`, pet age, stat percentages, unlocked items or timestamps.
- No cron, realtime, continuous sync or dead pets; needs decay only when **calculated** and are saved only after an accepted care action.
- Never use this API to award YEET Moon Rock. The existing YEET backend checks score plausibility but doesn't prove a full flight.

## RPC contract

Each method is invoked using the same backend that existing PEP Games use, `docs/games/js/backend.js`:

| Method | Arguments | What it returns |
|---|---|---|
| `gry_pepegochi_state` | `{}` | Current projected pet, or `{version:1, has_pet:false, server_now:...}` |
| `gry_pepegochi_adopt` | `{p_name:"Fren"}` | Current pet (also returned on repeated adoption; cannot replace a pet) |
| `gry_pepegochi_action` | `{p_action:"feed"}` | Updated pet with server-confirmed needs and counters |

**Allowed actions:** `feed`, `clean`, `play`, `rest`. Any other value is rejected.

All functions reject unauthenticated users, Supabase anonymous guest accounts, and users without a linked Discord identity. The browser should offer the existing Discord login flow rather than trying to bypass this.

### Example successful response (illustrative, not real user data)

```json
{
  "version": 1,
  "has_pet": true,
  "name": "Fren",
  "adopted_at": "2026-11-05T13:30:00Z",
  "server_now": "2026-11-12T15:00:00Z",
  "care_days": 7,
  "last_care_day_utc": "2026-11-12",
  "stage": "adult",
  "next_growth_care_days": null,
  "needs": {"hunger": 68, "hygiene": 72, "mood": 80, "energy": 65},
  "cooldowns": {
    "feed": "2026-11-12T14:45:00Z",
    "clean": null,
    "play": null,
    "rest": null,
    "any_action": "2026-11-12T14:15:02Z"
  },
  "action_budget": {"accepted_today": 2, "max_per_utc_day": 12}
}
```

All timestamp strings must be read as server UTC timestamps. The client can display them in the viewer's locale, but **must not use the local clock as proof** that a care day was earned.

### Example client usage (adapt to your module location)

```js
import { getBackend } from './js/backend.js';

const backend = await getBackend();

async function loadPet() {
  return backend.rpc('gry_pepegochi_state', {});
}

async function adoptPet(name) {
  return backend.rpc('gry_pepegochi_adopt', { p_name: name });
}

async function careForPet(action) {
  if (!['feed', 'clean', 'play', 'rest'].includes(action)) return;
  return backend.rpc('gry_pepegochi_action', { p_action: action });
}
```

Run on the PEP Games page (or its PondOS 98 iframe) with the **existing** authentication provider. Catch RPC errors and keep any optimistic animation cosmetic. If the request fails, show the server state again; never treat a local animation as a saved action.

## Game rules, server enforced

| Rule | v1 |
|---|---|
| Life cycle | `tadpole` (0-1 care days), `froglet` (2-6), `adult` (7+) |
| Day credit | 1 credit maximum per distinct **UTC calendar day** with at least one accepted action |
| Care achievement | At 100 distinct days; **only** with Passport bridge installed |
| Permanent death | None |
| Feed cooldown | 30 minutes |
| Clean cooldown | 20 minutes |
| Play cooldown | 45 minutes |
| Rest cooldown | 60 minutes |
| Gap between any actions | 2 seconds |
| Accepted care actions/day | Maximum 12 (UTC day; protects write volume) |
| Stats | 0-100, clipped server-side |

Needs decay per 24 h while unattended: hunger -20, hygiene -15, mood -18, energy -10. **The database persists numeric(7,4) need values, including fractions, after each accepted action. Only the read-only JSON snapshot rounds down to 0–100 integer UI percentages.** This prevents frequent care actions from erasing small hourly decay. Needs are derived without database writes; even returning 30 days later costs one read. Accepted care actions apply:
- Feed: hunger +35.
- Clean: hygiene +40.
- Play: mood +35, energy -10, hunger -3.
- Rest: energy +40, mood +5.

The v1 database deliberately has **no inventory/personalization write API**. Decorative room previews can be local, but they cannot be called purchased/unlocked until server-confirmed inventory exists.

## Resource budget

- Read current pet **once on opening**, and optionally on returning from the background after a long break or after an error.
- Accepted actions send **one** RPC each; the response includes complete state, so don't immediately re-fetch it.
- Animate needs/timer locally. Do not request the server every second, add realtime channels or schedule cron updates for inactive frogs.
- Assets, sprite sheets, locale strings and achievement definitions are served from GitHub Pages, not Supabase Storage.
- Database state is one row per pet plus future one-time award rows; don't append a record for every UI tap or every frame.
- The 12 accepted-action cap limits normal writes, **not malicious rejected-request floods**. If we observe abuse, add an actual rate-limited API gateway (and block direct bypass) before scaling or enabling prizes.

## Migration order / release gates

1. In staging only, apply `games/supabase/update_pepegochi_v1.sql` after the current PH-games schema.
2. Test Discord user, anonymous guest and logout; simultaneous requests; duplicate action; UTC midnight; 100 care days via controlled test-time setup (in staging); and account isolation.
3. For Passport integration apply PR #184's `games/supabase/update_fren_passport.sql` **before** applying `games/supabase/update_pepegochi_passport_bridge.sql`.
4. Re-run the bridge if the base PepeGochi migration is re-applied later (the base creates a no-op milestone hook).
5. Run Supabase security/performance advisors and targeted load tests; merge/publish only after review.

## UX constraints for Claude

**Use the existing PondOS 98 window, wallpaper, green title bars, dark graphite panels, icons, spacing and CSS.** Do not create a replacement desktop, oversized new OS or modern mobile-game UI. The solo pet should begin in a modest room/pond with Feed / Clean / Play / Rest and gradual unlocks.

**Art licensing:** `mlewis412/pepegachi` is a private reference repo. Before copying or publishing assets to this public repo, obtain confirmation of the friend's permission and applicable licenses. A mock-up or locally authored temporary placeholder is acceptable until then.

## Regression testing and PR dependencies

- `node --test tests/pepegochi_backend.test.mjs` runs source invariants in a plain Node checkout.
- Optional **real PostgreSQL engine (PGlite)** test: install `@electric-sql/pglite` in a temporary/test-only Node environment, then run `node --test tests/pepegochi_postgres.integration.mjs`. Without this dependency the test intentionally **skips**, and must not be represented as passing.
- The PGlite suite checks real decimal decay over two consecutive 2-hour care gaps, one-care-day-per-UTC-day behavior, basic Discord gating and repeated migrations.
- **PR #184 (Fren Passport) must be present in the same working tree** to run the optional 100-day badge integration section. The bridge SQL and catalog are intentionally separate from this PR.
- Before release, repeat authorization, concurrency, full-day/timezone and load tests against real staging Supabase. Local WASM Postgres does not prove correct behavior under concurrent connections or deployed JWT/RLS configuration.

**Important:** The source backend is complete for v1 only. The live PepeGochi frontend does not exist in this PR. The current public catalog marks adoption, evolution and room-decorating achievements as *planned*, not presently earnable. Do not mark them live until the corresponding validated award logic has actually shipped.
