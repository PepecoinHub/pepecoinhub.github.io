# PepecoinHub Supabase security baseline — 2026-11-05

**Read-only inspection of PH-games (production). No SQL writes were executed.**
This report is a **triage**, not a completed penetration test.

## Snapshot

- PostgreSQL project: `PH-games`, EU region, currently about **19 MB** as measured by `pg_database_size`. Free database quota is not currently the binding constraint.
- `public.gry_*` endpoints: **82** functions, all of them `SECURITY DEFINER`, with explicitly fixed `search_path` (confirmed via `pg_proc`).
- **35** of those functions can be called as `anon` (includes public leaderboards and some host-management RPCs with internal permission checks).
- Supabase Security Advisor reported:
  - **36** `function_search_path_mutable` warnings (other helper functions, not the public `gry_*` set above).
  - **35** `anon_security_definer_function_executable` warnings.
  - **82** `authenticated_security_definer_function_executable` warnings.
  - **42** RLS-enabled tables with no policies (`INFO`). The `games` schema is intentionally private and accessed through validated RPC, so this can be expected; verify the schema grants remain restricted.
  - Anonymous sign-ins and Realtime policies also have warnings. Review specific policy behavior before changing it.
- Performance Advisor flagged: an unindexed FK on `games.lobby_mentions`, and `games.yeet_guest_sends` lacking a primary key.

These counts are **warnings and configuration findings, not 35/82 confirmed exploits**. Blindly revoking every `anon` RPC would break the existing lobby, games and public scoreboards.

## Specific verified risks

### 1. YEET records cannot authorize scarce rewards yet

The existing `public.gry_yeet_submit` accepts player-supplied `p_score` and `p_ms`, with plausibility checks and per-user cooldown. It does **not** replay the physics on a trusted server. A modified client may submit a plausible fictitious flight.

**Decision:** A 6000 m record can appear as a legacy leaderboard milestone but must not create a scarce Moon Rock, Discord role or transferable reward until a stronger server-verified completion mechanism is implemented.

A client-side checksum, hidden JavaScript secret or signing with a browser-held key would **not** establish trusted proof.

### 2. Pepe Miner saves are client-authored

`public.gry_miner_save(p_data, p_all)` checks Discord identity, JSON format/size (100 KB) and a 20-second save throttle. Its `p_all` numeric total is client-supplied, so it is a sync feature, **not** proof of mined progression.

**Decision:** do not issue prestige Passport achievements from this total alone.

### 3. Public casual easter eggs are not secure achievements

PR #184 adds three allowlisted secrets. Any script-savvy person can identify the allowed IDs and call the discovery RPC while logged in. This is fine for **cosmetic low-stakes stamps only**; do not turn them into rare/scarce prizes or money.

### 4. Several privileged host RPCs are callable as anon, but validate host rights internally

Sampled `gry_wp_host_decide`, `gry_wp_host_paid` and `gry_wp_host_settings2`: all call `games.is_host_user(auth.uid())`; `gry_wp_robot_add` requires a separate robot token and caps its pending queue.

This is a meaningful guard, but **not a full negative authorization test**, and a flood of invalid calls can still consume compute. Test with real `anon`, Discord non-host and host sessions before reducing grants.

## PepeGochi v1 design response

- Authenticated Discord identity checked inside every public RPC, not just by UI visibility. Supabase anonymous Auth users are rejected.
- Private `games.pepegochi_pets` table, RLS enabled, no direct browser table grants. UUID ownership derived from `auth.uid()` only.
- `gry_pepegochi_state()` is read-only and computes decayed needs from a saved timestamp. No scheduled updates for inactive pets.
- `gry_pepegochi_adopt(p_name)` creates at most one pet per user via primary key.
- `gry_pepegochi_action(p_action)` accepts four fixed strings, locks the user's pet row, uses server time, verifies cooldowns, limits accepted actions to 12 per UTC day and increments the lifetime care-day counter once per distinct UTC day.
- The basic migration grants **no collectibles**. Optional bridge to PR #184 awards `certified_fren` when the saved server counter reaches 100; it checks the saved row and handles repeat/backfill safely.
- No published OAuth keys, service-role keys, database passwords or private artwork in the migration.
- A valid Discord user can still call permitted RPCs directly, but cannot directly alter pet stats, age or award rows. **No design guarantees the user is human**; a daily scripted login is not preventable with these mechanics alone.

## Resource and abuse risks

The 12-action daily cap bounds **accepted writes**, but does not stop an attacker from issuing thousands of invalid calls, which still cost database CPU and network.

1. Release v1 as a small beta; no `setInterval` network polling, Realtime room, action logs or per-frame writes.
2. Measure request rate, slow queries, DB CPU, API errors and egress daily. Alert before exhausting quotas.
3. Before high-value rewards or large public traffic, put sensitive write actions behind a **real** rate-limited API gateway (e.g. a Cloudflare Worker validating the Supabase JWT). To prevent bypass, revoke direct RPC EXECUTE from clients and use a tightly scoped server credential / internal function. WAF protection of the static website alone does not cover direct `*.supabase.co/rest/v1/rpc/*` calls.
4. Maintain an offsite, access-controlled Postgres export; free-tier data must not be treated as automatically backed up.
5. Never store sprites/media binaries in frequently read database rows; keep them on GitHub Pages.

## Before merge/deployment: tests

- Apply migration on isolated staging, never on production first.
- Verify `anon` and Supabase anonymous Auth calls are denied and one Discord user cannot read/change another pet.
- Simultaneously call `feed` twice; at most one is accepted. Verify server time is taken after obtaining the lock.
- Repeat `adopt`; it cannot create another pet.
- Change browser clock, localStorage, UI stats or RPC JSON; the server state does not change.
- Simulate UTC midnight with a controlled test clock / isolated database; no more than one care credit per UTC day.
- Check all four cooldowns and the limit of 12 accepted actions; repeated denied calls must not write new rows.
- Verify `Certified Fren` cannot be claimed by a manual client RPC, but is awarded by the optional bridge after 100 real care dates.
- Run the Supabase security/performance advisors again after staging migration.
- Run realistic request/load checks on a non-production deployment.
- Do not merge PR #184 or the backend PR before the integration and license review.

Reference docs: https://supabase.com/docs/guides/database/postgres/row-level-security
Advisor notes: https://supabase.com/docs/guides/database/database-linter
